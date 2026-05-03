import os
import cv2
import torch
import torch.nn as nn
import numpy as np
import timm
import uuid
import shutil
import asyncio

# Base URL — set via environment variable in production
# e.g. export BASE_URL=http://YOUR_DROPLET_IP
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from torchvision import transforms
from PIL import Image

# Configuration
CONFIG = {
    "model_path": "../vit_dr_final.pth",
    "img_size": 224,
    "num_classes": 5,
    "device": torch.device("cuda" if torch.cuda.is_available() else "cpu"),
    "class_map": {
        0: "No DR (Healthy)", 
        1: "Mild NPDR", 
        2: "Moderate NPDR", 
        3: "Severe NPDR", 
        4: "Proliferative DR"
    },
    "uploads_dir": "static/uploads",
    "heatmaps_dir": "static/heatmaps"
}

os.makedirs(CONFIG["uploads_dir"], exist_ok=True)
os.makedirs(CONFIG["heatmaps_dir"], exist_ok=True)

app = FastAPI(title="Diabetic Retinopathy Diagnosis API")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==========================================
# MODEL DEFINITION & LOADING
# ==========================================
class ViT_DR(nn.Module):
    def __init__(self, num_classes=5):
        super(ViT_DR, self).__init__()
        self.model = timm.create_model('vit_base_patch16_224', pretrained=False)
        self.model.head = nn.Linear(self.model.head.in_features, num_classes)

    def forward(self, x):
        return self.model(x)

# Global model instance
model = None

@app.on_event("startup")
async def load_model():
    global model
    try:
        model = ViT_DR(num_classes=CONFIG["num_classes"]).to(CONFIG["device"])
        if not os.path.exists(CONFIG["model_path"]):
            print(f"WARNING: Model file {CONFIG['model_path']} not found. Inference will fail.")
        else:
            model.load_state_dict(torch.load(CONFIG["model_path"], map_location=CONFIG["device"]))
        model.eval()
        print("Model loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")

# ==========================================
# PREPROCESSING
# ==========================================
def preprocess_for_inference(img_path):
    img = cv2.imread(img_path)
    if img is None:
        try:
            with Image.open(img_path) as pil_img:
                img = cv2.cvtColor(np.array(pil_img.convert('RGB')), cv2.COLOR_RGB2BGR)
        except: return None, None

    # Keep original for overlay later
    original_img = img.copy()

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = gray > 10
    if np.any(mask):
        img = img[np.ix_(mask.any(1), mask.any(0))]

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2RGB)
    
    img_resized = cv2.resize(img, (CONFIG["img_size"], CONFIG["img_size"]))
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    # Resize original image to same size for GradCAM overlay consistency
    original_img_resized = cv2.resize(cv2.cvtColor(original_img, cv2.COLOR_BGR2RGB), (CONFIG["img_size"], CONFIG["img_size"]))

    return original_img_resized, transform(img_resized).unsqueeze(0)

# ==========================================
# GRAD-CAM IMPLEMENTATION (Corrected for ViT)
# ==========================================
class ViTGradCAM:
    """
    Correct Grad-CAM for Vision Transformers (ViT).
    
    Key fixes vs naive implementation:
    - Hook the LAST transformer block output (not model.norm).
      model.norm captures post-normalized features but the spatial
      token structure is still intact there; however hooking the last
      block's output before norm is more representative.
    - Gradient weights are computed by averaging over the embedding
      dimension (dim=2, the channel/feature axis), NOT over the token
      sequence dimension. This gives one importance scalar per token.
    - CAM is computed as a weighted sum of activations per token
      (element-wise weight * activation summed across channels), which
      is the standard Grad-CAM formula adapted for sequence models.
    - CLS token (index 0) is excluded since it has no spatial meaning.
    - ReLU is applied AFTER the weighted-sum to keep only positive
      contributions to the predicted class.
    """
    def __init__(self, model):
        self.model = model
        self.gradients = None
        self.activations = None
        # Hook the LAST transformer block — captures richest spatial features
        target_layer = self.model.model.blocks[-1]
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        # output shape: [B, num_tokens, embed_dim]  e.g. [1, 197, 768]
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        # grad_output[0] shape: [B, num_tokens, embed_dim]
        self.gradients = grad_output[0].detach()

    def generate_heatmap(self, input_tensor, target_class=None):
        self.model.zero_grad()
        output = self.model(input_tensor)

        probs = torch.nn.functional.softmax(output, dim=1)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        confidence = probs[0, target_class].item()

        # Backprop on the raw logit (not softmax) for sharper gradients
        loss = output[0, target_class]
        loss.backward()

        # gradients & activations: [1, num_tokens, embed_dim]
        grads = self.gradients[0]       # [num_tokens, embed_dim]
        acts  = self.activations[0]     # [num_tokens, embed_dim]

        # --- CORRECT Grad-CAM weight: global average pool over embedding dim ---
        # weights shape: [num_tokens] — one importance score per spatial token
        weights = grads.mean(dim=1)     # avg over channels → [num_tokens]

        # Weighted sum of activations across channels
        # cam[t] = sum_c( weight[t] * acts[t,c] ) but we just multiply the
        # scalar weight by each token's activation and then sum → equivalent
        # to the dot product of weight vector and the summed activation per token
        cam = (weights.unsqueeze(1) * acts).sum(dim=1)  # [num_tokens]

        # ReLU — keep only positive contributions to the predicted class
        cam = torch.relu(cam)

        # Drop the CLS token (index 0) — it has no spatial correspondence
        cam = cam[1:]  # [196] for 14×14 grid

        # Normalise to [0, 1]
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = torch.zeros_like(cam)

        # Reshape to spatial grid
        num_patches = cam.size(0)
        side = int(round(num_patches ** 0.5))
        try:
            heatmap = cam.reshape(side, side).cpu().numpy()
        except Exception:
            # Fallback: zero map
            heatmap = np.zeros((14, 14), dtype=np.float32)

        # Upscale to image resolution with bicubic interpolation for smoothness
        heatmap = cv2.resize(heatmap, (CONFIG["img_size"], CONFIG["img_size"]),
                             interpolation=cv2.INTER_CUBIC)
        heatmap = np.clip(heatmap, 0, 1)

        return heatmap, CONFIG["class_map"][target_class], target_class, confidence

# ==========================================
# API ENDPOINTS
# ==========================================
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
        
    try:
        # Save uploaded file
        file_id = str(uuid.uuid4())
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        upload_filename = f"{file_id}.{ext}"
        upload_path = os.path.join(CONFIG["uploads_dir"], upload_filename)
        
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Preprocess
        original_img, input_tensor = preprocess_for_inference(upload_path)
        if original_img is None or input_tensor is None:
            raise HTTPException(status_code=400, detail="Invalid image file or preprocessing failed.")
            
        # Inference & Grad-CAM
        input_tensor = input_tensor.to(CONFIG["device"])
        
        with torch.enable_grad():
            cam_engine = ViTGradCAM(model)
            heatmap, sev_label, class_id, confidence = cam_engine.generate_heatmap(input_tensor)

        # --- Save the clean preprocessed image for compare mode ---
        processed_filename = f"processed_{file_id}.png"
        processed_path = os.path.join(CONFIG["uploads_dir"], processed_filename)
        cv2.imwrite(processed_path, cv2.cvtColor(original_img, cv2.COLOR_RGB2BGR))

        # --- Generate flat Grad-CAM overlay (for flat UI compare mode) ---
        heatmap_filename = f"heatmap_{file_id}.png"
        heatmap_path = os.path.join(CONFIG["heatmaps_dir"], heatmap_filename)

        # float [0,1] → uint8 → JET colormap (BGR)
        heatmap_uint8   = (heatmap * 255).astype(np.uint8)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)   # BGR

        # Blend: 55% original + 45% heatmap  (flat UI)
        original_bgr = cv2.cvtColor(original_img, cv2.COLOR_RGB2BGR)
        overlay_bgr  = cv2.addWeighted(original_bgr, 0.55, heatmap_colored, 0.45, 0)
        cv2.imwrite(heatmap_path, overlay_bgr)

        # --- Generate TRANSPARENT RGBA heatmap PNG for WebAR Three.js texture ---
        ar_heatmap_filename = f"ar_heatmap_{file_id}.png"
        ar_heatmap_path = os.path.join(CONFIG["heatmaps_dir"], ar_heatmap_filename)

        # Convert JET BGR → RGB
        heatmap_rgb = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        # Alpha channel = Grad-CAM activation intensity (0 = transparent, 255 = opaque)
        # Square the activation so only truly hot areas are visible → cleaner AR overlay
        alpha_channel = (heatmap * 255).astype(np.uint8)
        alpha_channel = cv2.GaussianBlur(alpha_channel, (15, 15), 0)  # smooth edges

        # Stack into RGBA
        rgba_heatmap = np.dstack((
            heatmap_rgb[:, :, 0],
            heatmap_rgb[:, :, 1],
            heatmap_rgb[:, :, 2],
            alpha_channel
        ))

        # Save as RGBA PNG (PIL handles RGBA correctly, cv2 does not by default)
        from PIL import Image as PILImage
        PILImage.fromarray(rgba_heatmap.astype(np.uint8), 'RGBA').save(ar_heatmap_path)

        # --- Severity metadata for AR HUD ---
        severity_colors = {
            0: "#00ff88",   # Green  — Healthy
            1: "#ffff00",   # Yellow — Mild
            2: "#ffa500",   # Orange — Moderate
            3: "#ff4444",   # Red    — Severe
            4: "#cc00ff"    # Purple — Proliferative
        }
        severity_icons = {
            0: "✅", 1: "⚠️", 2: "⚠️", 3: "🔴", 4: "🚨"
        }
        clinical_notes = {
            0: "No lesions detected. Retina appears healthy.",
            1: "Mild microaneurysms present. Annual follow-up advised.",
            2: "Moderate lesions detected. Referral recommended.",
            3: "Severe hemorrhages detected. Urgent ophthalmology referral.",
            4: "Proliferative DR. Immediate laser/anti-VEGF treatment required."
        }

        return {
            "prediction": sev_label,
            "class_id": class_id,
            "confidence": round(confidence * 100, 2),
            "severity_color": severity_colors[class_id],
            "severity_icon": severity_icons[class_id],
            "clinical_note": clinical_notes[class_id],
            "original_image_url": f"{BASE_URL}/static/uploads/{processed_filename}",
            "heatmap_image_url":  f"{BASE_URL}/static/heatmaps/{heatmap_filename}",
            "ar_heatmap_url":     f"{BASE_URL}/static/heatmaps/{ar_heatmap_filename}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

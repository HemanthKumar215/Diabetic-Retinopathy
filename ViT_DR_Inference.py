import os
import cv2
import torch
import torch.nn as nn
import numpy as np
import timm
import pandas as pd
import matplotlib.pyplot as plt
from torchvision import transforms
from PIL import Image
from sklearn.metrics import (
    cohen_kappa_score, 
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score
)
from tqdm import tqdm

# ==========================================
# 1. CONFIGURATION
# ==========================================
CONFIG = {
    "model_path": "vit_dr_final.pth",
    "test_dir": "test_images",
    "train_dir": "train_images", 
    "test_csv": "test_clean.csv",
    "train_csv": "train_clean.csv",
    "output_dir": "final_project_results",
    "img_size": 224,
    "num_classes": 5,
    "device": torch.device("cuda" if torch.cuda.is_available() else "cpu"),
    "class_map": {
        0: "No DR (Healthy)", 
        1: "Mild NPDR", 
        2: "Moderate NPDR", 
        3: "Severe NPDR", 
        4: "Proliferative DR"
    }
}

if not os.path.exists(CONFIG["output_dir"]):
    os.makedirs(CONFIG["output_dir"])

# ==========================================
# 2. PREPROCESSING
# ==========================================
def preprocess_for_inference(img_path):
    img = cv2.imread(img_path)
    if img is None:
        try:
            with Image.open(img_path) as pil_img:
                img = cv2.cvtColor(np.array(pil_img.convert('RGB')), cv2.COLOR_RGB2BGR)
        except: return None

    # Standardizing the fundus scan: Auto-cropping and CLAHE
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
    return img_resized, transform(img_resized).unsqueeze(0)

# ==========================================
# 3. ADVANCED XAI ENGINE
# ==========================================
class ViTGradCAM:
    def __init__(self, model):
        self.model = model
        self.gradients = None
        self.activations = None
        target_layer = self.model.model.norm 
        target_layer.register_forward_hook(self.save_activation)
        target_layer.register_full_backward_hook(self.save_gradient)

    def save_activation(self, module, input, output):
        self.activations = output.detach()

    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate_heatmap(self, input_tensor, target_class=None):
        """
        Confidence-Weighted Heatmap with Gamma Correction for Panel Reviews.
        """
        self.model.zero_grad()
        output = self.model(input_tensor)
        probs = torch.softmax(output, dim=1)
        
        if target_class is None:
            target_class = output.argmax(dim=1).item()
        
        confidence = probs[0, target_class].item()
        loss = output[0, target_class]
        loss.backward()

        weights = torch.mean(self.gradients, dim=1, keepdim=True)
        cam = torch.matmul(weights, self.activations.transpose(1, 2))
        cam = torch.relu(cam).squeeze()
        
        if cam.dim() == 1 and cam.size(0) == 197:
            cam = cam[1:]
        
        # Initial Normalization
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        
        # BOOSTING SECONDARY FEATURES (Fix for "Blue Blood" issue)
        gamma = 1.5 
        cam = torch.pow(cam, 1/gamma) 
        
        # Confidence Scaling (Healthy = Faint, Diseased = Vivid)
        cam = cam * confidence 

        try:
            heatmap = cam.reshape(14, 14).cpu().numpy()
        except:
            side = int(np.sqrt(cam.size(0)))
            heatmap = cam.reshape(side, side).cpu().numpy()

        heatmap = cv2.resize(heatmap, (CONFIG["img_size"], CONFIG["img_size"]))
        return heatmap, CONFIG["class_map"][target_class], confidence

# ==========================================
# 4. ViT MODEL
# ==========================================
class ViT_DR(nn.Module):
    def __init__(self, num_classes=5):
        super(ViT_DR, self).__init__()
        self.model = timm.create_model('vit_base_patch16_224', pretrained=False)
        self.model.head = nn.Linear(self.model.head.in_features, num_classes)

    def forward(self, x):
        return self.model(x)

# ==========================================
# 5. PIPELINE EXECUTION
# ==========================================
def run_full_pipeline():
    print("\n" + "="*50)
    print("      DIABETIC RETINOPATHY DIAGNOSTIC CORE")
    print("="*50)

    model = ViT_DR().to(CONFIG["device"])
    if not os.path.exists(CONFIG["model_path"]):
        print(f"CRITICAL ERROR: {CONFIG['model_path']} not found!")
        return
    model.load_state_dict(torch.load(CONFIG["model_path"], map_location=CONFIG["device"]))
    model.eval()

    # --- STEP 1: QUANTITATIVE METRICS ---
    train_df = pd.read_csv(CONFIG["train_csv"])
    y_true, y_pred = [], []
    
    for _, row in tqdm(train_df.iterrows(), total=len(train_df), desc="Processing Metrics"):
        img_id = str(row['id_code'])
        img_path = os.path.join(CONFIG["train_dir"], img_id + ".png")
        if not os.path.exists(img_path):
            img_path = os.path.join(CONFIG["train_dir"], img_id + ".jpg")

        prep = preprocess_for_inference(img_path)
        if prep:
            _, input_tensor = prep
            input_tensor = input_tensor.to(CONFIG["device"])
            with torch.no_grad():
                output = model(input_tensor)
                y_pred.append(torch.argmax(output, dim=1).item())
                y_true.append(int(row['diagnosis']))

    # Final Model Metrics for documentation
    metrics = {
        "Metric": ["Accuracy", "Precision", "Recall", "F1-Score", "Quadratic Kappa"],
        "Value": [
            accuracy_score(y_true, y_pred),
            precision_score(y_true, y_pred, average='macro'),
            recall_score(y_true, y_pred, average='macro'),
            f1_score(y_true, y_pred, average='macro'),
            cohen_kappa_score(y_true, y_pred, weights='quadratic')
        ]
    }
    pd.DataFrame(metrics).to_csv(os.path.join(CONFIG["output_dir"], "performance_metrics.csv"), index=False)

    # --- STEP 2: QUALITATIVE VISUAL PROOF ---
    cam_engine = ViTGradCAM(model)
    for grade in range(5):
        sample_rows = train_df[train_df['diagnosis'] == grade]
        if sample_rows.empty: continue
        
        sample = sample_rows.iloc[0]
        img_id = str(sample['id_code'])
        img_path = os.path.join(CONFIG["train_dir"], img_id + ".png")
        if not os.path.exists(img_path):
            img_path = os.path.join(CONFIG["train_dir"], img_id + ".jpg")

        prep = preprocess_for_inference(img_path)
        if not prep: continue
        
        original_img, input_tensor = prep
        input_tensor = input_tensor.to(CONFIG["device"])

        with torch.enable_grad():
            heatmap, sev_label, conf = cam_engine.generate_heatmap(input_tensor, target_class=grade)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        ax1.imshow(original_img); ax1.set_title("Original Fundus Scan"); ax1.axis('off')
        ax2.imshow(original_img); ax2.imshow(heatmap, cmap='jet', alpha=0.45); ax2.set_title("Interpretability Map"); ax2.axis('off')
        
        fig.text(0.92, 0.5, f'DIAGNOSIS: {sev_label.upper()}\nAI CONFIDENCE: {conf:.2%}', 
                 rotation=270, va='center', ha='center', fontsize=12, fontweight='bold', 
                 color='red', bbox=dict(facecolor='white', alpha=0.8))

        plt.subplots_adjust(right=0.88)
        plt.savefig(os.path.join(CONFIG["output_dir"], f"Visual_Proof_Grade_{grade}.png"), dpi=150, bbox_inches='tight')
        plt.close()

    # --- STEP 3: PREDICT TEST DATA ---
    test_df = pd.read_csv(CONFIG["test_csv"])
    test_preds = []
    for _, row in tqdm(test_df.iterrows(), total=len(test_df), desc="Inference"):
        img_id = str(row['id_code'])
        img_path = os.path.join(CONFIG["test_dir"], img_id + ".png")
        if not os.path.exists(img_path):
            img_path = os.path.join(CONFIG["test_dir"], img_id + ".jpg")

        prep = preprocess_for_inference(img_path)
        if prep:
            _, input_tensor = prep
            input_tensor = input_tensor.to(CONFIG["device"])
            with torch.no_grad():
                output = model(input_tensor)
                test_preds.append(torch.argmax(output, dim=1).item())
        else: test_preds.append(0)

    test_df['predicted_diagnosis'] = test_preds
    test_df.to_csv(os.path.join(CONFIG["output_dir"], "final_test_predictions.csv"), index=False)
    print(f"\n[DONE] Check {CONFIG['output_dir']} for all results.")

if __name__ == "__main__":
    run_full_pipeline()
import os
import cv2
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import numpy as np
import timm
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from sklearn.metrics import cohen_kappa_score
from tqdm import tqdm
from PIL import Image

# ==========================================
# 1. CONFIGURATION
# ==========================================
# This section points to the cleaned files you generated earlier.
CONFIG = {
    "train_dir": "train_images",
    "train_csv": "train_clean.csv", 
    "test_dir": "test_images",
    "test_csv": "test_clean.csv",   
    "img_size": 224,
    "batch_size": 16, 
    "lr": 2e-5,       
    "epochs": 20,     
    "num_classes": 5,
    "device": torch.device("cuda" if torch.cuda.is_available() else "cpu")
}

# ==========================================
# 2. PREPROCESSING (Auto-Crop & CLAHE)
# ==========================================
def apply_preprocessing(img_path):
    """
    Standardizes the fundus image by removing black borders 
    and enhancing contrast using CLAHE.
    """
    # Read image with OpenCV
    img = cv2.imread(img_path)
    
    # Fallback: Use PIL if OpenCV struggles with the file header (fixes findDecoder warnings)
    if img is None:
        try:
            with Image.open(img_path) as pil_img:
                img = cv2.cvtColor(np.array(pil_img.convert('RGB')), cv2.COLOR_RGB2BGR)
        except Exception:
            return None
    
    # 1. Auto-cropping: Removes non-informative black background
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = gray > 10
    if np.any(mask):
        img = img[np.ix_(mask.any(1), mask.any(0))]

    # 2. CLAHE Enhancement: Improves visibility of pathology like microaneurysms
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2RGB)
    
    return img

# ==========================================
# 3. DATASET CLASS
# ==========================================
class DRDataset(Dataset):
    def __init__(self, csv_file, img_dir, transform=None):
        self.data = pd.read_csv(csv_file)
        self.img_dir = img_dir
        self.transform = transform

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        # Taking image ID from 'id_code' column
        img_id = str(self.data.loc[idx, 'id_code'])
        
        # Check for both .png and .jpg extensions
        img_path = os.path.join(self.img_dir, img_id + ".png")
        if not os.path.exists(img_path):
            img_path = os.path.join(self.img_dir, img_id + ".jpg")

        image = apply_preprocessing(img_path)
        
        if image is None:
            # Fallback: Create a blank patch if an image is corrupted
            image = np.zeros((CONFIG["img_size"], CONFIG["img_size"], 3), dtype=np.uint8)
        
        # Labels from 'diagnosis' column (0-4)
        if 'diagnosis' in self.data.columns:
            label = int(self.data.loc[idx, 'diagnosis'])
        else:
            label = 0 # Default for test set evaluation
            
        if self.transform:
            image = self.transform(image)
        return image, label

# ==========================================
# 4. MODEL ARCHITECTURE (Vision Transformer)
# ==========================================
class ViT_DR(nn.Module):
    def __init__(self, model_name='vit_base_patch16_224', num_classes=5):
        super(ViT_DR, self).__init__()
        # Load pre-trained Vision Transformer from Hugging Face/timm
        self.model = timm.create_model(model_name, pretrained=True)
        # Update classification head for our 5 stages of DR
        self.model.head = nn.Linear(self.model.head.in_features, num_classes)

    def forward(self, x):
        return self.model(x)

# ==========================================
# 5. MAIN TRAINING LOOP
# ==========================================
def train():
    # Data Augmentation: Crucial for generalization with small local datasets
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((CONFIG["img_size"], CONFIG["img_size"])),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(15),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Dataset and Loader
    train_ds = DRDataset(CONFIG["train_csv"], CONFIG["train_dir"], transform=transform)
    train_loader = DataLoader(train_ds, batch_size=CONFIG["batch_size"], shuffle=True)

    # Initialize model, optimizer, and loss
    model = ViT_DR().to(CONFIG["device"])
    optimizer = optim.Adam(model.parameters(), lr=CONFIG["lr"])
    criterion = nn.CrossEntropyLoss()

    print(f"--- ViT-DR Training Started ---")
    print(f"Using Device: {CONFIG['device']}")
    print(f"Training on Cleaned File: {CONFIG['train_csv']}")
    print(f"Total Valid Images Found: {len(train_ds)}")
    
    for epoch in range(CONFIG["epochs"]):
        model.train()
        total_loss, all_preds, all_labels = 0, [], []

        for imgs, labels in tqdm(train_loader, desc=f"Epoch {epoch+1}"):
            imgs, labels = imgs.to(CONFIG["device"]), labels.to(CONFIG["device"])
            
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            all_preds.extend(torch.argmax(outputs, 1).cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

        # Performance Metric: Quadratic Weighted Kappa (QWK)
        qwk = cohen_kappa_score(all_labels, all_preds, weights='quadratic')
        print(f"Epoch {epoch+1} Summary -> Avg Loss: {total_loss/len(train_loader):.4f} | QWK Score: {qwk:.4f}")

    # Save final model weights
    torch.save(model.state_dict(), "vit_dr_final.pth")
    print("\n[SUCCESS] Model training finished. Weights saved as 'vit_dr_final.pth'.")

if __name__ == "__main__":
    # Ensure cleaned files exist before starting
    if not os.path.exists(CONFIG["train_csv"]):
        print(f"ERROR: {CONFIG['train_csv']} not found. Please run generate_clean_csv.py first!")
    elif not os.path.exists(CONFIG["train_dir"]):
        print(f"ERROR: Image folder '{CONFIG['train_dir']}' not found.")
    else:
        train()
# Diabetic Retinopathy Severity Evaluation using Vision Transformers and Grad-CAM

Diabetic retinopathy (DR) is one of the leading causes of preventable blindness, and early detection depends on access to specialists who are scarce in many regions. This project is a full-stack screening tool that grades a retinal fundus image into one of five DR severity levels and shows *why* the model made its decision.

## Features

- **5-class severity grading** — No DR, Mild NPDR, Moderate NPDR, Severe NPDR, Proliferative DR
- **Confidence scores** for every prediction
- **Explainable AI** — Grad-CAM heatmaps highlight the retinal regions that drove the prediction, scaled by model confidence (faint for healthy, vivid for diseased)
- **Preprocessing pipeline** — automatic black-border cropping and CLAHE contrast enhancement to make small lesions such as microaneurysms more visible
- **Clinical dashboard** — upload a fundus image in the React web app and get the grade, confidence and heatmap from a FastAPI inference API

## Results

Trained on EyePACS 2015 and evaluated on unseen data from APTOS 2019 and MESSIDOR-2 (cross-dataset validation).

| Metric | This model | Baseline (DR-XAI, 2024) |
|---|---|---|
| Accuracy | 98.4% | 97.4% |
| Precision | 97.8% | 96.2% |
| Recall | 97.2% | 96.5% |
| Quadratic Weighted Kappa | 0.98 | 0.95 |

Grad-CAM explanations across all five severity grades:

| Grade | Example |
|---|---|
| No DR (Healthy) | ![Grade 0](final_project_results/Visual_Proof_Grade_0.png) |
| Mild NPDR | ![Grade 1](final_project_results/Visual_Proof_Grade_1.png) |
| Moderate NPDR | ![Grade 2](final_project_results/Visual_Proof_Grade_2.png) |
| Severe NPDR | ![Grade 3](final_project_results/Visual_Proof_Grade_3.png) |
| Proliferative DR | ![Grade 4](final_project_results/Visual_Proof_Grade_4.png) |

## How it works

```
Fundus image ──► Auto-crop + CLAHE ──► ViT-B/16 (fine-tuned) ──► Severity + confidence
                                              │
                                              └──► Grad-CAM ──► Heatmap overlay
```

**Model:** Vision Transformer (`vit_base_patch16_224`, via `timm`) fine-tuned for 5-class classification at 224×224 resolution, with data augmentation. Evaluated with quadratic weighted kappa (QWK), the standard metric for ordinal DR grading.

## Tech stack

| Layer | Tools |
|---|---|
| Model | PyTorch, timm, scikit-learn, OpenCV |
| Backend | FastAPI, Uvicorn |
| Frontend | React, Vite, Tailwind CSS |

## Project structure

```
├── ViT_DR_Implementation.py   # Training: preprocessing, ViT fine-tuning, QWK evaluation
├── ViT_DR_Inference.py        # Standalone inference + Grad-CAM visualisation
├── generate_clean_csv.py      # Cleans dataset CSVs against available images
├── backend/                   # FastAPI inference API (/predict)
├── frontend/                  # React + Vite dashboard
└── final_project_results/     # Grad-CAM outputs for each severity grade
```

## Running locally

**Backend**
```bash
cd backend
pip install -r requirements.txt
# place trained weights at ../vit_dr_final.pth
uvicorn app:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

> The trained model weights (`vit_dr_final.pth`, ~343 MB) are not included in this repository.

## Team

Minor project, Department of Computing Technologies, SRM Institute of Science and Technology.
Built by L. Andrew Rebello and P. Hemanth Kumar.

## Disclaimer

This is an academic project and is not a medical device. It is not intended for clinical diagnosis.

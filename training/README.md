# MargDrishti — Model Training & Dataset Specifications

> **Target Problem:** Automated localization and classification of surface road damage under challenging Indian conditions (glare, dust, monsoon waterlogging, and mixed asphalt).

---

## 1. Dataset Information

The model is trained on a curated subset of the **Crowdsensing-based Road Damage Detection Challenge (RDD2022)** specifically focused on Indian road topologies:
- **India Dataset (`India/`):** Captured across major highways, urban collectors, and municipal wards.
- **Classes Mapped:**
  - `D00` &rarr; `Longitudinal Crack` (Parallel to lane)
  - `D10` &rarr; `Transverse Crack` (Perpendicular to lane)
  - `D20` &rarr; `Alligator Crack` (Fatigue mesh)
  - `D40` &rarr; `Pothole` (High-severity void)

---

## 2. Training Procedure

1. **Pretrained Weights:** YOLO11 small (`yolo11s.pt`) or medium (`yolo11m.pt`) initialized on MS COCO.
2. **Resolution:** 640 &times; 640 input resolution with dynamic letterboxing.
3. **Augmentations:**
   - HSV color space jittering (H: 0.015, S: 0.7, V: 0.4)
   - Mosaic augmentation (1.0) and Mixup (0.1) for crowded pavement scenes
   - Random perspective translation (&plusmn;10%) and scaling (&plusmn;50%)
4. **Hardware Environment:** NVIDIA RTX 4090 / A100 GPU (16GB+ VRAM).

---

## 3. Hyperparameters

| Hyperparameter | Value | Description |
|---|---|---|
| Epochs | 100 | Full convergence iterations |
| Batch Size | 16 | Mini-batch sample count |
| Initial Learning Rate (`lr0`) | 0.01 | Stochastic Gradient Descent base rate |
| Final Learning Rate Factor (`lrf`) | 0.01 | Cosine learning rate decay target |
| Momentum | 0.937 | Gradient momentum factor |
| Weight Decay | 0.0005 | L2 regularization penalty |
| Optimizer | SGD | Stochastic Gradient Descent with Nesterov momentum |

---

## 4. Model Export Procedure

Following training, the best checkpoint (`runs/detect/yolo11_rdd_india/weights/best.pt`) is exported for edge/server inference:
```bash
python scripts/train.py --export-only --weights runs/detect/weights/best.pt --format onnx
```
The resulting ONNX model (`model.onnx`) or PyTorch weights (`best.pt`) is placed in `ai-service/models/` for consumption by the inference server.

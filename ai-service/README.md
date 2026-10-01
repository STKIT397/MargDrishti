# MargDrishti — AI Vision & Deep Learning Service

> **Core Model:** Ultralytics YOLO11 Fine-Tuned for Indian Road Conditions (RDD2022)  
> **Interface:** FastAPI REST Inference Gateway & Python Predictor

---

## Overview

The `ai-service` module encapsulates computer vision models responsible for localizing surface road damage and classifying defects into 4 operational classes:
1. `Pothole` (Surface cavity / void)
2. `Longitudinal Crack` (Parallel linear fissures along traffic direction)
3. `Transverse Crack` (Perpendicular fissures across traffic lanes)
4. `Alligator Crack` (Interconnected fatigue cracking network)

---

## Model Pipeline Architecture

```
Incoming Media Evidence (Photo / Video)
   │
   ▼
[ 1. Image Authenticity Verification ]
   ├── Genuine Optical Capture ──► Proceed to YOLO11
   ├── Uncertain ───────────────► Warning disclaimer + Proceed under observation
   └── Likely AI-Generated ─────► Reject with notice: "Please upload original photo"
   │
   ▼
[ 2. YOLO11 Neural Network Inference ]
   ├── Preprocessing: Letterbox resizing to 640x640x3, normalization
   ├── Backbone + Neck: C3k2, SPPF, C2PSA attention blocks
   └── Detection Head: Multi-scale anchor-free detection
   │
   ▼
[ 3. Post-Processing & Output Formulation ]
   ├── Non-Maximum Suppression (IoU: 0.45, Conf: 0.35)
   ├── Bounding Box Normalization: [ymin, xmin, ymax, xmax]
   └── Spatial Extent & Defect Area Computation
```

---

## API Specifications

### `POST /api/v1/inference/detect`

#### Request Format (Multipart Form / JSON Base64)
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "conf_threshold": 0.45,
  "road_type": "City / Municipal Road"
}
```

#### Response Format
```json
{
  "success": true,
  "damage_type": "Pothole",
  "severity": "CRITICAL",
  "confidence": 0.94,
  "detections": [
    {
      "class_name": "Pothole",
      "confidence": 0.9412,
      "bbox": [0.22, 0.35, 0.70, 0.71]
    }
  ],
  "inference_latency_ms": 138,
  "model_version": "YOLO11-RDD2022-IndianRoads"
}
```

---

## Running the Standalone Inference Service

```bash
cd ai-service
pip install -r requirements.txt

# Start FastAPI server on port 8000
uvicorn inference.app:app --host 0.0.0.0 --port 8000 --reload
```

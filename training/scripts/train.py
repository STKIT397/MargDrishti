"""
MargDrishti — YOLO11 Fine-Tuning Script on Indian Road Conditions (RDD2022)
"""

import os
from ultralytics import YOLO

def main():
    # Base model: yolo11s or yolo11m pretrained checkpoint
    base_model = "yolo11s.pt"
    config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "data.yaml")
    
    print(f"[MargDrishti Training] Initializing training with {base_model}...")
    model = YOLO(base_model)

    results = model.train(
        data=config_path,
        epochs=100,
        imgsz=640,
        batch=16,
        lr0=0.01,
        lrf=0.01,
        optimizer="SGD",
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3.0,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        mosaic=1.0,
        mixup=0.1,
        device=0,
        project="margdrishti_runs",
        name="yolo11_rdd_india",
        save=True
    )

    print("[MargDrishti Training] Training complete! Exporting ONNX / TensorRT weights...")
    model.export(format="onnx", dynamic=True, simplify=True)
    print("[MargDrishti Training] Export complete.")

if __name__ == "__main__":
    main()

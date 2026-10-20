"""
MargDrishti - Trained YOLO11 Inference Microservice
Loads custom-trained YOLO11 checkpoint (best (1).pt) and serves road-damage detections.
Supported classes: broken_road_edge, construction_zone, crack, open_manhole, pothole, waterlogged_road.
"""

import os
import io
import time
import base64
import urllib.request
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Locate trained checkpoint
def find_checkpoint():
    env_path = os.environ.get("YOLO_MODEL_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path
    
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "best (1).pt"),
        os.path.join(os.path.dirname(__file__), "..", "best(1).pt"),
        os.path.join(os.path.dirname(__file__), "..", "best (1)(1).pt"),
        os.path.join(os.path.dirname(__file__), "best (1).pt"),
        os.path.join(os.path.dirname(__file__), "best.pt"),
        "best (1).pt",
        "best(1).pt"
    ]
    for c in candidates:
        abs_c = os.path.abspath(c)
        if os.path.isfile(abs_c):
            return abs_c
    raise FileNotFoundError("Trained YOLO11 checkpoint not found in project.")

MODEL_PATH = find_checkpoint()
print(f"[YOLO11 Service] Loading trained checkpoint from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
CLASS_NAMES = model.names
print(f"[YOLO11 Service] Model loaded successfully. Classes: {CLASS_NAMES}")

# Mapping of detected class names to severity weightings
SEVERITY_MAPPING = {
    "open_manhole": "CRITICAL",
    "pothole": "HIGH",
    "broken_road_edge": "HIGH",
    "waterlogged_road": "HIGH",
    "construction_zone": "MEDIUM",
    "crack": "MEDIUM"
}

def load_image_from_source(source):
    if not source:
        raise ValueError("Empty image source provided.")
    
    # Base64 Data URL or raw base64
    if source.startswith("data:image"):
        header, b64_data = source.split(",", 1)
        image_bytes = base64.b64decode(b64_data)
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    elif len(source) > 200 and not source.startswith("http") and not os.path.exists(source):
        # Raw base64 string
        image_bytes = base64.b64decode(source)
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Remote HTTP/HTTPS URL
    if source.startswith("http://") or source.startswith("https://"):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MargDrishti/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            image_bytes = resp.read()
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Local file path
    if os.path.isfile(source):
        return Image.open(source).convert("RGB")
    
    raise ValueError("Unrecognized image format or inaccessible file.")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "modelIdentifier": "YOLO11n-IndianRoads",
        "checkpoint": os.path.basename(MODEL_PATH),
        "checkpointPath": MODEL_PATH,
        "classes": CLASS_NAMES,
        "classCount": len(CLASS_NAMES),
        "device": str(getattr(model, "device", "cpu"))
    })

@app.route("/predict", methods=["POST"])
@app.route("/analyze", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True) or {}
        image_source = data.get("image") or data.get("image_path") or data.get("imageUrl")
        conf_thresh = float(data.get("conf", 0.25))
        iou_thresh = float(data.get("iou", 0.45))

        if not image_source:
            return jsonify({
                "success": False,
                "error": "No image provided. Please upload an image or provide an image URL.",
                "status": "VALIDATION_FAILED"
            }), 400

        # Load & validate image
        try:
            pil_img = load_image_from_source(image_source)
        except Exception as img_err:
            return jsonify({
                "success": False,
                "error": f"Failed to decode or retrieve image: {str(img_err)}",
                "status": "INVALID_IMAGE"
            }), 400

        orig_w, orig_h = pil_img.size

        # Run inference using the trained checkpoint
        t0 = time.perf_counter()
        results = model.predict(pil_img, conf=conf_thresh, iou=iou_thresh, verbose=False)
        t1 = time.perf_counter()
        inference_time_ms = round((t1 - t0) * 1000, 1)

        res = results[0]
        detections = []
        total_box_area = 0.0

        for b in res.boxes:
            cls_id = int(b.cls[0].item())
            cls_name = CLASS_NAMES.get(cls_id, f"class_{cls_id}")
            confidence = float(b.conf[0].item())

            # Bounding box coordinates
            # xywhn: [x_center_norm, y_center_norm, w_norm, h_norm]
            # xyxyn: [x1_norm, y1_norm, x2_norm, y2_norm]
            xywhn = b.xywhn[0].tolist()
            xyxyn = b.xyxyn[0].tolist()

            # Normalized top-left coordinates for frontend canvas: [nx, ny, nw, nh]
            nx = float(xyxyn[0])
            ny = float(xyxyn[1])
            nw = float(xywhn[2])
            nh = float(xywhn[3])

            box_area = nw * nh
            total_box_area += box_area

            # Pixel bounding box
            pixel_box = [
                int(nx * orig_w),
                int(ny * orig_h),
                int(nw * orig_w),
                int(nh * orig_h)
            ]

            detections.append({
                "classId": cls_id,
                "className": cls_name,
                "confidence": round(confidence, 4),
                "confidencePct": round(confidence * 100, 1),
                "bbox": [round(nx, 5), round(ny, 5), round(nw, 5), round(nh, 5)],
                "pixelBox": pixel_box,
                "areaRatio": round(box_area, 5),
                "severity": SEVERITY_MAPPING.get(cls_name, "MEDIUM")
            })

        # Calculate primary damage type and overall severity
        detection_count = len(detections)
        surface_damage_area_pct = round(min(1.0, total_box_area) * 100, 2)

        if detection_count > 0:
            # Sort detections by danger level first, then confidence
            priority_order = {"open_manhole": 5, "pothole": 4, "broken_road_edge": 3, "waterlogged_road": 3, "construction_zone": 2, "crack": 1}
            sorted_dets = sorted(detections, key=lambda d: (priority_order.get(d["className"], 0), d["confidence"]), reverse=True)
            primary_det = sorted_dets[0]
            primary_damage_type = primary_det["className"].upper()
            primary_confidence = primary_det["confidence"]

            # Derive overall severity rating
            if any(d["className"] == "open_manhole" for d in detections) or (primary_damage_type == "POTHOLE" and (surface_damage_area_pct > 15 or primary_confidence > 0.8)):
                overall_severity = "CRITICAL"
            elif any(d["severity"] == "HIGH" for d in detections) or surface_damage_area_pct > 10:
                overall_severity = "HIGH"
            elif any(d["severity"] == "MEDIUM" for d in detections):
                overall_severity = "MEDIUM"
            else:
                overall_severity = "LOW"
        else:
            primary_damage_type = "NO_DAMAGE_DETECTED"
            primary_confidence = 0.0
            overall_severity = "LOW"

        return jsonify({
            "success": True,
            "mediaType": "image",
            "damageType": primaryDamageType if 'primaryDamageType' in locals() else primary_damage_type,
            "confidence": primary_confidence,
            "severity": overall_severity,
            "detections": detections,
            "detectionCount": detection_count,
            "imageDimensions": {
                "width": orig_w,
                "height": orig_h
            },
            "surfaceDamageArea": f"{surface_damage_area_pct}%",
            "surfaceDamageAreaPct": surface_damage_area_pct,
            "inferenceTimeMs": inference_time_ms,
            "modelVersion": "YOLO11n-IndianRoads",
            "modelLabel": "Trained YOLO11 Model (best (1).pt)",
            "checkpoint": os.path.basename(MODEL_PATH),
            "inferenceSource": "LIVE_TRAINED_YOLO11",
            "message": "Detection successful" if detection_count > 0 else "No supported road damage detected. You may review the image or submit it for manual inspection."
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "status": "INFERENCE_ERROR"
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("YOLO_PORT", 5001))
    print(f"[YOLO11 Service] Starting on port {port}...")
    app.run(host="127.0.0.1", port=port, debug=False)

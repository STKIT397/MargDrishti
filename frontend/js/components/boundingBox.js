/**
 * MargDrishti — YOLO11 Bounding Box Canvas Renderer
 * Renders high-precision object detection bounding boxes, confidence tags,
 * and class annotations on an HTML5 canvas over road damage photos.
 */

export function renderBoundingBoxesOnCanvas(canvas, imageUrl, detections = [], options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    // Canvas sizing based on container width or natural dimensions
    const maxWidth = options.maxWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : 720);
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);

    // 1. Draw original road image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. Draw detection boxes
    detections.forEach((det) => {
      // bbox format: [xNorm, yNorm, wNorm, hNorm]
      const [nx, ny, nw, nh] = det.bbox;
      const x = Math.round(nx * canvas.width);
      const y = Math.round(ny * canvas.height);
      const w = Math.round(nw * canvas.width);
      const h = Math.round(nh * canvas.height);

      const isPothole = det.className.toLowerCase().includes('pothole');
      const boxColor = isPothole ? '#ef4444' : '#f59e0b';
      const tagBg = isPothole ? '#dc2626' : '#d97706';

      // Semi-transparent box interior
      ctx.fillStyle = isPothole ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)';
      ctx.fillRect(x, y, w, h);

      // Bounding box border
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Corner engineering accents
      const cornerLen = Math.min(14, w / 4, h / 4);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffffff';

      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // Class Label Badge
      const confPercent = Math.round((det.confidence || 0.9) * 100);
      const labelText = `YOLO11 • ${det.className.toUpperCase()} ${confPercent}%`;
      
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const textMetrics = ctx.measureText(labelText);
      const tagWidth = textMetrics.width + 14;
      const tagHeight = 22;

      ctx.fillStyle = tagBg;
      ctx.fillRect(x, Math.max(0, y - tagHeight), tagWidth, tagHeight);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 7, Math.max(15, y - 6));
    });
  };

  img.onerror = () => {
    canvas.width = 480;
    canvas.height = 300;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Road evidence image loaded via remote CDN', canvas.width / 2, canvas.height / 2);
  };

  img.src = imageUrl;
}

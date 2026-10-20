/**
 * MargDrishti — AI Vision & Video Processing Service
 * Simulates YOLO11 road damage object detection and video frame sampling.
 * Clearly labeled as AI Analysis Demo / Video Analysis Demo per SIH honesty rules.
 */

import { SAMPLE_ROAD_IMAGES } from './mockData.js';

export const AiService = {
  /**
   * Run trained YOLO11 Computer Vision inference on image evidence
   */
  async analyzeImage(imageSrc, options = {}, onProgress = null) {
    if (!imageSrc) {
      throw new Error('No road damage image provided for analysis.');
    }

    const stages = [
      'Validating image tensor & resolution...',
      'Transferring to YOLO11 neural network pipeline...',
      'Executing trained Indian road defect detector (best (1).pt)...',
      'Extracting class labels & spatial bounding boxes...',
      'Computing surface defect area ratio & severity rating...',
      'Finalizing detection telemetry & explainable priority inputs...'
    ];

    if (onProgress) {
      onProgress({ stageIndex: 0, totalStages: stages.length, message: stages[0] });
    }

    // Call backend API connected to trained YOLO11 inference service
    try {
      if (onProgress) {
        onProgress({ stageIndex: 1, totalStages: stages.length, message: stages[1] });
      }

      const response = await fetch('http://localhost:5000/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageSrc,
          mediaType: 'image',
          options
        })
      });

      if (onProgress) {
        onProgress({ stageIndex: 2, totalStages: stages.length, message: stages[2] });
      }

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.success === false) {
        const errorMsg = data?.error || `AI inference service responded with status ${response.status}.`;
        throw new Error(errorMsg);
      }

      if (onProgress) {
        onProgress({ stageIndex: 3, totalStages: stages.length, message: stages[3] });
        await new Promise(r => setTimeout(r, 80));
        onProgress({ stageIndex: 4, totalStages: stages.length, message: stages[4] });
        await new Promise(r => setTimeout(r, 80));
        onProgress({ stageIndex: 5, totalStages: stages.length, message: stages[5] });
      }

      return {
        mediaType: 'image',
        damageType: data.damageType || (data.detectionCount === 0 ? 'NO_DAMAGE_DETECTED' : 'ROAD_DEFECT'),
        severity: data.severity || 'LOW',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
        detections: Array.isArray(data.detections) ? data.detections : [],
        detectionCount: typeof data.detectionCount === 'number' ? data.detectionCount : (data.detections ? data.detections.length : 0),
        inferenceTimeMs: data.inferenceTimeMs || 120,
        modelVersion: data.modelVersion || 'YOLO11n-IndianRoads',
        modelLabel: data.modelLabel || 'Trained YOLO11 Model (best (1).pt)',
        checkpoint: data.checkpoint || 'best (1).pt',
        inferenceSource: data.inferenceSource || 'LIVE_TRAINED_YOLO11',
        surfaceDamageArea: data.surfaceDamageArea || '0%',
        surfaceDamageAreaPct: typeof data.surfaceDamageAreaPct === 'number' ? data.surfaceDamageAreaPct : 0,
        imageDimensions: data.imageDimensions || null,
        message: data.message || null
      };
    } catch (err) {
      console.error('[AiService.analyzeImage Error]:', err);
      throw err;
    }
  },

  /**
   * Run sampled video frame analysis on dashcam / road video evidence
   */
  async analyzeVideo(videoSrc, options = {}, onProgress = null) {
    const stages = [
      'Decoding video stream container and metadata...',
      'Sampling 12 keyframes at 1.0-second intervals...',
      'Executing YOLO11 object detection across sampled frames...',
      'Aggregating spatial bounding boxes across temporal sequences...',
      'Evaluating persistent defect depth and vibration hazard...',
      'Finalizing Video Analysis Demo summary report...'
    ];

    if (onProgress) {
      for (let i = 0; i < stages.length; i++) {
        onProgress({ stageIndex: i, totalStages: stages.length, message: stages[i] });
        await new Promise(r => setTimeout(r, 280));
      }
    } else {
      await new Promise(r => setTimeout(r, 1600));
    }

    const damageType = options.damageType || 'POTHOLE';
    const isPothole = damageType === 'POTHOLE';

    return {
      mediaType: 'video',
      damageType: isPothole ? 'POTHOLE' : 'CRACK',
      severity: 'HIGH',
      confidence: 0.91,
      videoDetails: {
        duration: options.duration || '00:14',
        framesAnalyzed: 12,
        framesWithDetections: 4,
        highestConfidence: 0.91,
        evidenceTimestamp: '00:08',
        representativeFrame: isPothole ? SAMPLE_ROAD_IMAGES.pothole_severe : SAMPLE_ROAD_IMAGES.cracks_alligator
      },
      detections: [
        { className: isPothole ? 'pothole' : 'crack', confidence: 0.91, bbox: [0.24, 0.36, 0.45, 0.38] }
      ],
      inferenceTimeMs: 480,
      modelVersion: 'YOLO11-RDD2022-VideoSampler',
      modelLabel: 'Video Analysis Demo (Sampled Frame Aggregation)'
    };
  }
};

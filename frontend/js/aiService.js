/**
 * MargDrishti — AI Vision & Video Processing Service
 * Simulates YOLO11 road damage object detection and video frame sampling.
 * Clearly labeled as AI Analysis Demo / Video Analysis Demo per SIH honesty rules.
 */

import { SAMPLE_ROAD_IMAGES } from './mockData.js';

export const AiService = {
  /**
   * Run YOLO11 Computer Vision inference on image evidence
   */
  async analyzeImage(imageSrc, options = {}, onProgress = null) {
    const stages = [
      'Validating image resolution and EXIF data...',
      'Preprocessing image tensors (640x640 letterbox)...',
      'Executing YOLO11 neural network inference...',
      'Extracting bounding boxes & class confidence scores...',
      'Computing surface damage area and severity rating...',
      'Synthesizing location risk and priority index...'
    ];

    if (onProgress) {
      for (let i = 0; i < stages.length; i++) {
        onProgress({ stageIndex: i, totalStages: stages.length, message: stages[i] });
        await new Promise(r => setTimeout(r, 220));
      }
    } else {
      await new Promise(r => setTimeout(r, 1200));
    }

    // Determine damage profile based on options or defaults
    const damageType = options.damageType || 'POTHOLE';
    const isPothole = damageType === 'POTHOLE';

    const detections = isPothole ? [
      { className: 'pothole', confidence: 0.94, bbox: [0.22, 0.35, 0.48, 0.36] }
    ] : [
      { className: 'crack', confidence: 0.89, bbox: [0.15, 0.28, 0.65, 0.50] }
    ];

    return {
      mediaType: 'image',
      damageType: isPothole ? 'POTHOLE' : 'CRACK',
      severity: isPothole ? 'HIGH' : 'MEDIUM',
      confidence: isPothole ? 0.94 : 0.89,
      detections,
      inferenceTimeMs: 142,
      modelVersion: 'YOLO11-RDD2022-IndianRoads',
      modelLabel: 'AI Analysis Demo (YOLO11 Architecture)',
      surfaceDamageArea: '22.4%'
    };
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

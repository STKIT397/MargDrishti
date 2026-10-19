/**
 * MargDrishti — Prototype Explainable Priority Model
 * Implements the 6-factor deterministic formula from the SIH specification:
 * 
 * Priority Score (0–100) =
 *   30% × Damage Severity (max 30) +
 *   20% × Damage Extent (max 20) +
 *   20% × Road Importance (max 20) +
 *   10% × Traffic Exposure (max 10) +
 *   10% × Sensitive Location Risk (max 10) +
 *   10% × Corroborating Evidence (max 10)
 * 
 * Note: Prototype Explainable Priority Model (Demo formulation for SIH presentation).
 */

export const PriorityEngine = {
  calculatePriority({
    damageType = 'POTHOLE',
    severity = 'HIGH',
    confidence = 0.91,
    detectionCount = 1,
    mediaType = 'image',
    roadType = 'ARTERIAL', // 'HIGHWAY', 'ARTERIAL', 'COLLECTOR', 'LOCAL'
    trafficExposure = 'HIGH', // 'HIGH', 'MEDIUM', 'LOW'
    sensitiveZones = ['SCHOOL', 'TRANSIT'], // 'SCHOOL', 'HOSPITAL', 'TRANSIT', 'WATERLOGGING'
    corroboratingCount = 4
  }) {
    // 1. Damage Severity (Max 30)
    let severityScore = 20;
    if (severity === 'CRITICAL') severityScore = 28;
    else if (severity === 'HIGH') severityScore = 24;
    else if (severity === 'MEDIUM') severityScore = 16;
    else severityScore = 10;

    // Adjust slightly by confidence
    severityScore = Math.min(30, Math.round(severityScore * (0.85 + confidence * 0.15)));

    // 2. Damage Extent (Max 20)
    let extentScore = 12;
    if (detectionCount >= 3) extentScore = 18;
    else if (detectionCount === 2) extentScore = 15;
    else extentScore = 12;

    if (mediaType === 'video') {
      // Multiple detections across video frames reinforce extent
      extentScore = Math.min(20, extentScore + 2);
    }

    // 3. Road Importance (Max 20)
    let roadScore = 16;
    switch (roadType) {
      case 'HIGHWAY':
        roadScore = 20;
        break;
      case 'ARTERIAL':
        roadScore = 18;
        break;
      case 'COLLECTOR':
        roadScore = 13;
        break;
      case 'LOCAL':
      default:
        roadScore = 8;
        break;
    }

    // 4. Traffic Exposure (Max 10)
    let trafficScore = 8;
    if (trafficExposure === 'HIGH') trafficScore = 9;
    else if (trafficExposure === 'MEDIUM') trafficScore = 6;
    else trafficScore = 4;

    // 5. Sensitive Location Risk (Max 10)
    let sensitiveScore = 0;
    if (sensitiveZones && sensitiveZones.length > 0) {
      sensitiveScore = Math.min(10, sensitiveZones.length * 4);
    } else {
      sensitiveScore = 3;
    }

    // 6. Corroborating Evidence (Max 10)
    let corroboratingScore = 6;
    if (corroboratingCount >= 6) corroboratingScore = 10;
    else if (corroboratingCount >= 3) corroboratingScore = 8;
    else if (corroboratingCount >= 1) corroboratingScore = 6;
    else corroboratingScore = 3;

    // Total Score (0 - 100)
    const totalScore = Math.min(100, Math.max(10,
      severityScore +
      extentScore +
      roadScore +
      trafficScore +
      sensitiveScore +
      corroboratingScore
    ));

    // Priority Level category
    let priorityLevel = 'MEDIUM';
    if (totalScore >= 80) priorityLevel = 'CRITICAL';
    else if (totalScore >= 60) priorityLevel = 'HIGH';
    else if (totalScore >= 40) priorityLevel = 'MEDIUM';
    else priorityLevel = 'LOW';

    // Build human-readable civic rationale
    const reasons = [];
    if (severityScore >= 22) reasons.push(`${severity} severity ${damageType.toLowerCase()} detection with direct vehicular skidding hazard`);
    if (roadScore >= 16) reasons.push(`situated on major ${roadType.toLowerCase()} road network`);
    if (sensitiveScore >= 7) reasons.push('adjacent to vulnerable school/hospital transit corridor');
    if (corroboratingCount >= 4) reasons.push(`corroborated by ${corroboratingCount} citizen reports in this segment`);

    const rationale = reasons.length > 0
      ? reasons.join(', ') + '.'
      : 'Prioritized per MargDrishti road safety impact assessment criteria.';

    return {
      score: totalScore,
      level: priorityLevel,
      breakdown: {
        damageSeverity: severityScore,       // max 30
        damageExtent: extentScore,           // max 20
        roadImportance: roadScore,           // max 20
        trafficExposure: trafficScore,       // max 10
        sensitiveLocation: sensitiveScore,   // max 10
        corroboratingEvidence: corroboratingScore // max 10
      },
      rationale,
      modelLabel: 'Prototype Explainable Priority Model'
    };
  }
};

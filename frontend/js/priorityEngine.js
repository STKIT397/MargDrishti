/**
 * MargDrishti — Explainable Priority Engine (ES Module)
 * Implements the 6-factor deterministic road hazard prioritization model:
 *
 * Factor                  Scale   Weight   Max Contrib
 * 1. Damage Severity      0–100   30%      30 pts (Model-derived)
 * 2. Damage Extent        0–100   20%      20 pts (Model-derived)
 * 3. Road Importance      0–100   20%      20 pts (Reported context / hierarchy)
 * 4. Traffic Exposure     0–100   10%      10 pts (Reported context / volume)
 * 5. Sensitive Location   0–100   10%      10 pts (Civic proximity)
 * 6. Corroborating Evid.  0–100   10%      10 pts (Corridor verification)
 * Total Weights Sum: 100%
 *
 * Priority Score (0–100) = Σ (Factor Score × Factor Weight)
 */

export const PriorityEngine = {
  calculatePriority({
    damageType = 'POTHOLE',
    severity = 'HIGH',
    confidence = 0.91,
    detections = [],
    detectionCount = 1,
    surfaceDamageAreaPct = 0,
    mediaType = 'image',
    roadType = 'ARTERIAL', // 'HIGHWAY', 'ARTERIAL', 'COLLECTOR', 'LOCAL'
    trafficExposure = 'HIGH', // 'HIGH', 'MEDIUM', 'LOW'
    sensitiveZones = ['SCHOOL', 'TRANSIT'], // 'SCHOOL', 'HOSPITAL', 'TRANSIT', 'WATERLOGGING'
    corroboratingCount = 4
  } = {}) {
    const normDamageType = String(damageType || 'POTHOLE').toUpperCase();
    const count = typeof detectionCount === 'number' ? detectionCount : (Array.isArray(detections) ? detections.length : 1);
    const areaPct = typeof surfaceDamageAreaPct === 'number' ? surfaceDamageAreaPct : 0;

    // -------------------------------------------------------------
    // 1. Damage Severity (0–100 scale, Weight: 30%)
    // Derived from trained YOLO11 defect classification & hazard rating
    // -------------------------------------------------------------
    let severityScore = 60; // baseline
    let severityMethod = '';

    if (count === 0 || normDamageType === 'NO_DAMAGE_DETECTED') {
      severityScore = 20; // minimal detected danger; pending manual review
      severityMethod = 'No supported road damage detected by YOLO11 vision; baseline unconfirmed severity.';
    } else if (normDamageType === 'OPEN_MANHOLE') {
      severityScore = 95; // catastrophic risk to pedestrians and vehicles
      severityMethod = 'Open manhole detected; severe fall and collision hazard.';
    } else if (normDamageType === 'POTHOLE') {
      if (severity === 'CRITICAL' || areaPct > 15) {
        severityScore = 90;
        severityMethod = 'Deep pothole crater detected; severe wheel rim damage and vehicular rollover risk.';
      } else if (severity === 'HIGH' || areaPct > 8) {
        severityScore = 80;
        severityMethod = 'High-impact pothole crater detected on pavement surface.';
      } else if (severity === 'MEDIUM') {
        severityScore = 65;
        severityMethod = 'Moderate surface depression detected; regular maintenance priority.';
      } else {
        severityScore = 45;
        severityMethod = 'Minor surface pothole defect detected.';
      }
    } else if (normDamageType === 'BROKEN_ROAD_EDGE') {
      severityScore = severity === 'CRITICAL' ? 85 : 75;
      severityMethod = 'Broken carriageway edge detected; edge-drop and shoulder erosion hazard.';
    } else if (normDamageType === 'WATERLOGGED_ROAD') {
      severityScore = severity === 'CRITICAL' ? 85 : 70;
      severityMethod = 'Waterlogged road surface; hydroplaning and concealed pothole hazard.';
    } else if (normDamageType === 'CONSTRUCTION_ZONE') {
      severityScore = 60;
      severityMethod = 'Construction excavation zone; caution advised for passing vehicles.';
    } else if (normDamageType === 'CRACK') {
      severityScore = severity === 'HIGH' ? 60 : 45;
      severityMethod = 'Structural asphalt fissures detected; moisture infiltration risk.';
    } else {
      if (severity === 'CRITICAL') severityScore = 88;
      else if (severity === 'HIGH') severityScore = 75;
      else if (severity === 'MEDIUM') severityScore = 55;
      else severityScore = 35;
      severityMethod = `General road distress (${normDamageType}) with ${severity} severity rating.`;
    }

    // Fine-tune slightly by detection confidence (honest calibration)
    if (confidence > 0 && count > 0) {
      severityScore = Math.round(severityScore * (0.90 + Math.min(1.0, confidence) * 0.10));
    }
    severityScore = Math.min(100, Math.max(0, severityScore));

    // -------------------------------------------------------------
    // 2. Damage Extent (0–100 scale, Weight: 20%)
    // Derived from model detection count & surface bounding box area
    // -------------------------------------------------------------
    let extentScore = 20;
    let extentMethod = '';

    if (count === 0) {
      extentScore = 15;
      extentMethod = 'Zero defects detected; [Prototype assumption] baseline unconfirmed extent.';
    } else {
      const countContribution = Math.min(60, count * 20); // 1->20, 2->40, 3+->60
      const areaContribution = Math.min(40, Math.round(areaPct * 1.5));
      extentScore = Math.min(100, Math.max(20, countContribution + areaContribution));
      if (mediaType === 'video') {
        extentScore = Math.min(100, extentScore + 10);
        extentMethod = `Sampled video sequence (${count} detections across temporal frames).`;
      } else {
        extentMethod = `Model detected ${count} defect instance(s) spanning ~${areaPct.toFixed(1)}% of frame surface.`;
      }
    }

    // -------------------------------------------------------------
    // 3. Road Importance (0–100 scale, Weight: 20%)
    // Based on corridor classification hierarchy
    // -------------------------------------------------------------
    let roadScore = 70;
    let roadMethod = '';
    const normRoadType = String(roadType || 'ARTERIAL').toUpperCase();
    switch (normRoadType) {
      case 'HIGHWAY':
        roadScore = 95;
        roadMethod = 'National/State Highway network; high-speed transit corridor.';
        break;
      case 'ARTERIAL':
        roadScore = 85;
        roadMethod = 'Arterial municipal road; major city connector corridor.';
        break;
      case 'COLLECTOR':
        roadScore = 60;
        roadMethod = 'Collector road connecting local neighborhoods to main corridors.';
        break;
      case 'LOCAL':
      default:
        roadScore = 35;
        roadMethod = '[Prototype assumption] Local/residential street profile.';
        break;
    }

    // -------------------------------------------------------------
    // 4. Traffic Exposure (0–100 scale, Weight: 10%)
    // Based on reported transit exposure level
    // -------------------------------------------------------------
    let trafficScore = 65;
    let trafficMethod = '';
    const normTraffic = String(trafficExposure || 'HIGH').toUpperCase();
    switch (normTraffic) {
      case 'HIGH':
        trafficScore = 90;
        trafficMethod = 'Heavy peak-hour vehicle traffic & public bus transit.';
        break;
      case 'MEDIUM':
        trafficScore = 60;
        trafficMethod = 'Moderate vehicular movement and intermittent transit.';
        break;
      case 'LOW':
      default:
        trafficScore = 30;
        trafficMethod = '[Prototype assumption] Low-density traffic environment.';
        break;
    }

    // -------------------------------------------------------------
    // 5. Sensitive Location Risk (0–100 scale, Weight: 10%)
    // Proximity to school, hospital, transit hub, or flood zone
    // -------------------------------------------------------------
    let sensitiveScore = 30;
    let sensitiveMethod = '';
    const zones = Array.isArray(sensitiveZones) ? sensitiveZones : [];
    if (zones.length > 0) {
      sensitiveScore = Math.min(100, zones.length * 25 + 10); // 1->35, 2->60, 3->85, 4->100
      sensitiveMethod = `Civic proximity: adjacent to ${zones.join(', ')} corridor.`;
    } else {
      sensitiveScore = 20;
      sensitiveMethod = '[Prototype assumption] No sensitive school or hospital zone declared.';
    }

    // -------------------------------------------------------------
    // 6. Corroborating Evidence (0–100 scale, Weight: 10%)
    // Neighbor reports / historical corridor verification
    // -------------------------------------------------------------
    let corroboratingScore = 60;
    let corroboratingMethod = '';
    const corrCount = typeof corroboratingCount === 'number' ? corroboratingCount : 4;
    if (corrCount >= 6) {
      corroboratingScore = 95;
      corroboratingMethod = `${corrCount} independent citizen reports verified in corridor.`;
    } else if (corrCount >= 4) {
      corroboratingScore = 80;
      corroboratingMethod = `${corrCount} corroborating citizen reports in corridor.`;
    } else if (corrCount >= 2) {
      corroboratingScore = 65;
      corroboratingMethod = `${corrCount} corroborating reports recorded in same sector.`;
    } else if (corrCount >= 1) {
      corroboratingScore = 45;
      corroboratingMethod = 'Single independently confirmed citizen report.';
    } else {
      corroboratingScore = 25;
      corroboratingMethod = '[Prototype assumption] Single uncorroborated initial report.';
    }

    // -------------------------------------------------------------
    // Priority Score Calculation:
    // Priority Score = Σ (Factor Score × Factor Weight)
    // Weights sum to exactly 100%: 30% + 20% + 20% + 10% + 10% + 10% = 100%
    // -------------------------------------------------------------
    const weightedSeverity = Math.round(severityScore * 0.30);
    const weightedExtent = Math.round(extentScore * 0.20);
    const weightedRoad = Math.round(roadScore * 0.20);
    const weightedTraffic = Math.round(trafficScore * 0.10);
    const weightedSensitive = Math.round(sensitiveScore * 0.10);
    const weightedCorroborating = Math.round(corroboratingScore * 0.10);

    const calculatedTotal = weightedSeverity + weightedExtent + weightedRoad + weightedTraffic + weightedSensitive + weightedCorroborating;
    const totalScore = Math.min(100, Math.max(0, calculatedTotal));

    // Priority Category Level
    let priorityLevel = 'MEDIUM';
    if (totalScore >= 80) priorityLevel = 'CRITICAL';
    else if (totalScore >= 60) priorityLevel = 'HIGH';
    else if (totalScore >= 40) priorityLevel = 'MEDIUM';
    else priorityLevel = 'LOW';

    // Civic Rationale Generation
    const reasons = [];
    if (count > 0 && normDamageType !== 'NO_DAMAGE_DETECTED') {
      reasons.push(`${severity} severity ${normDamageType.toLowerCase()} detected by trained YOLO11`);
    } else {
      reasons.push('No direct road defects detected by YOLO11');
    }
    if (roadScore >= 80) reasons.push(`situated on major ${normRoadType.toLowerCase()} network`);
    if (zones.length > 0) reasons.push(`adjacent to ${zones.join('/')} corridor`);
    if (corrCount >= 3) reasons.push(`corroborated by ${corrCount} reports`);

    const rationale = reasons.length > 0
      ? reasons.join(', ') + '.'
      : 'Evaluated per MargDrishti 6-factor explainable prioritization framework.';

    return {
      score: totalScore,
      level: priorityLevel,
      breakdown: {
        // Weighted contributions (scale matching maximum possible contribution: 30, 20, 20, 10, 10, 10)
        damageSeverity: weightedSeverity,
        damageExtent: weightedExtent,
        roadImportance: weightedRoad,
        trafficExposure: weightedTraffic,
        sensitiveLocation: weightedSensitive,
        corroboratingEvidence: weightedCorroborating,
        // Detailed 0–100 scale factor entries with model/assumption transparency
        factors: {
          damageSeverity: {
            score: severityScore,
            weight: 0.30,
            weighted: weightedSeverity,
            max: 30,
            isModelDerived: true,
            label: 'Damage Severity',
            method: severityMethod
          },
          damageExtent: {
            score: extentScore,
            weight: 0.20,
            weighted: weightedExtent,
            max: 20,
            isModelDerived: true,
            label: 'Damage Extent',
            method: extentMethod
          },
          roadImportance: {
            score: roadScore,
            weight: 0.20,
            weighted: weightedRoad,
            max: 20,
            isModelDerived: false,
            label: 'Road Importance',
            method: roadMethod
          },
          trafficExposure: {
            score: trafficScore,
            weight: 0.10,
            weighted: weightedTraffic,
            max: 10,
            isModelDerived: false,
            label: 'Traffic Exposure',
            method: trafficMethod
          },
          sensitiveLocation: {
            score: sensitiveScore,
            weight: 0.10,
            weighted: weightedSensitive,
            max: 10,
            isModelDerived: false,
            label: 'Sensitive Location Risk',
            method: sensitiveMethod
          },
          corroboratingEvidence: {
            score: corroboratingScore,
            weight: 0.10,
            weighted: weightedCorroborating,
            max: 10,
            isModelDerived: false,
            label: 'Corroborating Evidence',
            method: corroboratingMethod
          }
        }
      },
      rationale,
      modelLabel: 'Prototype Explainable Priority Model'
    };
  }
};

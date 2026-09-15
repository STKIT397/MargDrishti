/**
 * MargDrishti — Pothole-Aware Route Optimization Engine
 * Calculates safety scores, travel time, and pothole hazard exposure across alternative routes.
 * Excludes resolved road damages from active route penalties.
 */

import { MargDrishtiStore } from './store.js';

export const DEMO_PRESET_ROUTES = [
  {
    id: 'indiranagar_to_koramangala',
    name: 'Indiranagar 100 Feet Rd → Koramangala 5th Block',
    source: '100 Feet Road, Indiranagar',
    destination: '5th Block, Koramangala',
    sourceCoords: [12.9784, 77.6408],
    destCoords: [12.9352, 77.6245]
  },
  {
    id: 'silkboard_to_mgroad',
    name: 'Silk Board Junction → MG Road Metro',
    source: 'Silk Board Junction',
    destination: 'MG Road Metro Station',
    sourceCoords: [12.9177, 77.6238],
    destCoords: [12.9756, 77.6066]
  },
  {
    id: 'airport_to_domlur',
    name: 'Old Airport Road → Domlur Flyover',
    source: 'HAL Heritage Centre, Old Airport Rd',
    destination: 'Domlur Flyover Junction',
    sourceCoords: [12.9560, 77.6680],
    destCoords: [12.9602, 77.6430]
  }
];

// Corridors waypoint definitions for Leaflet rendering
const ROUTE_WAYPOINTS = {
  indiranagar_to_koramangala: {
    safest: [
      [12.9784, 77.6408],
      [12.9710, 77.6450],
      [12.9620, 77.6520],
      [12.9520, 77.6480],
      [12.9430, 77.6380],
      [12.9370, 77.6300],
      [12.9352, 77.6245]
    ],
    fastest: [
      [12.9784, 77.6408],
      [12.9700, 77.6380],
      [12.9602, 77.6430], // passes near Domlur IRR pothole
      [12.9480, 77.6330],
      [12.9380, 77.6310], // passes Koramangala 80ft pothole
      [12.9352, 77.6245]
    ],
    balanced: [
      [12.9784, 77.6408],
      [12.9740, 77.6320],
      [12.9640, 77.6360],
      [12.9510, 77.6320],
      [12.9410, 77.6280],
      [12.9352, 77.6245]
    ]
  },
  silkboard_to_mgroad: {
    safest: [
      [12.9177, 77.6238],
      [12.9250, 77.6180],
      [12.9400, 77.6100],
      [12.9550, 77.6050],
      [12.9680, 77.6040],
      [12.9756, 77.6066]
    ],
    fastest: [
      [12.9177, 77.6238],
      [12.9352, 77.6245], // Hosur road flyover ramp
      [12.9480, 77.6200],
      [12.9620, 77.6120],
      [12.9756, 77.6066]
    ],
    balanced: [
      [12.9177, 77.6238],
      [12.9300, 77.6280],
      [12.9450, 77.6220],
      [12.9600, 77.6150],
      [12.9756, 77.6066]
    ]
  },
  airport_to_domlur: {
    safest: [
      [12.9560, 77.6680],
      [12.9580, 77.6590],
      [12.9610, 77.6510],
      [12.9602, 77.6430]
    ],
    fastest: [
      [12.9560, 77.6680],
      [12.9570, 77.6530],
      [12.9602, 77.6430]
    ],
    balanced: [
      [12.9560, 77.6680],
      [12.9590, 77.6550],
      [12.9602, 77.6430]
    ]
  }
};

class PotholeRouteEngine {
  /**
   * Evaluates distance between two lat/lng points in km (Haversine formula)
   */
  getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Identifies which complaints lie along a given route polyline within a threshold radius (e.g. 500m)
   * IMPORTANT: Excludes RESOLVED complaints!
   */
  findHazardsAlongPath(waypoints, bufferKm = 0.6) {
    const allComplaints = MargDrishtiStore.getAllComplaints();
    // Exclude resolved complaints from active route penalties!
    const activeComplaints = allComplaints.filter(c => c.status !== 'RESOLVED');

    const hazards = [];
    for (const complaint of activeComplaints) {
      if (!complaint.location || !complaint.location.latitude || !complaint.location.longitude) continue;
      
      const cLat = complaint.location.latitude;
      const cLng = complaint.location.longitude;

      // Check distance to any waypoint segment
      let minDistance = Infinity;
      for (const pt of waypoints) {
        const d = this.getDistanceKm(cLat, cLng, pt[0], pt[1]);
        if (d < minDistance) minDistance = d;
      }

      if (minDistance <= bufferKm) {
        hazards.push({
          complaintId: complaint.complaintId,
          damageType: complaint.damageType,
          severity: complaint.severity,
          priority: complaint.priority?.score || 70,
          roadName: complaint.location.roadName,
          lat: cLat,
          lng: cLng,
          distanceFromRouteMeters: Math.round(minDistance * 1000)
        });
      }
    }

    return hazards;
  }

  /**
   * Computes Route Score & Safety Score using MargDrishti formula:
   * Route Score = Travel Time + Distance + Pothole Penalty + Severity Penalty + Pothole Density Penalty
   * Safety Score = 100 - (Pothole Penalty + Severity Penalty + Pothole Density Penalty)
   */
  computeRouteEvaluation(hazards, distanceKm, durationMins) {
    const potholePenalty = hazards.length * 5;
    let severityPenalty = 0;
    let criticalCount = 0;
    let highCount = 0;
    let medCount = 0;
    let lowCount = 0;

    hazards.forEach(h => {
      if (h.severity === 'CRITICAL') {
        severityPenalty += 15;
        criticalCount++;
      } else if (h.severity === 'HIGH') {
        severityPenalty += 10;
        highCount++;
      } else if (h.severity === 'MEDIUM') {
        severityPenalty += 5;
        medCount++;
      } else {
        severityPenalty += 2;
        lowCount++;
      }
    });

    const density = distanceKm > 0 ? hazards.length / distanceKm : 0;
    const densityPenalty = density > 0 ? Math.round(density * 8) : 0;

    // Exact formula requested:
    // Route Score = Travel Time + Distance + Pothole Penalty + Severity Penalty + Pothole Density Penalty
    const routeScore = Math.round(durationMins + distanceKm + potholePenalty + severityPenalty + densityPenalty);

    // Safety Score (100 = No active hazards, decremented by damage penalties)
    const totalHazardPenalty = potholePenalty + severityPenalty + densityPenalty;
    const safetyScore = Math.max(20, Math.min(100, 100 - totalHazardPenalty));

    let safetyLevel = 'EXCELLENT';
    if (safetyScore < 60) safetyLevel = 'CRITICAL RISK';
    else if (safetyScore < 75) safetyLevel = 'CAUTION';
    else if (safetyScore < 90) safetyLevel = 'GOOD';

    return {
      potholeCount: hazards.length,
      criticalCount,
      highCount,
      medCount,
      lowCount,
      density: density.toFixed(2),
      potholePenalty,
      severityPenalty,
      densityPenalty,
      routeScore,
      safetyScore,
      safetyLevel
    };
  }

  /**
   * Main calculation function
   * Returns dynamic comparison of Safest, Fastest, and Balanced routes
   */
  calculateRoutes(presetKey = 'indiranagar_to_koramangala') {
    const waypointsSet = ROUTE_WAYPOINTS[presetKey] || ROUTE_WAYPOINTS.indiranagar_to_koramangala;

    // 1. SAFEST ROUTE (Buffer: 0.40km)
    const safestWaypoints = waypointsSet.safest;
    const safestDist = 9.2;
    const safestTime = 22;
    const safestHazards = this.findHazardsAlongPath(safestWaypoints, 0.40);
    const safestEval = this.computeRouteEvaluation(safestHazards, safestDist, safestTime);

    // 2. FASTEST ROUTE (Buffer: 0.65km)
    const fastestWaypoints = waypointsSet.fastest;
    const fastestDist = 8.1;
    const fastestTime = 19;
    const fastestHazards = this.findHazardsAlongPath(fastestWaypoints, 0.65);
    const fastestEval = this.computeRouteEvaluation(fastestHazards, fastestDist, fastestTime);

    // 3. BALANCED ROUTE (Buffer: 0.50km)
    const balancedWaypoints = waypointsSet.balanced;
    const balancedDist = 8.7;
    const balancedTime = 21;
    const balancedHazards = this.findHazardsAlongPath(balancedWaypoints, 0.50);
    const balancedEval = this.computeRouteEvaluation(balancedHazards, balancedDist, balancedTime);

    // Dynamic Explanations
    let safestExplanation = '';
    if (safestEval.potholeCount === 0) {
      safestExplanation = 'No active pothole hazards found on this route.';
    } else {
      const avoidedVsFastest = Math.max(0, fastestEval.potholeCount - safestEval.potholeCount);
      safestExplanation = `Bypasses ${avoidedVsFastest > 0 ? `${avoidedVsFastest} active potholes` : 'critical stress points'} with lower defect density (${safestEval.density}/km), minimizing chassis shock.`;
    }

    let fastestExplanation = '';
    if (fastestEval.potholeCount === 0) {
      fastestExplanation = 'No active pothole hazards found on this route.';
    } else {
      fastestExplanation = `Fastest route (${fastestDist} km, ${fastestTime} mins), but traverses ${fastestEval.potholeCount} active potholes (${fastestEval.criticalCount} critical, ${fastestEval.highCount} high severity).`;
    }

    let balancedExplanation = '';
    if (balancedEval.potholeCount === 0) {
      balancedExplanation = 'No active pothole hazards found on this route.';
    } else {
      balancedExplanation = `Moderate travel time with ${balancedEval.potholeCount} surface defects (${balancedEval.criticalCount} critical). Balanced tradeoff between speed and vehicle wear.`;
    }

    return {
      presetKey,
      generatedAt: new Date().toISOString(),
      routes: {
        safest: {
          key: 'safest',
          badge: 'RECOMMENDED',
          title: 'Route B — Safest & Smooth Road',
          tagline: 'Lowest pothole risk corridor avoiding severe impact zones',
          distanceKm: safestDist,
          durationMins: safestTime,
          potholeCount: safestEval.potholeCount,
          criticalCount: safestEval.criticalCount,
          highSeverityCount: safestEval.highCount + safestEval.criticalCount,
          routeScore: safestEval.routeScore,
          safetyScore: safestEval.safetyScore,
          safetyLevel: safestEval.safetyLevel,
          color: '#10b981', // emerald
          waypoints: safestWaypoints,
          hazards: safestHazards,
          explanation: safestExplanation
        },
        fastest: {
          key: 'fastest',
          badge: 'FASTEST',
          title: 'Route A — Fastest Transit',
          tagline: 'Minimum travel time through direct arterial corridors',
          distanceKm: fastestDist,
          durationMins: fastestTime,
          potholeCount: fastestEval.potholeCount,
          criticalCount: fastestEval.criticalCount,
          highSeverityCount: fastestEval.highCount + fastestEval.criticalCount,
          routeScore: fastestEval.routeScore,
          safetyScore: fastestEval.safetyScore,
          safetyLevel: fastestEval.safetyLevel,
          color: '#f59e0b', // amber
          waypoints: fastestWaypoints,
          hazards: fastestHazards,
          explanation: fastestExplanation
        },
        balanced: {
          key: 'balanced',
          badge: 'BALANCED',
          title: 'Route C — Balanced Surface',
          tagline: 'Balanced tradeoff between transit time and surface quality',
          distanceKm: balancedDist,
          durationMins: balancedTime,
          potholeCount: balancedEval.potholeCount,
          criticalCount: balancedEval.criticalCount,
          highSeverityCount: balancedEval.highCount + balancedEval.criticalCount,
          routeScore: balancedEval.routeScore,
          safetyScore: balancedEval.safetyScore,
          safetyLevel: balancedEval.safetyLevel,
          color: '#06b6d4', // cyan
          waypoints: balancedWaypoints,
          hazards: balancedHazards,
          explanation: balancedExplanation
        }
      }
    };
  }
}

export const RouteService = new PotholeRouteEngine();

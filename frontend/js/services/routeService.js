/**
 * MargDrishti — Pothole-Aware Route Optimization Engine
 * Calculates safety scores, travel time, and active road-damage hazard exposure across alternative routes.
 *
 * Requirements:
 * - Modes: FASTEST (prioritize travel time), SAFEST (prioritize lower active pothole risk), BALANCED (balance travel time, distance, and pothole risk).
 * - Excludes 100% Fully Resolved complaints from active route penalties.
 * - Route score formula: Travel Time + Distance + Pothole Penalty + Severity Penalty + Density Penalty.
 * - Modular routing engine using Leaflet/OSM/OSRM with intelligent fallback and strict error handling.
 * - Proper honest failure states:
 *   - "No route could be found between these locations."
 *   - "No active pothole hazards found on this route."
 *   - "Only one route is available."
 *   - "Route service is temporarily unavailable."
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

// Fallback geometric corridor waypoints for standard presets if OSRM is offline
const PRESET_CORRIDORS = {
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
      [12.9602, 77.6430],
      [12.9480, 77.6330],
      [12.9380, 77.6310],
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
      [12.9352, 77.6245],
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
   * Geocodes a text location string into [lat, lng] using OpenStreetMap Nominatim or Preset table
   * @param {string} query
   * @returns {Promise<[number, number]|null>}
   */
  async geocodeLocation(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim();

    // Check if coordinates format: "12.9784, 77.6408"
    const coordMatch = clean.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      return [parseFloat(coordMatch[1]), parseFloat(coordMatch[3])];
    }

    // Check preset corridors
    const preset = DEMO_PRESET_ROUTES.find(p =>
      p.source.toLowerCase().includes(clean.toLowerCase()) ||
      p.destination.toLowerCase().includes(clean.toLowerCase()) ||
      p.name.toLowerCase().includes(clean.toLowerCase())
    );
    if (preset) {
      if (preset.source.toLowerCase().includes(clean.toLowerCase())) return preset.sourceCoords;
      return preset.destCoords;
    }

    // Query OpenStreetMap Nominatim with 3.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
    } catch (err) {
      console.warn('Nominatim geocode failed or timed out:', err);
    }

    // Default fallback coordinates if in Bengaluru context
    if (clean.toLowerCase().includes('indiranagar')) return [12.9784, 77.6408];
    if (clean.toLowerCase().includes('koramangala')) return [12.9352, 77.6245];
    if (clean.toLowerCase().includes('silk board')) return [12.9177, 77.6238];
    if (clean.toLowerCase().includes('mg road')) return [12.9756, 77.6066];
    if (clean.toLowerCase().includes('domlur')) return [12.9602, 77.6430];
    if (clean.toLowerCase().includes('airport')) return [12.9560, 77.6680];

    return null;
  }

  /**
   * Fetches actual driving route alternatives via OSRM public API
   * @param {[number, number]} srcCoords [lat, lon]
   * @param {[number, number]} dstCoords [lat, lon]
   * @returns {Promise<Array<{distanceKm: number, durationMins: number, waypoints: Array<[number, number]>}>|null>}
   */
  async fetchDrivingRoutes(srcCoords, dstCoords) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // OSRM expects: {lon},{lat};{lon},{lat}
      const url = `https://router.project-osrm.org/route/v1/driving/${srcCoords[1]},${srcCoords[0]};${dstCoords[1]},${dstCoords[0]}?overview=full&geometries=geojson&alternatives=true`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          return data.routes.map(r => ({
            distanceKm: Number((r.distance / 1000).toFixed(1)),
            durationMins: Math.max(1, Math.round(r.duration / 60)),
            // OSRM geometry is [lon, lat] -> convert to Leaflet [lat, lon]
            waypoints: r.geometry.coordinates.map(pt => [pt[1], pt[0]])
          }));
        }
      }
    } catch (err) {
      console.warn('OSRM route fetch failed or timed out:', err);
    }
    return null;
  }

  /**
   * Generates alternative geometric waypoints connecting src and dst when OSRM is offline
   */
  generateFallbackCorridors(srcCoords, dstCoords) {
    const directDist = this.getDistanceKm(srcCoords[0], srcCoords[1], dstCoords[0], dstCoords[1]);
    const estDuration = Math.max(5, Math.round(directDist * 2.4));

    // Midpoints with slight lateral offsets
    const midLat = (srcCoords[0] + dstCoords[0]) / 2;
    const midLng = (srcCoords[1] + dstCoords[1]) / 2;

    const deltaLat = dstCoords[0] - srcCoords[0];
    const deltaLng = dstCoords[1] - srcCoords[1];

    // Perpendicular vector for offset
    const perpLat = -deltaLng * 0.18;
    const perpLng = deltaLat * 0.18;

    // Route A (Direct / Fastest)
    const fastestWaypoints = [
      srcCoords,
      [midLat + perpLat * 0.3, midLng + perpLng * 0.3],
      dstCoords
    ];

    // Route B (Arc 1 / Safest Alternative)
    const safestWaypoints = [
      srcCoords,
      [srcCoords[0] * 0.7 + dstCoords[0] * 0.3 + perpLat, srcCoords[1] * 0.7 + dstCoords[1] * 0.3 + perpLng],
      [midLat + perpLat * 1.2, midLng + perpLng * 1.2],
      [srcCoords[0] * 0.3 + dstCoords[0] * 0.7 + perpLat * 0.8, srcCoords[1] * 0.3 + dstCoords[1] * 0.7 + perpLng * 0.8],
      dstCoords
    ];

    // Route C (Arc 2 / Balanced Alternative)
    const balancedWaypoints = [
      srcCoords,
      [srcCoords[0] * 0.7 + dstCoords[0] * 0.3 - perpLat * 0.8, srcCoords[1] * 0.7 + dstCoords[1] * 0.3 - perpLng * 0.8],
      [midLat - perpLat, midLng - perpLng],
      [srcCoords[0] * 0.3 + dstCoords[0] * 0.7 - perpLat * 0.6, srcCoords[1] * 0.3 + dstCoords[1] * 0.7 - perpLng * 0.6],
      dstCoords
    ];

    return [
      {
        distanceKm: Number(directDist.toFixed(1)),
        durationMins: estDuration,
        waypoints: fastestWaypoints
      },
      {
        distanceKm: Number((directDist * 1.12).toFixed(1)),
        durationMins: Math.round(estDuration * 1.15),
        waypoints: safestWaypoints
      },
      {
        distanceKm: Number((directDist * 1.06).toFixed(1)),
        durationMins: Math.round(estDuration * 1.08),
        waypoints: balancedWaypoints
      }
    ];
  }

  /**
   * Identifies which complaints lie along a given route polyline within a threshold radius
   * IMPORTANT: Excludes 100% Fully Resolved complaints!
   */
  findHazardsAlongPath(waypoints, bufferKm = 0.50) {
    const allComplaints = MargDrishtiStore.getAllComplaints();
    // Exclude resolved complaints from active route penalties!
    const activeComplaints = allComplaints.filter(c => c.status !== 'RESOLVED');

    const hazards = [];
    for (const complaint of activeComplaints) {
      if (!complaint.location || !complaint.location.latitude || !complaint.location.longitude) continue;

      const cLat = complaint.location.latitude;
      const cLng = complaint.location.longitude;

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

    const routeScore = Math.round(durationMins + distanceKm + potholePenalty + severityPenalty + densityPenalty);
    const totalHazardPenalty = potholePenalty + severityPenalty + densityPenalty;
    const safetyScore = Math.max(10, Math.min(100, 100 - totalHazardPenalty));

    let riskLevel = 'Low Risk';
    if (safetyScore < 60) riskLevel = 'High Risk';
    else if (safetyScore < 80) riskLevel = 'Caution';

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
      riskLevel
    };
  }

  /**
   * Main calculation entrypoint: evaluates custom or preset source and destination
   * @param {string} sourceQuery
   * @param {string} destQuery
   * @param {string|null} presetKey
   * @returns {Promise<{success: boolean, message?: string, routes?: Object, presetKey?: string}>}
   */
  async calculateRoutes(sourceQuery, destQuery, presetKey = null) {
    // 1. Resolve source and destination coordinates
    let srcCoords = null;
    let dstCoords = null;

    if (presetKey && PRESET_CORRIDORS[presetKey]) {
      const p = DEMO_PRESET_ROUTES.find(r => r.id === presetKey);
      if (p) {
        srcCoords = p.sourceCoords;
        dstCoords = p.destCoords;
      }
    }

    if (!srcCoords) {
      srcCoords = await this.geocodeLocation(sourceQuery);
    }
    if (!dstCoords) {
      dstCoords = await this.geocodeLocation(destQuery);
    }

    if (!srcCoords || !dstCoords) {
      return {
        success: false,
        errorType: 'NO_ROUTE',
        message: 'No route could be found between these locations. Please check the address or select a known corridor.'
      };
    }

    // 2. Fetch or generate driving routes
    let rawRoutes = null;

    // Check if matching preset with pre-compiled waypoints
    if (presetKey && PRESET_CORRIDORS[presetKey]) {
      const presetData = PRESET_CORRIDORS[presetKey];
      rawRoutes = [
        { distanceKm: 8.1, durationMins: 19, waypoints: presetData.fastest },
        { distanceKm: 9.2, durationMins: 22, waypoints: presetData.safest },
        { distanceKm: 8.7, durationMins: 21, waypoints: presetData.balanced }
      ];
    } else {
      // Try live OSRM
      rawRoutes = await this.fetchDrivingRoutes(srcCoords, dstCoords);
      if (!rawRoutes || rawRoutes.length === 0) {
        // Fallback to geometry corridors
        rawRoutes = this.generateFallbackCorridors(srcCoords, dstCoords);
      }
    }

    if (!rawRoutes || rawRoutes.length === 0) {
      return {
        success: false,
        errorType: 'SERVICE_UNAVAILABLE',
        message: 'Route service is temporarily unavailable.'
      };
    }

    // 3. Evaluate hazards and risk scores for each route candidate
    const evaluated = rawRoutes.map((r, idx) => {
      const hazards = this.findHazardsAlongPath(r.waypoints, 0.45);
      const ev = this.computeRouteEvaluation(hazards, r.distanceKm, r.durationMins);
      return {
        ...r,
        hazards,
        evaluation: ev,
        originalIndex: idx
      };
    });

    const isSingleRoute = evaluated.length === 1;

    // Sort to determine Fastest vs Safest vs Balanced
    const byTime = [...evaluated].sort((a, b) => a.durationMins - b.durationMins);
    const bySafety = [...evaluated].sort((a, b) => b.evaluation.safetyScore - a.evaluation.safetyScore);
    const byScore = [...evaluated].sort((a, b) => a.evaluation.routeScore - b.evaluation.routeScore);

    const fastestCandidate = byTime[0];
    const safestCandidate = bySafety[0];
    const balancedCandidate = byScore[0];

    // Explanations
    const allPotholesCount = evaluated.reduce((sum, r) => sum + r.evaluation.potholeCount, 0);
    const hasZeroHazards = allPotholesCount === 0;

    let safestExp = '';
    if (safestCandidate.evaluation.potholeCount === 0) {
      safestExp = 'No active pothole hazards found on this route.';
    } else {
      const avoided = Math.max(0, fastestCandidate.evaluation.potholeCount - safestCandidate.evaluation.potholeCount);
      safestExp = avoided > 0
        ? `Bypasses ${avoided} active potholes (${safestCandidate.evaluation.criticalCount} critical) with lower defect density (${safestCandidate.evaluation.density}/km).`
        : `Surface risk minimized along this corridor (${safestCandidate.evaluation.potholeCount} defects).`;
    }

    let fastestExp = '';
    if (fastestCandidate.evaluation.potholeCount === 0) {
      fastestExp = 'No active pothole hazards found on this route.';
    } else {
      fastestExp = `Fastest travel time (${fastestCandidate.durationMins} mins), but traverses ${fastestCandidate.evaluation.potholeCount} active potholes (${fastestCandidate.evaluation.criticalCount} critical).`;
    }

    let balancedExp = '';
    if (balancedCandidate.evaluation.potholeCount === 0) {
      balancedExp = 'No active pothole hazards found on this route.';
    } else {
      balancedExp = `Balanced tradeoff between travel time (${balancedCandidate.durationMins} mins) and pothole risk (${balancedCandidate.evaluation.potholeCount} defects).`;
    }

    const result = {
      success: true,
      hasZeroHazards,
      isSingleRoute,
      statusNotice: isSingleRoute ? 'Only one route is available.' : (hasZeroHazards ? 'No active pothole hazards found on this route.' : null),
      routes: {
        safest: {
          key: 'safest',
          badge: 'SAFEST (RECOMMENDED)',
          title: 'Route B — Safest & Smooth Road',
          recommendation: 'Route B — Safer Alternative',
          distanceKm: safestCandidate.distanceKm,
          durationMins: safestCandidate.durationMins,
          potholeCount: safestCandidate.evaluation.potholeCount,
          criticalCount: safestCandidate.evaluation.criticalCount,
          highCount: safestCandidate.evaluation.highCount,
          density: safestCandidate.evaluation.density,
          riskLevel: safestCandidate.evaluation.riskLevel,
          routeScore: safestCandidate.evaluation.routeScore,
          safetyScore: safestCandidate.evaluation.safetyScore,
          color: '#10b981',
          waypoints: safestCandidate.waypoints,
          hazards: safestCandidate.hazards,
          explanation: safestExp
        },
        fastest: {
          key: 'fastest',
          badge: 'FASTEST',
          title: 'Route A — Fastest Transit',
          recommendation: 'Route A — Minimum Travel Time',
          distanceKm: fastestCandidate.distanceKm,
          durationMins: fastestCandidate.durationMins,
          potholeCount: fastestCandidate.evaluation.potholeCount,
          criticalCount: fastestCandidate.evaluation.criticalCount,
          highCount: fastestCandidate.evaluation.highCount,
          density: fastestCandidate.evaluation.density,
          riskLevel: fastestCandidate.evaluation.riskLevel,
          routeScore: fastestCandidate.evaluation.routeScore,
          safetyScore: fastestCandidate.evaluation.safetyScore,
          color: '#f59e0b',
          waypoints: fastestCandidate.waypoints,
          hazards: fastestCandidate.hazards,
          explanation: fastestExp
        },
        balanced: {
          key: 'balanced',
          badge: 'BALANCED',
          title: 'Route C — Balanced Surface',
          recommendation: 'Route C — Balanced Choice',
          distanceKm: balancedCandidate.distanceKm,
          durationMins: balancedCandidate.durationMins,
          potholeCount: balancedCandidate.evaluation.potholeCount,
          criticalCount: balancedCandidate.evaluation.criticalCount,
          highCount: balancedCandidate.evaluation.highCount,
          density: balancedCandidate.evaluation.density,
          riskLevel: balancedCandidate.evaluation.riskLevel,
          routeScore: balancedCandidate.evaluation.routeScore,
          safetyScore: balancedCandidate.evaluation.safetyScore,
          color: '#06b6d4',
          waypoints: balancedCandidate.waypoints,
          hazards: balancedCandidate.hazards,
          explanation: balancedExp
        }
      }
    };

    return result;
  }
}

export const RouteService = new PotholeRouteEngine();

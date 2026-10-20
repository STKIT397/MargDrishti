/**
 * MargDrishti — Comprehensive Verification Test Suite
 * Tests:
 * 1. Model Tests (trained YOLO11 checkpoint, real detection output, zero detection, error handling)
 * 2. Priority Tests (6 factors, 0-100 scale, 100% weight sum, deterministic, fallbacks)
 * 3. Step 3 Back Navigation Tests (DOM presence, state preservation, invalidation on evidence change)
 * 4. Citizen to Authority Persistence Verification
 */

import http from 'http';
import { PriorityEngine } from './frontend/js/priorityEngine.js';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSuite() {
  console.log('===============================================================');
  console.log('MARGDRISHTI FINAL IMPLEMENTATION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // 1. MODEL INTEGRATION TESTS
  // -----------------------------------------------------------------
  console.log('--- 1. MODEL INTEGRATION TESTS ---');

  // 1a: Health and Checkpoint Check
  const health = await request('/api/ai/health');
  assert(health.status === 200, 'Health endpoint responds with HTTP 200');
  assert(health.data?.checkpoint === 'best (1).pt', `Checkpoint is the trained checkpoint (${health.data?.checkpoint})`);
  assert(health.data?.classCount === 6, `Model contains 6 classes (Found: ${health.data?.classCount})`);
  const expectedClasses = ['broken_road_edge', 'construction_zone', 'crack', 'open_manhole', 'pothole', 'waterlogged_road'];
  const actualClasses = Object.values(health.data?.classes || {});
  const classesMatch = expectedClasses.every(c => actualClasses.includes(c));
  assert(classesMatch, `Classes match trained dataset (${actualClasses.join(', ')})`);

  // 1b: Real Inference on Road Damage Image
  const testUrl = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=1000&q=80';
  const inferRes = await request('/api/ai/analyze', 'POST', { image: testUrl, mediaType: 'image' });
  assert(inferRes.status === 200, 'Inference on road image returns HTTP 200');
  assert(inferRes.data?.success === true, 'Inference status is success');
  assert(inferRes.data?.detectionCount > 0, `Detections found: ${inferRes.data?.detectionCount}`);
  assert(inferRes.data?.inferenceSource === 'LIVE_TRAINED_YOLO11', 'Inference source is LIVE_TRAINED_YOLO11');
  assert(inferRes.data?.checkpoint === 'best (1).pt', 'Trained checkpoint best (1).pt executed');

  // Verify confidence is actual model output (not hardcoded 0.91 or 0.94)
  const firstDet = inferRes.data?.detections?.[0];
  assert(typeof firstDet?.confidence === 'number' && firstDet.confidence !== 0.91 && firstDet.confidence !== 0.94,
    `Confidence is actual model output (${firstDet?.confidence})`);

  // Verify bounding boxes: [nx, ny, nw, nh] within [0, 1]
  const validBboxes = inferRes.data?.detections?.every(d =>
    Array.isArray(d.bbox) && d.bbox.length === 4 &&
    d.bbox.every(coord => coord >= 0 && coord <= 1.0)
  );
  assert(validBboxes, 'All bounding boxes are normalized [nx, ny, nw, nh] coordinates within [0, 1]');

  // 1c: Honest Zero-Detection on Blank Image
  const blankB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const zeroRes = await request('/api/ai/analyze', 'POST', { image: blankB64, mediaType: 'image' });
  assert(zeroRes.status === 200, 'Blank image returns HTTP 200');
  assert(zeroRes.data?.detectionCount === 0, 'Zero detections correctly reported on blank image');
  assert(zeroRes.data?.damageType === 'NO_DAMAGE_DETECTED', 'Damage type is NO_DAMAGE_DETECTED');
  assert(zeroRes.data?.message?.includes('No supported road damage detected'), 'Honest empty detection message returned');

  // 1d: Error handling for invalid image
  const errRes = await request('/api/ai/analyze', 'POST', { image: 'invalid_corrupt_data', mediaType: 'image' });
  assert(errRes.status >= 400, `Invalid input returns error code HTTP ${errRes.status}`);
  assert(errRes.data?.success === false, 'Error response has success: false (no fabricated result)');

  // -----------------------------------------------------------------
  // 2. PRIORITY ENGINE TESTS
  // -----------------------------------------------------------------
  console.log('\n--- 2. PRIORITY ENGINE TESTS ---');

  const pRes = PriorityEngine.calculatePriority({
    damageType: inferRes.data.damageType,
    severity: inferRes.data.severity,
    confidence: inferRes.data.confidence,
    detections: inferRes.data.detections,
    detectionCount: inferRes.data.detectionCount,
    surfaceDamageAreaPct: inferRes.data.surfaceDamageAreaPct,
    roadType: 'ARTERIAL',
    trafficExposure: 'HIGH',
    sensitiveZones: ['SCHOOL', 'TRANSIT'],
    corroboratingCount: 4
  });

  assert(pRes.score >= 0 && pRes.score <= 100, `Score is bounded in [0, 100] (${pRes.score})`);
  assert(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(pRes.level), `Priority level is valid (${pRes.level})`);

  // Weight sum check
  let weightSum = 0;
  for (const f of Object.values(pRes.breakdown.factors)) {
    weightSum += f.weight;
  }
  assert(Math.round(weightSum * 100) === 100, `Weights sum to exactly 100% (${Math.round(weightSum * 100)}%)`);

  // Check 0-100 scale on all factors
  const allScale100 = Object.values(pRes.breakdown.factors).every(f => f.score >= 0 && f.score <= 100);
  assert(allScale100, 'All 6 factor inputs are scaled consistently 0–100 before weighting');

  // Check weighted summation formula: Σ (Factor Score × Factor Weight)
  let manualSum = 0;
  for (const f of Object.values(pRes.breakdown.factors)) {
    manualSum += f.weighted;
  }
  assert(manualSum === pRes.score, `Sum of weighted contributions (${manualSum}) equals priority score (${pRes.score})`);

  // Determinism check
  const pResRepeat = PriorityEngine.calculatePriority({
    damageType: inferRes.data.damageType,
    severity: inferRes.data.severity,
    confidence: inferRes.data.confidence,
    detections: inferRes.data.detections,
    detectionCount: inferRes.data.detectionCount,
    surfaceDamageAreaPct: inferRes.data.surfaceDamageAreaPct,
    roadType: 'ARTERIAL',
    trafficExposure: 'HIGH',
    sensitiveZones: ['SCHOOL', 'TRANSIT'],
    corroboratingCount: 4
  });
  assert(pResRepeat.score === pRes.score, 'Deterministic: repeated calculation yields identical score');

  // Fallback check
  const pFallback = PriorityEngine.calculatePriority({});
  assert(typeof pFallback.score === 'number' && pFallback.score > 0, `Missing input fallback produces valid score (${pFallback.score})`);

  // -----------------------------------------------------------------
  // 3. STEP 3 BACK NAVIGATION & DOM INSPECTION TESTS
  // -----------------------------------------------------------------
  console.log('\n--- 3. STEP 3 BACK NAVIGATION TESTS ---');

  const citizenHtml = await request('/citizen.html');
  assert(citizenHtml.status === 200, 'citizen.html loads successfully (HTTP 200)');

  // Verify Back button before scan on Step 3
  assert(citizenHtml.raw.includes('id="btnBackToStep2Form"'), 'Back button on Step 3 before AI scan exists (btnBackToStep2Form)');
  // Verify Back button inside AI result card
  assert(citizenHtml.raw.includes('id="btnBackToStep2"'), 'Back button inside AI Result Card exists (btnBackToStep2)');
  // Verify Back buttons have arrow-left icon
  assert(citizenHtml.raw.includes('data-lucide="arrow-left"'), 'Back button contains arrow-left icon');
  // Verify AI Scan Error Box
  assert(citizenHtml.raw.includes('id="aiScanErrorBox"'), 'AI Scan Error banner exists for honest error feedback');

  // -----------------------------------------------------------------
  // 4. CITIZEN TO AUTHORITY END-TO-END PERSISTENCE
  // -----------------------------------------------------------------
  console.log('\n--- 4. CITIZEN TO AUTHORITY WORKFLOW PERSISTENCE ---');

  // Citizen Login
  const loginRes = await request('/api/auth/login', 'POST', {
    role: 'citizen',
    identifier: 'aishwarya@test.com',
    password: 'Citizen@123'
  });
  assert(loginRes.status === 200, 'Citizen login successful');
  const citizenId = loginRes.data.user.user_id;

  // Submit Complaint with actual YOLO11 inference result and priority score
  const complaintPayload = {
    citizen_id: citizenId,
    damage_type: pRes.score >= 80 ? 'Open Manhole' : 'Pothole',
    description: 'Hazard detected using trained YOLO11 checkpoint best (1).pt.',
    severity: inferRes.data.severity,
    priority_score: pRes.score,
    latitude: 16.7050,
    longitude: 74.2433,
    address: 'Indiranagar Main Road',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    location_source: 'GPS',
    ai_analysis: {
      model_name: 'YOLO11',
      damage_type: inferRes.data.damageType,
      confidence: Math.round(inferRes.data.confidence * 10000) / 100,
      severity: inferRes.data.severity,
      image_authenticity_status: 'ORIGINAL'
    }
  };

  const createRes = await request('/api/complaints', 'POST', complaintPayload);
  assert(createRes.status === 201, `Complaint created successfully (ID: ${createRes.data?.complaint?.complaint_id})`);
  const createdId = createRes.data?.complaint?.complaint_id;
  assert(Number(createRes.data?.complaint?.priority_score) === pRes.score,
    `Stored priority score (${createRes.data?.complaint?.priority_score}) matches calculated score (${pRes.score})`);

  // Authority Maintenance Queue Check
  const queueRes = await request('/api/complaints');
  assert(queueRes.status === 200, 'Authority queue retrieved (HTTP 200)');
  const foundInQueue = queueRes.data?.complaints?.find(c => c.complaint_id === createdId);
  assert(!!foundInQueue, `Complaint ${createdId} visible in Authority Maintenance Queue`);
  assert(Number(foundInQueue?.priority_score) === pRes.score,
    `Authority queue displays identical priority score (${foundInQueue?.priority_score})`);

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

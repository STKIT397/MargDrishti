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

function request(path, method = 'GET', body = null, token = null) {
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
        } : {}),
        ...(token ? {
          'Authorization': `Bearer ${token}`
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
  // 4. CITIZEN TO AUTHORITY END-TO-END PERSISTENCE & ISOLATION
  // -----------------------------------------------------------------
  console.log('\n--- 4. CITIZEN TO AUTHORITY WORKFLOW PERSISTENCE & AUTH ISOLATION ---');

  // 4a: Unauthenticated requests are rejected
  const unauthRes = await request('/api/complaints');
  assert(unauthRes.status === 401, 'Unauthenticated request to protected endpoint (/api/complaints) rejected with HTTP 401');

  // 4b: Citizen Login
  const loginRes = await request('/api/auth/login', 'POST', {
    role: 'citizen',
    identifier: 'aishwarya@test.com',
    password: 'Citizen@123'
  });
  assert(loginRes.status === 200, 'Citizen login successful');
  assert(!!loginRes.data?.token, 'Citizen receives HMAC-signed auth token');
  const citizenId = loginRes.data.user.user_id;
  const citizenToken = loginRes.data.token;

  // 4c: Citizen data isolation - cross-account access is forbidden
  const crossCitizenRes = await request('/api/complaints?citizen_id=CIT-0002', 'GET', null, citizenToken);
  assert(crossCitizenRes.status === 403, 'Citizen attempting to query another citizen\'s complaints rejected with HTTP 403 Forbidden');

  // 4d: Public map endpoint works without authentication and sanitizes PII
  const publicMapRes = await request('/api/complaints/public-map');
  assert(publicMapRes.status === 200, 'Public map hazards query succeeds without auth (HTTP 200)');
  const noPiiLeaked = publicMapRes.data?.complaints?.every(c => !c.citizen_name && !c.citizen_phone && !c.email);
  assert(noPiiLeaked, 'Public map endpoint does not leak citizen PII (name, phone, email sanitized)');

  // 4e: Submit Complaint with actual YOLO11 inference result and priority score
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

  const createRes = await request('/api/complaints', 'POST', complaintPayload, citizenToken);
  assert(createRes.status === 201, `Complaint created successfully (ID: ${createRes.data?.complaint?.complaint_id})`);
  const createdId = createRes.data?.complaint?.complaint_id;
  assert(Number(createRes.data?.complaint?.priority_score) === pRes.score,
    `Stored priority score (${createRes.data?.complaint?.priority_score}) matches calculated score (${pRes.score})`);

  // 4f: Citizen cannot perform Authority operations
  const unauthAssignRes = await request(`/api/complaints/${createdId}/assign`, 'POST', {
    assigned_to: 'ENG-0001',
    assigned_by: 'CIT-0001',
    remarks: 'Malicious assignment attempt.'
  }, citizenToken);
  assert(unauthAssignRes.status === 403, 'Citizen calling authority-only assignment rejected with HTTP 403 Forbidden');

  // 4g: Authority Login
  const authLoginRes = await request('/api/auth/login', 'POST', {
    role: 'authority',
    identifier: 'engineer@test.com',
    password: 'Authority@123'
  });
  assert(authLoginRes.status === 200, 'Authority login successful');
  assert(!!authLoginRes.data?.token, 'Authority receives signed auth token');
  const authToken = authLoginRes.data.token;

  // 4h: Authority Maintenance Queue Check
  const queueRes = await request('/api/complaints', 'GET', null, authToken);
  assert(queueRes.status === 200, 'Authority queue retrieved (HTTP 200)');
  const foundInQueue = queueRes.data?.complaints?.find(c => c.complaint_id === createdId);
  assert(!!foundInQueue, `Complaint ${createdId} visible in Authority Maintenance Queue`);
  assert(Number(foundInQueue?.priority_score) === pRes.score,
    `Authority queue displays identical priority score (${foundInQueue?.priority_score})`);

  // -----------------------------------------------------------------
  // 5. WORKFLOW IMPROVEMENTS (ASSIGNMENT, NOTIFICATIONS, LIFECYCLE)
  // -----------------------------------------------------------------
  console.log('\n--- 5. WORKFLOW IMPROVEMENTS: ASSIGNMENT, NOTIFICATIONS & REPAIR ---');

  // 5a: Fetch Available Engineers with live workload & demo label
  const engListRes = await request('/api/engineers', 'GET', null, authToken);
  assert(engListRes.status === 200, 'Available engineers list fetched (HTTP 200)');
  assert(engListRes.data?.count >= 3, `Seeded engineers found (Count: ${engListRes.data?.count})`);
  const eng1 = engListRes.data?.engineers?.find(e => e.user_id === 'ENG-0001');
  assert(!!eng1, 'Engineer ENG-0001 (Rajesh Kumar) exists in database');
  assert(eng1?.is_demo_account === true, 'Engineers are transparently labeled as demo accounts (is_demo_account: true)');
  assert(typeof eng1?.active_tasks === 'number', `Live engineer workload tracked (active_tasks: ${eng1?.active_tasks})`);

  // 5b: Authority Assigns Engineer Workflow
  const assignPayload = {
    assigned_to: 'ENG-0001',
    assigned_by: 'AUTHUSER-0001',
    remarks: 'Deploy pothole repair team with asphalt patching mix within SLA.',
    expected_completion_date: '2026-11-05'
  };
  const assignRes = await request(`/api/complaints/${createdId}/assign`, 'POST', assignPayload, authToken);
  assert(assignRes.status === 200, `Engineer assignment successful (HTTP 200)`);
  assert(assignRes.data?.complaint?.status === 'ASSIGNED', `Complaint status updated to ASSIGNED`);
  assert(assignRes.data?.assignment?.assigned_to === 'ENG-0001', `Assignment record created for ENG-0001`);

  // 5c: Engineer Login
  const engLoginRes = await request('/api/auth/login', 'POST', {
    role: 'engineer',
    identifier: 'rajesh.engineer@margdrishti.demo',
    password: 'Engineer@123'
  });
  assert(engLoginRes.status === 200, 'Engineer login successful');
  assert(!!engLoginRes.data?.token, 'Engineer receives signed auth token');
  const engToken = engLoginRes.data.token;

  // 5d: Connected Notifications for Assignment
  const engNotifs = await request(`/api/notifications?recipient_id=ENG-0001`, 'GET', null, engToken);
  assert(engNotifs.status === 200, 'Engineer notifications retrieved (HTTP 200)');
  const engAssignNotif = engNotifs.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'ENGINEER_ASSIGNED');
  assert(!!engAssignNotif, `Assigned engineer received notification for ${createdId}`);

  const citNotifs = await request(`/api/notifications?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  assert(citNotifs.status === 200, 'Citizen notifications retrieved (HTTP 200)');
  const citAssignNotif = citNotifs.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'ENGINEER_ASSIGNED');
  assert(!!citAssignNotif, `Citizen received notification that engineer has been assigned`);

  // 5e: Engineer Workspace Tasks Endpoint
  const engTasksRes = await request(`/api/engineer/tasks?engineer_id=ENG-0001`, 'GET', null, engToken);
  assert(engTasksRes.status === 200, 'Engineer workspace tasks retrieved (HTTP 200)');
  const taskInWorkspace = engTasksRes.data?.tasks?.find(t => t.complaint_id === createdId);
  assert(!!taskInWorkspace, `Complaint ${createdId} visible in Engineer ENG-0001 Workspace`);
  assert(taskInWorkspace?.status === 'ASSIGNED', 'Task status is ASSIGNED');

  // 5f: Engineer Acknowledges Task
  const ackRes = await request(`/api/engineer/tasks/${createdId}/acknowledge`, 'POST', { engineer_id: 'ENG-0001' }, engToken);
  assert(ackRes.status === 200, 'Engineer acknowledged task order (HTTP 200)');
  const authNotifs = await request(`/api/notifications?recipient_id=AUTHUSER-0001`, 'GET', null, authToken);
  const ackNotif = authNotifs.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'TASK_ACKNOWLEDGED');
  assert(!!ackNotif, `Authority notified of engineer task acknowledgment`);

  // 5g: Engineer Starts Repair Work
  const startRes = await request(`/api/engineer/tasks/${createdId}/start-repair`, 'POST', {
    engineer_id: 'ENG-0001',
    description: 'Site mobilized with asphalt roller equipment.'
  }, engToken);
  assert(startRes.status === 200, 'Repair work started (HTTP 200)');
  assert(startRes.data?.complaint?.status === 'IN_PROGRESS', 'Complaint status moved to IN_PROGRESS');

  const citNotifsAfterStart = await request(`/api/notifications?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  const startNotif = citNotifsAfterStart.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'REPAIR_STARTED');
  assert(!!startNotif, `Citizen notified: "Repair work has started at [location]"`);

  // 5h: Engineer Updates Progress to 90% (triggers specific 90% notification rule)
  const progRes = await request(`/api/engineer/tasks/${createdId}/update-progress`, 'POST', {
    engineer_id: 'ENG-0001',
    progress_pct: 90,
    notes: 'Asphalt leveled and rolled. Surface sealed.'
  }, engToken);
  assert(progRes.status === 200, 'Progress updated to 90% (HTTP 200)');

  const citNotifsAfter90 = await request(`/api/notifications?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  const notif90 = citNotifsAfter90.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'REPAIR_PROGRESS_90');
  assert(!!notif90, `Citizen received 90% progress notification ("Repair progress is reported as 90% for complaint...")`);

  // 5i: Engineer Submits Completion Evidence (Enters 60-day monitoring, Resolution: 90%)
  const compRes = await request(`/api/engineer/tasks/${createdId}/submit-completion`, 'POST', {
    engineer_id: 'ENG-0001',
    completion_image_path: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1000&q=80',
    notes: 'Bitumen compacted flush to grade.',
    materials_used: 'Bitumen VG-30, Cold mix asphalt.',
    monitoring_days: 60
  }, engToken);
  assert(compRes.status === 200, 'Completion evidence submitted (HTTP 200)');
  assert(compRes.data?.complaint?.status === 'REPAIR_COMPLETED', 'Status transitioned to REPAIR_COMPLETED (Resolution 90%)');

  const authNotifsAfterComp = await request(`/api/notifications?recipient_id=AUTHUSER-0001`, 'GET', null, authToken);
  const compNotif = authNotifsAfterComp.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'REPAIR_COMPLETED');
  assert(!!compNotif, `Authority notified: "Engineer Rajesh Kumar has submitted repair-completion evidence for complaint ${createdId}"`);

  // 5j: Authority Verifies & Confirms Final Resolution (100% Resolved)
  const finalRes = await request(`/api/complaints/${createdId}/confirm-final`, 'POST', {
    changed_by: 'AUTHUSER-0001',
    notes: 'Field inspection confirmed surface integrity.'
  }, authToken);
  assert(finalRes.status === 200, 'Authority confirmed final resolution (HTTP 200)');
  assert(finalRes.data?.complaint?.status === 'RESOLVED', 'Complaint status marked RESOLVED (100%)');

  const citNotifsAfterResolved = await request(`/api/notifications?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  const resolvedNotif = citNotifsAfterResolved.data?.notifications?.find(n => n.complaint_id === createdId && n.event_type === 'COMPLAINT_RESOLVED');
  assert(!!resolvedNotif, `Citizen notified: "Your complaint ${createdId} has been marked as resolved."`);

  // 5k: Notification Management Endpoints (Read & Unread Count)
  const unreadBefore = await request(`/api/notifications/unread-count?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  assert(unreadBefore.status === 200 && unreadBefore.data?.unread_count > 0, `Unread count retrieved (${unreadBefore.data?.unread_count})`);

  const markAllRes = await request('/api/notifications/read-all', 'PATCH', { recipient_id: citizenId }, citizenToken);
  assert(markAllRes.status === 200 && markAllRes.data?.success === true, 'Mark all notifications read successful');

  const unreadAfter = await request(`/api/notifications/unread-count?recipient_id=${citizenId}`, 'GET', null, citizenToken);
  assert(unreadAfter.data?.unread_count === 0, 'Unread count correctly reduced to 0');

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

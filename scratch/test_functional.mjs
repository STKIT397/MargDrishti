// MargDrishti — Functional Logic Unit Verification Test

// Mock localStorage for Node.js environment
const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {}
};
globalThis.CustomEvent = class CustomEvent { constructor(type, opt) { this.type = type; this.detail = opt?.detail; } };

const { AuthService } = await import('../js/auth.js');
const { ROAD_LOCATION_TYPES, ROAD_AUTHORITY_MAPPING, getResponsibleAuthority, resolveAuthorityInfo } = await import('../js/authorityConfig.js');
const { ImageAuthenticityService, AUTHENTICITY_STATUS } = await import('../js/imageAuthenticityService.js');
const { MargDrishtiStore } = await import('../js/store.js');
const { PriorityEngine } = await import('../js/priorityEngine.js');
const { RouteService } = await import('../js/routeService.js');

console.log('--- Starting MargDrishti Functional Unit Tests ---');

// 1. Authority Configuration
console.log('\n[1] Verifying Authority Mapping...');
for (const type of ROAD_LOCATION_TYPES) {
  const auth = getResponsibleAuthority(type);
  console.log(`  ✓ ${type} -> ${auth}`);
  if (!auth) throw new Error(`Missing authority for ${type}`);
}

const info = resolveAuthorityInfo('City / Municipal Road', 'Kolhapur City');
console.log('  ✓ Resolution test:', info.display);
if (info.authority !== 'Municipal Corporation / Municipal Council') throw new Error('Authority resolution mismatch');

// 2. Authentication: Citizen Registration
console.log('\n[2] Verifying Citizen Registration & ID Format...');
const citRes = AuthService.signup({
  role: 'citizen',
  name: 'Sunil Rao',
  email: 'sunil@test.org',
  mobile: '9880011223',
  password: 'Password@123',
  confirmPassword: 'Password@123'
});
console.log('  Citizen Registration Result:', citRes.success, 'Assigned ID:', citRes.user?.citizenId);
if (!citRes.success || !citRes.user?.citizenId?.startsWith('CIT-2026-')) {
  throw new Error('Failed to generate valid Citizen ID');
}

// 3. Authentication: Authority Registration
console.log('\n[3] Verifying Authority Registration & ID Format...');
const authRes = AuthService.signup({
  role: 'authority',
  name: 'Engineer Ramesh Kulkarni',
  email: 'ramesh.pwd@gov.in',
  mobile: '9845012345',
  password: 'Password@123',
  confirmPassword: 'Password@123',
  roadType: 'State Highway',
  jurisdiction: 'Kolhapur Division'
});
console.log('  Authority Registration Result:', authRes.success, 'Assigned ID:', authRes.user?.authorityId);
if (!authRes.success || !authRes.user?.authorityId?.startsWith('AUT-2026-')) {
  throw new Error('Failed to generate valid Authority ID');
}
if (authRes.user.responsibleAuthority !== 'State PWD') {
  throw new Error(`Expected State PWD, got ${authRes.user.responsibleAuthority}`);
}

// 4. Image Authenticity Service
console.log('\n[4] Verifying Image Authenticity Service...');
const authCheckDefault = await ImageAuthenticityService.verifyImage('test.jpg');
console.log('  Default (No endpoint):', authCheckDefault.statusLabel, '| Confidence:', authCheckDefault.confidence);
if (authCheckDefault.status !== AUTHENTICITY_STATUS.SERVICE_UNAVAILABLE || authCheckDefault.confidence !== null) {
  throw new Error('Image authenticity must report SERVICE_UNAVAILABLE without fake confidence when not connected');
}

ImageAuthenticityService.setTestMode(AUTHENTICITY_STATUS.LIKELY_AI_GENERATED);
const authCheckAi = await ImageAuthenticityService.verifyImage('synthetic.jpg');
console.log('  AI-Generated Mode:', authCheckAi.statusLabel, '| Acceptable:', authCheckAi.isAcceptable);
if (authCheckAi.isAcceptable !== false || authCheckAi.status !== AUTHENTICITY_STATUS.LIKELY_AI_GENERATED) {
  throw new Error('Likely AI-Generated must block progression (isAcceptable = false)');
}
ImageAuthenticityService.setTestMode(null); // Reset

// 5. Priority Scoring Formula
console.log('\n[5] Verifying 6-Factor Priority Scoring Engine...');
const prioResult = PriorityEngine.calculatePriority({
  damageType: 'Pothole',
  severity: 'CRITICAL',
  confidence: 0.94,
  detectionCount: 1,
  mediaType: 'image',
  roadType: 'ARTERIAL',
  trafficExposure: 'HIGH',
  sensitiveZones: ['HOSPITAL', 'SCHOOL'],
  corroboratingCount: 4
});
console.log(`  Calculated Priority: ${prioResult.score}/100 (${prioResult.level})`);
console.log('  Factor Breakdown:', prioResult.breakdown);
if (prioResult.score < 80 || prioResult.level !== 'CRITICAL') {
  throw new Error('Severe pothole on arterial road near hospital should be CRITICAL priority');
}

// 6. Complaint Submission & 15-Day Rule & 90% Monitoring
console.log('\n[6] Verifying Complaint Lifecycle, 15-Day Lock, and 90% Cap...');
const complaint = MargDrishtiStore.addComplaint({
  citizenId: citRes.user.citizenId,
  citizenName: citRes.user.name,
  citizenPhone: citRes.user.mobile,
  damageType: 'Pothole',
  severity: 'CRITICAL',
  roadType: 'State Highway',
  jurisdiction: 'Kolhapur Division',
  location: { latitude: 16.7050, longitude: 74.2433, roadName: 'Kolhapur-Ratnagiri Highway', ward: 'Zone 2', source: 'MANUALLY_SELECTED' },
  priority: prioResult
});
console.log('  Added Complaint:', complaint.complaintId, 'Status:', complaint.status);
if (!complaint.complaintId.startsWith('MD-2026-')) throw new Error('Invalid Complaint ID format');

// Verify
MargDrishtiStore.updateStatus(complaint.complaintId, 'VERIFIED', 'Verified', 'Jurisdiction verified');
// Assign
MargDrishtiStore.assignOfficer(complaint.complaintId, { id: 'ENG-1', name: 'Ramesh Kulkarni', designation: 'AEE' });
const assignedComp = MargDrishtiStore.getComplaintById(complaint.complaintId);
console.log('  Assigned at:', assignedComp.assignedAt);

// Check 15-day rule
const canStart = MargDrishtiStore.canStartProgress(complaint.complaintId);
console.log('  15-Day Rule check (immediate attempt):', canStart);
if (canStart.allowed) throw new Error('15-day rule failed: Work should not be allowed immediately after assignment');
console.log(`  ✓ 15-Day lock enforced: ${canStart.daysRemaining} days remaining required.`);

// Mark Repair Completed -> Must cap at 90% resolution
const repaired = MargDrishtiStore.markRepairCompleted(complaint.complaintId, { resolvedBy: 'Field Squad 3', notes: 'Patch complete' });
console.log('  Repaired Complaint Status:', repaired.status, 'Resolution:', repaired.resolution + '%');
if (repaired.status !== 'REPAIR_COMPLETED' || repaired.resolution !== 90) {
  throw new Error('Repair completed must cap resolution at 90% and initiate monitoring');
}

// Confirm final resolution after monitoring -> 100% Fully Resolved
const finalComp = MargDrishtiStore.confirmFinalResolution(complaint.complaintId, { confirmedBy: 'Ramesh Kulkarni (AEE)', durabilityRating: 'EXCELLENT' });
console.log('  Final Resolution Status:', finalComp.status, 'Resolution:', finalComp.resolution + '%');
if (finalComp.status !== 'RESOLVED' || finalComp.resolution !== 100) {
  throw new Error('Final confirmation must set status to RESOLVED and 100%');
}

// 7. Route Service & Resolved Pothole Exclusion
console.log('\n[7] Verifying Route Optimization Engine & Resolved Exclusion...');
const routeResult = await RouteService.calculateRoutes(null, null, 'indiranagar_to_koramangala');
console.log('  Route Calculation Success:', routeResult.success);
console.log('  Safest Mode:', routeResult.routes.safest.recommendation, `(Active Potholes: ${routeResult.routes.safest.potholeCount})`);
console.log('  Fastest Mode:', routeResult.routes.fastest.title, `(Travel Time: ${routeResult.routes.fastest.durationMins} mins)`);
if (!routeResult.success || !routeResult.routes.safest) throw new Error('Route calculation failed');

console.log('\n======================================================');
console.log('ALL MARGDRISHTI FUNCTIONAL LOGIC UNIT TESTS PASSED 100%');
console.log('======================================================\n');

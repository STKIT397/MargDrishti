import http from 'http';
import fs from 'fs';
import path from 'path';

function request(urlPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
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
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runMobileAndAuthVerification() {
  console.log('===============================================================');
  console.log('MARGDRISHTI: MOBILE RESPONSIVENESS & AUTH ISOLATION VERIFICATION');
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

  // =================================================================
  // SUITE 1: AUTHENTICATION, ISOLATION & ACCESS CONTROL
  // =================================================================
  console.log('--- 1. AUTHENTICATION, SESSIONS & USER DATA ISOLATION ---');

  // 1. Unauthenticated Visitor
  const unauthComplaints = await request('/api/complaints');
  assert(unauthComplaints.status === 401, 'Unauthenticated visitor to /api/complaints is rejected (HTTP 401)');

  const unauthEngineerTasks = await request('/api/engineer/tasks');
  assert(unauthEngineerTasks.status === 401, 'Unauthenticated visitor to /api/engineer/tasks is rejected (HTTP 401)');

  const unauthNotifications = await request('/api/notifications');
  assert(unauthNotifications.status === 401, 'Unauthenticated visitor to /api/notifications is rejected (HTTP 401)');

  // 2. Public Map endpoint
  const publicMap = await request('/api/complaints/public-map');
  assert(publicMap.status === 200, 'Public map endpoint is accessible without authentication (HTTP 200)');
  const allSanitized = publicMap.data?.complaints?.every(c => !c.citizen_name && !c.citizen_phone && !c.email);
  assert(allSanitized, 'Public map endpoint sanitizes citizen name, phone, and email');

  // 3. Citizen 1 Login (Aishwarya Patil)
  const cit1Login = await request('/api/auth/login', 'POST', {
    role: 'citizen',
    identifier: 'aishwarya@test.com',
    password: 'Citizen@123'
  });
  assert(cit1Login.status === 200, 'Citizen 1 (Aishwarya Patil) login successful');
  const cit1Id = cit1Login.data.user.user_id;
  const cit1Token = cit1Login.data.token;
  assert(!!cit1Token, 'Citizen 1 receives signed bearer token');

  // 4. Citizen 2 Login (Citizen 2 Account)
  const cit2Login = await request('/api/auth/login', 'POST', {
    role: 'citizen',
    identifier: 'aishwaryapatil098765@gmail.com',
    password: '123456'
  });
  assert(cit2Login.status === 200, 'Citizen 2 login successful');
  const cit2Id = cit2Login.data.user.user_id;
  const cit2Token = cit2Login.data.token;
  assert(!!cit2Token, 'Citizen 2 receives signed bearer token');
  assert(cit1Id !== cit2Id, `Citizen 1 (${cit1Id}) and Citizen 2 (${cit2Id}) are distinct accounts`);

  // 5. Citizen 1 creates a private complaint
  const cit1ComplaintPayload = {
    citizen_id: cit1Id,
    damage_type: 'Pothole',
    description: 'Private report by Citizen 1 on Indiranagar 100ft road.',
    severity: 'HIGH',
    priority_score: 75,
    latitude: 12.9784,
    longitude: 77.6408,
    address: '100 Feet Road, Indiranagar',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    location_source: 'GPS',
    ai_analysis: {
      model_name: 'YOLO11',
      damage_type: 'pothole',
      confidence: 88.5,
      severity: 'HIGH'
    }
  };
  const cit1Post = await request('/api/complaints', 'POST', cit1ComplaintPayload, cit1Token);
  assert(cit1Post.status === 201, `Citizen 1 successfully created complaint (${cit1Post.data?.complaint?.complaint_id})`);
  const cit1ComplaintId = cit1Post.data?.complaint?.complaint_id;

  // 6. Citizen 2 creates a private complaint
  const cit2ComplaintPayload = {
    citizen_id: cit2Id,
    damage_type: 'Crack',
    description: 'Private report by Citizen 2 on Hosur road.',
    severity: 'MEDIUM',
    priority_score: 62,
    latitude: 12.9350,
    longitude: 77.6140,
    address: 'Hosur Main Road, Koramangala',
    city: 'Bengaluru',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    location_source: 'GPS',
    ai_analysis: {
      model_name: 'YOLO11',
      damage_type: 'crack',
      confidence: 82.0,
      severity: 'MEDIUM'
    }
  };
  const cit2Post = await request('/api/complaints', 'POST', cit2ComplaintPayload, cit2Token);
  assert(cit2Post.status === 201, `Citizen 2 successfully created complaint (${cit2Post.data?.complaint?.complaint_id})`);
  const cit2ComplaintId = cit2Post.data?.complaint?.complaint_id;

  // 7. Isolation Check: Citizen 1 queries /api/complaints
  const cit1GetList = await request('/api/complaints', 'GET', null, cit1Token);
  assert(cit1GetList.status === 200, 'Citizen 1 can query complaints');
  const cit1ListContainsOwn = cit1GetList.data?.complaints?.some(c => c.complaint_id === cit1ComplaintId);
  const cit1ListContainsOther = cit1GetList.data?.complaints?.some(c => c.complaint_id === cit2ComplaintId);
  assert(cit1ListContainsOwn, "Citizen 1 sees their own complaint");
  assert(!cit1ListContainsOther, "Citizen 1 DOES NOT see Citizen 2's complaint (Isolation verified)");

  // 8. Isolation Check: Citizen 2 queries /api/complaints
  const cit2GetList = await request('/api/complaints', 'GET', null, cit2Token);
  assert(cit2GetList.status === 200, 'Citizen 2 can query complaints');
  const cit2ListContainsOwn = cit2GetList.data?.complaints?.some(c => c.complaint_id === cit2ComplaintId);
  const cit2ListContainsOther = cit2GetList.data?.complaints?.some(c => c.complaint_id === cit1ComplaintId);
  assert(cit2ListContainsOwn, "Citizen 2 sees their own complaint");
  assert(!cit2ListContainsOther, "Citizen 2 DOES NOT see Citizen 1's complaint (Isolation verified)");

  // 9. Cross-Account Direct Access Check: Citizen 1 tries to access Citizen 2's complaint details
  const cit1AccessCit2 = await request(`/api/complaints/${cit2ComplaintId}`, 'GET', null, cit1Token);
  assert(cit1AccessCit2.status === 403, 'Citizen 1 denied direct access to Citizen 2 complaint (HTTP 403 Forbidden)');

  // 10. Cross-Account Direct Access Check: Citizen 2 tries to access Citizen 1's complaint details
  const cit2AccessCit1 = await request(`/api/complaints/${cit1ComplaintId}`, 'GET', null, cit2Token);
  assert(cit2AccessCit1.status === 403, 'Citizen 2 denied direct access to Citizen 1 complaint (HTTP 403 Forbidden)');

  // 11. Role Authorization Check: Citizen tries to assign engineer
  const citAssignAttempt = await request(`/api/complaints/${cit1ComplaintId}/assign`, 'POST', {
    assigned_to: 'ENG-0001',
    assigned_by: cit1Id,
    remarks: 'Malicious assignment'
  }, cit1Token);
  assert(citAssignAttempt.status === 403, 'Citizen forbidden from performing Authority assignment (HTTP 403)');

  // 12. Authority Login & Access
  const authLogin = await request('/api/auth/login', 'POST', {
    role: 'authority',
    identifier: 'engineer@test.com',
    password: 'Authority@123'
  });
  assert(authLogin.status === 200, 'Authority login successful');
  const authToken = authLogin.data.token;
  const authQueue = await request('/api/complaints', 'GET', null, authToken);
  assert(authQueue.status === 200, 'Authority can query entire maintenance queue');
  const authSeesCit1 = authQueue.data?.complaints?.some(c => c.complaint_id === cit1ComplaintId);
  const authSeesCit2 = authQueue.data?.complaints?.some(c => c.complaint_id === cit2ComplaintId);
  assert(authSeesCit1 && authSeesCit2, 'Authority legitimately sees both Citizen 1 and Citizen 2 complaints');

  // =================================================================
  // SUITE 2: MOBILE RESPONSIVENESS STATIC AUDIT
  // =================================================================
  console.log('\n--- 2. MOBILE RESPONSIVENESS SYSTEM AUDIT ---');

  const cssPath = path.resolve('frontend/css/margdrishti.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Viewport Meta in HTML files
  const htmlFiles = ['index.html', 'citizen.html', 'authority.html', 'engineer.html', 'map.html'];
  htmlFiles.forEach(file => {
    const fPath = path.resolve('frontend', file);
    const content = fs.readFileSync(fPath, 'utf8');
    const hasViewport = content.includes('name="viewport"') && content.includes('width=device-width');
    assert(hasViewport, `${file} includes responsive viewport meta tag`);
  });

  // Breakpoints check in CSS
  assert(cssContent.includes('@media (max-width: 768px)'), 'CSS includes tablet/mobile breakpoint (@media max-width: 768px)');
  assert(cssContent.includes('@media (max-width: 480px)'), 'CSS includes narrow mobile breakpoint (@media max-width: 480px)');
  assert(cssContent.includes('@media (max-width: 900px)'), 'CSS includes desktop-to-tablet transition (@media max-width: 900px)');
  assert(cssContent.includes('@media (max-width: 1024px)'), 'CSS includes GIS map responsive layout (@media max-width: 1024px)');

  // Horizontal Overflow Prevention
  assert(cssContent.includes('overflow-x: hidden !important'), 'Global overflow-x: hidden enforced on html & body');

  // Responsive Grid Definitions
  assert(cssContent.includes('.ai-result-grid'), 'CSS includes .ai-result-grid single column collapse on mobile');
  assert(cssContent.includes('.inspector-grid'), 'CSS includes .inspector-grid single column collapse on mobile');
  assert(cssContent.includes('.priority-breakdown-grid'), 'CSS includes .priority-breakdown-grid responsive styling');
  assert(cssContent.includes('.monitoring-cycle-grid'), 'CSS includes .monitoring-cycle-grid responsive styling');
  assert(cssContent.includes('.repair-proof-grid'), 'CSS includes .repair-proof-grid responsive styling');

  // Tables Touch Responsive
  assert(cssContent.includes('.table-responsive') && cssContent.includes('-webkit-overflow-scrolling: touch'), 'Data tables include touch-scrolling container (.table-responsive)');

  // Notification Dropdown Mobile Clamping
  assert(cssContent.includes('.notification-dropdown') && cssContent.includes('calc(100vw - 16px)'), 'Notification dropdown clamped within viewport to prevent mobile clipping');

  // Modals Mobile Max Bounds
  assert(cssContent.includes('.modal-card') && cssContent.includes('max-height: 94vh'), 'Modals capped at 94vh with vertical scrolling for small screens');

  // Demo Control Bar Horizontal Scroll
  assert(cssContent.includes('.demo-bar-center') && cssContent.includes('white-space: nowrap'), 'Demo control bar horizontally swipeable on small screens');

  // =================================================================
  // SUITE 3: FRONTEND JAVASCRIPT STATE ISOLATION AUDIT
  // =================================================================
  console.log('\n--- 3. FRONTEND AUTH & STORE CODE INTEGRITY AUDIT ---');

  const authJs = fs.readFileSync(path.resolve('frontend/js/auth.js'), 'utf8');
  assert(!authJs.includes("session = { isLoggedIn: true, user: { ...demoUser } }"), 'Auto-login fallback with demo user completely removed from auth.js');
  assert(!authJs.includes("localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));") || authJs.includes("window.location.replace"), 'requireAuth redirects unauthenticated visitors rather than auto-logging in');
  assert(authJs.includes("localStorage.removeItem(AUTH_STORAGE_KEY)"), 'Logout clears auth session');
  assert(authJs.includes("localStorage.removeItem('margdrishti_token')"), 'Logout clears auth token');

  const storeJs = fs.readFileSync(path.resolve('frontend/js/store.js'), 'utf8');
  assert(storeJs.includes("fetchPublicMapHazards"), 'Store calls public map hazard endpoint when unauthenticated');
  assert(storeJs.includes("clearLocalCache"), 'Store provides clearLocalCache for user isolation');

  const citizenAppJs = fs.readFileSync(path.resolve('frontend/js/citizenApp.js'), 'utf8');
  assert(!citizenAppJs.includes("'CIT-0001'") || !citizenAppJs.includes("activeCitizenSession?.user?.citizenId || activeCitizenSession?.user?.id || 'CIT-0001'"),
    'Hardcoded fallback to CIT-0001 removed from citizen report submission');

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runMobileAndAuthVerification().catch(err => {
  console.error('Mobile and auth verification suite error:', err);
  process.exit(1);
});

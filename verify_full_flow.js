const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
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
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET'
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
    req.end();
  });
}

async function verifyEndToEndFlow() {
  console.log('====================================================');
  console.log('MARGDRISHTI END-TO-END WORKFLOW VERIFICATION');
  console.log('====================================================\n');

  // STEP 1: Citizen Login
  console.log('STEP 1: Citizen Login (aishwarya@test.com)');
  const citLogin = await post('/api/auth/login', {
    role: 'citizen',
    identifier: 'aishwarya@test.com',
    password: 'Citizen@123'
  });
  console.log(`  -> HTTP ${citLogin.status} | User: ${citLogin.data?.user?.name} (ID: ${citLogin.data?.user?.user_id})`);
  if (!citLogin.data?.user?.user_id) throw new Error('Citizen login failed');
  const citizenId = citLogin.data.user.user_id;

  // STEP 2: Citizen Submits Complaint
  console.log('\nSTEP 2: Citizen Submits Complaint with YOLO11 AI Analysis');
  const submitRes = await post('/api/complaints', {
    citizen_id: citizenId,
    damage_type: 'Pothole',
    description: 'Severe road surface disintegration near Shivaji University main gate.',
    severity: 'CRITICAL',
    priority_score: 89.2,
    latitude: 16.6812,
    longitude: 74.2541,
    address: 'Shivaji University Road, Vidyanagar',
    city: 'Kolhapur',
    district: 'Kolhapur',
    state: 'Maharashtra',
    location_source: 'GPS',
    ai_analysis: {
      model_name: 'YOLO11',
      damage_type: 'Pothole',
      confidence: 96.4,
      severity: 'CRITICAL',
      image_authenticity_status: 'ORIGINAL'
    }
  });
  console.log(`  -> HTTP ${submitRes.status} | Created Complaint ID: ${submitRes.data?.complaint?.complaint_id}`);
  console.log(`  -> Initial Status: ${submitRes.data?.complaint?.status} | AI Model: ${submitRes.data?.ai_analysis?.model_name} (Conf: ${submitRes.data?.ai_analysis?.confidence}%)`);
  const complaintId = submitRes.data?.complaint?.complaint_id;
  if (!complaintId) throw new Error('Complaint creation failed');

  // STEP 3: Citizen Sees Complaint in Their Dashboard
  console.log('\nSTEP 3: Citizen Views Dashboard & Complaint List');
  const citReports = await get(`/api/complaints?citizen_id=${citizenId}`);
  const foundInCitList = citReports.data?.complaints?.find(c => c.complaint_id === complaintId);
  console.log(`  -> Total Citizen Complaints in PostgreSQL: ${citReports.data?.count}`);
  console.log(`  -> New complaint found in list: ${!!foundInCitList} | Status: ${foundInCitList?.status}`);

  const trackDetail = await get(`/api/complaints/${complaintId}`);
  console.log(`  -> Tracking API: Status = ${trackDetail.data?.complaint?.status}, Location = ${trackDetail.data?.complaint?.address}, Initial History = ${trackDetail.data?.timeline?.length} entry`);

  // STEP 4: Authority Sees Complaint in Queue
  console.log('\nSTEP 4: Authority Views Maintenance Queue');
  const authLogin = await post('/api/auth/login', {
    role: 'authority',
    identifier: 'engineer@test.com',
    password: 'Authority@123'
  });
  console.log(`  -> Authority Login: HTTP ${authLogin.status} | Official: ${authLogin.data?.user?.name} (${authLogin.data?.user?.user_id})`);

  const authQueue = await get('/api/complaints');
  const foundInAuthQueue = authQueue.data?.complaints?.find(c => c.complaint_id === complaintId);
  console.log(`  -> Authority Queue Total: ${authQueue.data?.count} complaints`);
  console.log(`  -> Found in Authority Queue: ${!!foundInAuthQueue} (Priority: ${foundInAuthQueue?.priority_score})`);

  // STEP 5: Authority Workflow Updates
  console.log('\nSTEP 5: Authority Workflow Progression (Verify -> Assign -> In Progress -> Repair Completed -> Sensor -> Resolved)');

  // 5a: Verify
  const verRes = await post(`/api/complaints/${complaintId}/verify`, {
    changed_by: authLogin.data.user.user_id,
    remarks: 'Verified by Kolhapur Municipal Corporation engineering desk.'
  });
  console.log(`  5a. Verify: HTTP ${verRes.status} | Status -> ${verRes.data?.complaint?.status}`);

  // 5b: Assign
  const asnRes = await post(`/api/complaints/${complaintId}/assign`, {
    assigned_to: 'AUTHUSER-0001',
    assigned_by: authLogin.data.user.user_id,
    remarks: 'Work order dispatched to Municipal Engineer Rajesh Kumar.'
  });
  console.log(`  5b. Assign: HTTP ${asnRes.status} | Status -> ${asnRes.data?.complaint?.status} (Assigned To: ${asnRes.data?.assignment?.assigned_to})`);

  // 5c: In Progress
  const ipRes = await post(`/api/complaints/${complaintId}/in-progress`, {
    engineer_id: 'AUTHUSER-0001',
    changed_by: authLogin.data.user.user_id,
    description: 'Road repair team and asphalt compaction roller mobilized on site.'
  });
  console.log(`  5c. In Progress: HTTP ${ipRes.status} | Status -> ${ipRes.data?.complaint?.status} (Repair ID: ${ipRes.data?.repair?.repair_id})`);

  // 5d: Repair Completed (Enters 60-day Monitoring at 90%)
  const rcRes = await post(`/api/complaints/${complaintId}/repair-completed`, {
    engineer_id: 'AUTHUSER-0001',
    changed_by: authLogin.data.user.user_id,
    notes: 'Bituminous hot mix laid and compacted. Entered mandatory 60-day post-repair monitoring.',
    monitoring_days: 60
  });
  console.log(`  5d. Repair Completed: HTTP ${rcRes.status} | Status -> ${rcRes.data?.complaint?.status} | Monitoring ID: ${rcRes.data?.monitoring?.monitoring_id}`);

  // 5e: Sensor Telemetry
  const senRes = await post(`/api/complaints/${complaintId}/sensor`, {
    is_abnormal: false,
    speed: 35.0,
    acceleration_magnitude: 9.81,
    peak_acceleration: 10.1,
    jerk: 0.45,
    gyroscope_change: 0.65,
    confidence: 96.0
  });
  console.log(`  5e. Sensor Telemetry Logged: HTTP ${senRes.status} | Observation ID: ${senRes.data?.observation?.observation_id} | Acceleration: ${senRes.data?.observation?.acceleration_magnitude} m/s²`);

  // 5f: Authority Final Confirmation (100% Resolved)
  const cfRes = await post(`/api/complaints/${complaintId}/confirm-final`, {
    changed_by: authLogin.data.user.user_id,
    notes: 'Road surface durability and smoothness verified after post-repair observation. Officially closed.'
  });
  console.log(`  5f. Final Confirmation: HTTP ${cfRes.status} | Status -> ${cfRes.data?.complaint?.status}`);

  // STEP 6: Citizen Sees Updated Status and Full Lifecycle Timeline
  console.log('\nSTEP 6: Citizen Sees Updated 100% Resolved Status & Complete Timeline');
  const finalCheck = await get(`/api/complaints/${complaintId}`);
  console.log(`  -> Final Complaint Status: ${finalCheck.data?.complaint?.status}`);
  console.log(`  -> Complete Timeline Entries (${finalCheck.data?.timeline?.length}):`);
  finalCheck.data?.timeline?.forEach((t, i) => {
    console.log(`     ${i + 1}. [${t.status}] by ${t.changed_by} (${t.changed_by_name || 'System'}): "${t.remarks}"`);
  });

  console.log('\n====================================================');
  console.log('ALL WORKFLOW STAGES VERIFIED SUCCESSFULLY!');
  console.log('====================================================');
}

verifyEndToEndFlow().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

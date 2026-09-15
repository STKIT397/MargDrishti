/**
 * MargDrishti — Landing Page Interactive Engine & Authentication Controller
 * 3D Perspective Canvas Road, Step Pipeline Simulator, Telemetry Counters,
 * and Dual-Role (Citizen/Authority) Authentication Modal.
 */

import { MargDrishtiStore } from './store.js';
import { AuthService, DEMO_CREDENTIALS } from './auth.js';

export const ROAD_AUTHORITY_MAP = {
  'City / Municipal Road': 'Municipal Corporation / Municipal Council',
  'State Highway': 'State PWD',
  'National Highway': 'NHAI / Relevant NH Authority',
  'Rural / Village Road': 'Zilla Parishad / Rural Development Authority / PWD',
  'Private / Society Road': 'Society / Developer / Private Owner'
};

let activeRole = 'citizen'; // 'citizen' | 'authority'
let activeMode = 'login';   // 'login' | 'signup'

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  initRoadCanvas();
  initPipeline();
  initStatsObserver();
  initAuthUI();

  // Handle Demo Reset
  const resetBtns = document.querySelectorAll('.demo-btn-reset');
  resetBtns.forEach(b => {
    b.addEventListener('click', () => {
      MargDrishtiStore.resetDatabase();
      alert('MargDrishti demo database reset to default seed records.');
      window.location.reload();
    });
  });
});

/* ================= 1. Authentication UI Controller ================= */
function initAuthUI() {
  updateNavAuthState();

  // Check URL parameters
  const params = new URLSearchParams(window.location.search);
  if (params.get('login')) {
    const role = params.get('login') === 'authority' ? 'authority' : 'citizen';
    openAuthModal(role, 'login');
  } else if (params.get('signup')) {
    openAuthModal('citizen', 'signup');
  }

  if (params.get('logged_out')) {
    showToast('Session Ended', 'You have been logged out successfully.');
  }

  if (params.get('unauthorized')) {
    const requiredRole = params.get('role') || 'authorized user';
    showToast('Access Protected', `Please log in as a ${requiredRole} to access that console.`);
  }

  // Bind Form Submissions
  const loginForm = document.getElementById('authLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  const signupForm = document.getElementById('authSignupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignupSubmit);
  }

  // Bind Road Type -> Responsible Authority auto-mapping
  const roadTypeSelect = document.getElementById('signupRoadTypeSelect');
  const respAuthInput = document.getElementById('signupResponsibleAuthorityInput');
  if (roadTypeSelect && respAuthInput) {
    roadTypeSelect.addEventListener('change', () => {
      respAuthInput.value = ROAD_AUTHORITY_MAP[roadTypeSelect.value] || '';
    });
  }

  // Listen to auth changes
  window.addEventListener('margdrishti:auth_changed', () => {
    updateNavAuthState();
  });
}

function updateNavAuthState() {
  const container = document.getElementById('navAuthContainer');
  if (!container) return;

  const session = AuthService.getCurrentUser();

  if (session && session.isLoggedIn && session.user) {
    const isAuthority = session.role === 'authority';
    const targetUrl = isAuthority ? 'authority.html' : 'citizen.html';
    const initial = (session.user.name || 'U').charAt(0).toUpperCase();

    container.innerHTML = `
      <div class="user-profile-chip">
        <div class="user-avatar-dot ${isAuthority ? 'authority' : ''}">${initial}</div>
        <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.1;">
          <span style="font-weight: 700; font-size: 0.82rem;">${session.user.name}</span>
          <span style="font-size: 0.68rem; color: var(--text-muted); text-transform: capitalize;">${session.role}</span>
        </div>
        <a href="${targetUrl}" class="btn btn-primary btn-sm" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">
          <span>${isAuthority ? 'Authority Queue' : 'Citizen Dashboard'}</span>
          <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
        </a>
        <button type="button" class="btn-logout" onclick="window.handleLogout()">
          <i data-lucide="log-out" style="width: 12px; height: 12px;"></i>
          <span>Logout</span>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.openAuthModal('citizen', 'login')">
        <i data-lucide="log-in" style="width: 13px; height: 13px;"></i>
        <span>Login</span>
      </button>
      <button type="button" class="btn btn-primary btn-sm" onclick="window.openAuthModal('citizen', 'signup')">
        <i data-lucide="user-plus" style="width: 13px; height: 13px;"></i>
        <span>Sign Up</span>
      </button>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

window.openAuthModal = function(role = 'citizen', mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;

  modal.classList.add('active');
  window.setAuthRole(role);
  window.setAuthMode(mode);
};

window.closeAuthModal = function() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
  clearAuthErrors();
};

window.setAuthRole = function(role) {
  activeRole = role;

  const tabCitizen = document.getElementById('modalRoleCitizen');
  const tabAuthority = document.getElementById('modalRoleAuthority');
  const authNotice = document.getElementById('authAuthorityNotice');
  const submitBtnText = document.getElementById('btnLoginSubmitText');
  const autofillLabel = document.getElementById('autofillRoleLabel');
  const authFields = document.getElementById('signupAuthorityFields');
  const signupBtnText = document.getElementById('btnSignupSubmitText');

  if (tabCitizen && tabAuthority) {
    tabCitizen.classList.toggle('active', role === 'citizen');
    tabAuthority.classList.toggle('active', role === 'authority');
  }

  if (role === 'authority') {
    if (authNotice) {
      authNotice.style.display = 'block';
      authNotice.innerHTML = `
        <i data-lucide="shield-check" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; color: #059669;"></i>
        <strong>Official Authority Portal.</strong> Log in or register an authorized municipal engineering account.
      `;
    }
    if (submitBtnText) submitBtnText.textContent = 'Login as Authority Official';
    if (autofillLabel) autofillLabel.textContent = 'Authority Demo Account';
    if (authFields) authFields.style.display = 'block';
    if (signupBtnText) signupBtnText.textContent = 'Register Authority Officer';
  } else {
    if (authNotice) authNotice.style.display = 'none';
    if (submitBtnText) submitBtnText.textContent = 'Login to Citizen Portal';
    if (autofillLabel) autofillLabel.textContent = 'Citizen Demo Account';
    if (authFields) authFields.style.display = 'none';
    if (signupBtnText) signupBtnText.textContent = 'Create Citizen Account';
  }

  if (window.lucide) window.lucide.createIcons();
  clearAuthErrors();
};

window.setAuthMode = function(mode) {
  activeMode = mode;

  const btnLogin = document.getElementById('btnSwitchLogin');
  const btnSignup = document.getElementById('btnSwitchSignup');
  const loginForm = document.getElementById('authLoginForm');
  const signupForm = document.getElementById('authSignupForm');
  const authFields = document.getElementById('signupAuthorityFields');

  if (btnLogin && btnSignup) {
    btnLogin.classList.toggle('active', mode === 'login');
    btnSignup.classList.toggle('active', mode === 'signup');
  }

  if (loginForm && signupForm) {
    loginForm.style.display = mode === 'login' ? 'block' : 'none';
    signupForm.style.display = mode === 'signup' ? 'block' : 'none';
  }

  if (authFields) {
    authFields.style.display = (mode === 'signup' && activeRole === 'authority') ? 'block' : 'none';
  }

  clearAuthErrors();
};

window.fillDemoLogin = function() {
  const emailInput = document.getElementById('loginEmailInput');
  const passInput = document.getElementById('loginPasswordInput');

  if (activeRole === 'citizen') {
    if (emailInput) emailInput.value = DEMO_CREDENTIALS.citizen.email;
    if (passInput) passInput.value = DEMO_CREDENTIALS.citizen.password;
  } else {
    if (emailInput) emailInput.value = DEMO_CREDENTIALS.authority.email;
    if (passInput) passInput.value = DEMO_CREDENTIALS.authority.password;
  }

  showToast('Credentials Filled', `Loaded ${activeRole.toUpperCase()} demo credentials.`);
};

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('loginEmailInput')?.value || '';
  const password = document.getElementById('loginPasswordInput')?.value || '';
  const submitBtn = document.getElementById('btnLoginSubmit');
  const submitText = document.getElementById('btnLoginSubmitText');
  const errorBox = document.getElementById('loginErrorBox');

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Authenticating...';

  // Simulated latency
  await new Promise(r => setTimeout(r, 600));

  const res = AuthService.login(activeRole, email, password);

  if (!res.success) {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = activeRole === 'authority' ? 'Login as Authority Official' : 'Login to Citizen Portal';
    if (errorBox) {
      errorBox.textContent = res.error;
      errorBox.classList.remove('hidden');
    }
    return;
  }

  if (submitText) submitText.textContent = 'Login Successful! Redirecting...';
  showToast('Welcome!', `Logged in as ${res.session.user.name}.`);

  setTimeout(() => {
    window.location.href = activeRole === 'authority' ? 'authority.html' : 'citizen.html';
  }, 700);
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const name = document.getElementById('signupNameInput')?.value || '';
  const email = document.getElementById('signupEmailInput')?.value || '';
  const mobile = document.getElementById('signupMobileInput')?.value || '';
  const roadType = document.getElementById('signupRoadTypeSelect')?.value || '';
  const responsibleAuthority = ROAD_AUTHORITY_MAP[roadType] || '';
  const jurisdiction = document.getElementById('signupJurisdictionInput')?.value || '';
  const department = document.getElementById('signupDepartmentInput')?.value || '';
  const password = document.getElementById('signupPasswordInput')?.value || '';
  const confirmPassword = document.getElementById('signupConfirmPasswordInput')?.value || '';

  const submitBtn = document.getElementById('btnSignupSubmit');
  const submitText = document.getElementById('btnSignupSubmitText');
  const errorBox = document.getElementById('signupErrorBox');
  const successBox = document.getElementById('signupSuccessBox');

  if (activeRole === 'authority' && !roadType) {
    if (errorBox) {
      errorBox.textContent = 'Please select a Road / Location Type for your authority account.';
      errorBox.classList.remove('hidden');
    }
    return;
  }

  if (activeRole === 'authority' && !jurisdiction.trim()) {
    if (errorBox) {
      errorBox.textContent = 'Please specify your Jurisdiction / Area (e.g. Kolhapur City, Ward 5, NH-48 Section).';
      errorBox.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = activeRole === 'authority' ? 'Registering Officer...' : 'Creating Citizen Account...';

  await new Promise(r => setTimeout(r, 700));

  const res = AuthService.signup({ 
    role: activeRole, 
    name, 
    email, 
    mobile, 
    roadType,
    responsibleAuthority,
    jurisdiction,
    department: department || responsibleAuthority, 
    password, 
    confirmPassword 
  });

  if (!res.success) {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = activeRole === 'authority' ? 'Register Authority Officer' : 'Create Citizen Account';
    if (errorBox) {
      errorBox.textContent = res.error;
      errorBox.classList.remove('hidden');
    }
    return;
  }

  if (successBox) {
    const assignedId = activeRole === 'authority' ? (res.user.authorityId || res.user.id) : (res.user.citizenId || res.user.id);
    successBox.innerHTML = `
      <strong>${activeRole === 'authority' ? 'Authority Officer' : 'Citizen'} Account Registered!</strong><br/>
      Generated Official ID: <strong class="font-mono" style="color: #0284c7;">${assignedId}</strong><br/>
      Switching to login...
    `;
    successBox.classList.remove('hidden');
  }

  setTimeout(() => {
    window.setAuthMode('login');
    const loginEmail = document.getElementById('loginEmailInput');
    const loginPass = document.getElementById('loginPasswordInput');
    if (loginEmail) loginEmail.value = email;
    if (loginPass) loginPass.value = password;
    showToast('Registration Complete', `Account ID ${activeRole === 'authority' ? res.user.authorityId : res.user.citizenId} created.`);
  }, 1500);
}

window.handleHeroCitizenAction = function() {
  const session = AuthService.getCurrentUser();
  if (session && session.isLoggedIn && session.role === 'citizen') {
    window.location.href = 'citizen.html?action=report';
  } else {
    openAuthModal('citizen', 'login');
    showToast('Login Required', 'Please log in or sign up as a citizen to submit road reports.');
  }
};

window.handleHeroAuthorityAction = function() {
  const session = AuthService.getCurrentUser();
  if (session && session.isLoggedIn && session.role === 'authority') {
    window.location.href = 'authority.html';
  } else {
    openAuthModal('authority', 'login');
    showToast('Authority Sign-In', 'Municipal credential authentication required for triage console.');
  }
};

window.handleLogout = function() {
  AuthService.logout();
};

function clearAuthErrors() {
  const loginErr = document.getElementById('loginErrorBox');
  const signupErr = document.getElementById('signupErrorBox');
  const signupSucc = document.getElementById('signupSuccessBox');

  if (loginErr) loginErr.classList.add('hidden');
  if (signupErr) signupErr.classList.add('hidden');
  if (signupSucc) signupSucc.classList.add('hidden');
}

/* ================= 2. 3D Perspective Road Canvas ================= */
function initRoadCanvas() {
  const canvas = document.getElementById('roadCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let dpr = window.devicePixelRatio || 1;
  let width = canvas.parentElement.offsetWidth;
  let height = canvas.parentElement.offsetHeight;

  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    width = canvas.parentElement.offsetWidth;
    height = canvas.parentElement.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let offset = 0;
  const speed = 1.3;
  let mouseX = width / 2;
  let targetMouseX = width / 2;

  window.addEventListener('mousemove', (e) => {
    targetMouseX = e.clientX;
  });

  const scanRings = [];

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    scanRings.push({
      x: clickX,
      y: clickY,
      radius: 4,
      maxRadius: 100,
      opacity: 1
    });
  });

  function render() {
    ctx.clearRect(0, 0, width, height);

    mouseX += (targetMouseX - mouseX) * 0.05;
    const tiltX = (mouseX / width - 0.5) * 60;

    const horizonY = height * 0.22;
    const horizonX = width * 0.5 + tiltX * 0.4;

    const roadTopWidth = width * 0.12;
    const roadBottomWidth = Math.max(width * 0.72, 650);

    // Dark Road Surface (Trapezoid)
    ctx.beginPath();
    ctx.moveTo(horizonX - roadTopWidth / 2, horizonY);
    ctx.lineTo(horizonX + roadTopWidth / 2, horizonY);
    ctx.lineTo(width / 2 + roadBottomWidth / 2 + tiltX, height);
    ctx.lineTo(width / 2 - roadBottomWidth / 2 + tiltX, height);
    ctx.closePath();

    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    roadGrad.addColorStop(0, '#090e17');
    roadGrad.addColorStop(0.4, '#0f172a');
    roadGrad.addColorStop(1, '#0a0f1d');

    ctx.fillStyle = roadGrad;
    ctx.fill();

    // Side glowing borders
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.stroke();

    // Side guide markings
    const shoulderTopW = roadTopWidth * 0.82;
    const shoulderBottomW = roadBottomWidth * 0.86;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';

    ctx.beginPath();
    ctx.moveTo(horizonX - shoulderTopW / 2, horizonY);
    ctx.lineTo(width / 2 - shoulderBottomW / 2 + tiltX, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(horizonX + shoulderTopW / 2, horizonY);
    ctx.lineTo(width / 2 + shoulderBottomW / 2 + tiltX, height);
    ctx.stroke();

    // Perspective Cross Grid lines
    offset = (offset + speed) % 50;
    const numLines = 12;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';

    for (let i = 0; i < numLines; i++) {
      const p = (i * 50 + offset) / (numLines * 50);
      const curY = horizonY + Math.pow(p, 2) * (height - horizonY);
      const curW = roadTopWidth + (roadBottomWidth - roadTopWidth) * p;
      const curCenterX = horizonX + (width / 2 + tiltX - horizonX) * p;

      ctx.beginPath();
      ctx.moveTo(curCenterX - curW / 2, curY);
      ctx.lineTo(curCenterX + curW / 2, curY);
      ctx.stroke();
    }

    // Center Dashed Yellow Lane Marker
    const numDashes = 10;
    for (let i = 0; i < numDashes; i++) {
      const p1 = (i * 50 + offset) / (numDashes * 50);
      const p2 = (i * 50 + 25 + offset) / (numDashes * 50);

      if (p2 <= 1.0) {
        const y1 = horizonY + Math.pow(p1, 2) * (height - horizonY);
        const y2 = horizonY + Math.pow(p2, 2) * (height - horizonY);
        const x1 = horizonX + (width / 2 + tiltX - horizonX) * p1;
        const x2 = horizonX + (width / 2 + tiltX - horizonX) * p2;

        ctx.lineWidth = 2 + p1 * 3;
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Click ripples
    for (let i = scanRings.length - 1; i >= 0; i--) {
      const ring = scanRings[i];
      ring.radius += 2.5;
      ring.opacity -= 0.025;

      if (ring.opacity <= 0) {
        scanRings.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6, 182, 212, ${ring.opacity})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  render();
}

/* ================= 3. Step Pipeline Simulator ================= */
const PIPELINE_STEPS = [
  {
    step: 1,
    title: 'CAPTURE & REPORT',
    desc: 'Citizen captures high-res road damage via smartphone camera or dashcam video with device GPS coordinates.',
    previewImg: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=700&q=80',
    meta: 'Accepted: JPG, PNG, MP4 • Geolocation Acquired • Auto-compression'
  },
  {
    step: 2,
    title: 'YOLO11 AI INFERENCE',
    desc: 'Computer vision neural network localizes potholes, fissures, and cracks with bounding coordinates and class confidence.',
    previewImg: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=700&q=80',
    meta: 'Model: YOLO11-RDD2022 • Confidence: 94% • Inference Latency: 142ms',
    hasBox: true
  },
  {
    step: 3,
    title: 'EXPLAINABLE PRIORITY',
    desc: 'MargDrishti prioritizes by combining defect severity with road classification, peak transit traffic, and hospital/school proximity.',
    previewImg: 'https://images.unsplash.com/photo-1584463699039-38374972412e?auto=format&fit=crop&w=700&q=80',
    meta: 'Priority Score: 92/100 (CRITICAL) • 6-Factor Civic Risk Weights Applied'
  },
  {
    step: 4,
    title: 'AUTHORITY QUEUE & DISPATCH',
    desc: 'Municipal engineers view sorted triage queue and dispatch repair work orders with GPS routing directly to field personnel.',
    previewImg: 'https://images.unsplash.com/photo-1578983424935-7a45610ecfb3?auto=format&fit=crop&w=700&q=80',
    meta: 'Assigned Officer: Rajesh Kumar (AEE) • SLA: 24-48 Hours'
  },
  {
    step: 5,
    title: 'VERIFIED RESOLUTION',
    desc: 'Field crew submits post-repair photographic proof. Complaint status moves to Resolved and Citizen is updated instantly.',
    previewImg: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=700&q=80',
    meta: 'Status: RESOLVED • Repair Evidence Attached • Citizen Notified'
  }
];

let activeStep = 1;

function initPipeline() {
  const container = document.getElementById('stepSimulatorBody');
  if (!container) return;

  renderSimulatorStep(1);

  const stepItems = document.querySelectorAll('.pipeline-step-box');
  stepItems.forEach((box) => {
    box.addEventListener('click', () => {
      const step = parseInt(box.dataset.step, 10);
      selectStep(step);
    });
  });
}

window.selectStep = function(stepNum) {
  activeStep = stepNum;
  document.querySelectorAll('.pipeline-step-box').forEach((box) => {
    box.classList.toggle('active', parseInt(box.dataset.step, 10) === stepNum);
  });
  renderSimulatorStep(stepNum);
};

function renderSimulatorStep(stepNum) {
  const container = document.getElementById('stepSimulatorBody');
  if (!container) return;

  const data = PIPELINE_STEPS.find(s => s.step === stepNum) || PIPELINE_STEPS[0];

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: center;">
      <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #334155; background: #0a0f1d;">
        <img src="${data.previewImg}" alt="${data.title}" style="width: 100%; height: 230px; object-fit: cover; opacity: 0.9;" />
        ${data.hasBox ? `
          <div style="position: absolute; top: 32%; left: 24%; width: 45%; height: 40%; border: 2.5px solid #ef4444; background: rgba(239, 68, 68, 0.2); border-radius: 4px;">
            <span style="position: absolute; top: -20px; left: -2px; background: #dc2626; color: #fff; font-size: 10px; font-weight: 700; font-family: monospace; padding: 2px 6px; border-radius: 3px;">
              POTHOLE 94%
            </span>
          </div>
        ` : ''}
        <div style="position: absolute; bottom: 8px; left: 8px; right: 8px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-family: monospace; color: #38bdf8;">
          ${data.meta}
        </div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #0891b2; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">
          Step 0${data.step} Demonstration
        </div>
        <h3 style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
          ${data.title}
        </h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          ${data.desc}
        </p>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-primary btn-sm" onclick="window.handleHeroCitizenAction()">
            <span>Citizen Portal</span> →
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.handleHeroAuthorityAction()">
            <span>Authority Portal</span>
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/* ================= 4. Telemetry Counter ================= */
function initStatsObserver() {
  const section = document.getElementById('telemetry-section');
  if (!section) return;

  const all = MargDrishtiStore.getAllComplaints();
  const totalReports = all.length;
  const repairsClosed = all.filter(c => c.status === 'RESOLVED').length;
  const corridorsMonitored = all.filter(c => c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED').length;

  let hasAnimated = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        animateNumber('statReports', 0, totalReports, 1000, true);
        animateNumber('statAccuracy', 0, 94.2, 1000, false, 1);
        animateNumber('statRepairs', 0, repairsClosed, 1000, true);
        animateNumber('statCorridors', 0, corridorsMonitored, 1000, false);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(section);
}

function animateNumber(id, start, end, duration, commas = false, decimals = 0) {
  const el = document.getElementById(id);
  if (!el) return;

  const startTime = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = start + (end - start) * ease;
    el.textContent = decimals > 0 ? val.toFixed(decimals) : (commas ? Math.floor(val).toLocaleString() : Math.floor(val));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ================= 5. Toast Notification Helper ================= */
function showToast(title, message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i data-lucide="info" style="width: 18px; height: 18px; color: var(--cyan-glow);"></i>
    <div>
      <div style="font-weight: 700; font-size: 0.85rem;">${title}</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * MargDrishti — Citizen Dashboard & Reporting Workflow Controller
 * Manages evidence upload, geolocation, YOLO11 AI scanning, priority computation,
 * complaint submission, and real-time tracking timeline.
 */

import { MargDrishtiStore } from './store.js';
import { SAMPLE_ROAD_IMAGES, SAMPLE_VIDEO_PREVIEWS } from './mockData.js';
import { AiService } from './aiService.js';
import { PriorityEngine } from './priorityEngine.js';
import { GeoService } from './geoService.js';
import { renderBoundingBoxesOnCanvas } from './boundingBox.js';
import { AuthService } from './auth.js';
import { I18n } from './i18n.js';
import { fetchComplaintById } from './api.js';
import { NotificationUI } from './notifications.js';

// Application State
let currentStep = 1;
let selectedMediaType = 'image'; // 'image' | 'video'
let activeMediaUrl = null;
let activeVideoDetails = null;
let activeLocation = { ...GeoService.DEMO_FALLBACK };
let activeAiResult = null;
let activePriority = null;
let leafletMapInstance = null;
let activeCitizenSession = null;
let citizenNotifications = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce Citizen Route Protection
  activeCitizenSession = AuthService.requireAuth('citizen', 'index.html?login=citizen');
  if (!activeCitizenSession) return;

  if (window.lucide) window.lucide.createIcons();

  initCitizenProfile();

  // Initialize In-App Notification System
  const citizenId = activeCitizenSession?.user?.citizenId || activeCitizenSession?.user?.id || 'CIT-0001';
  citizenNotifications = new NotificationUI({
    containerId: 'citizenNotificationBellContainer',
    recipientId: citizenId,
    onSelectComplaint: (cid) => openTrackingModal(cid)
  });

  await MargDrishtiStore.fetchFromBackend();
  initKPIs();
  initMyReports();
  initWizardEvents();
  initTrackingSearch();
  initSmartphoneSensors();

  // Listen to store updates
  window.addEventListener('margdrishti:updated', () => {
    initKPIs();
    initMyReports();
    refreshActiveTrackingIfOpen();
  });

  // Listen to language changes
  window.addEventListener('margdrishti:lang_changed', () => {
    initKPIs();
    initMyReports();
    refreshActiveTrackingIfOpen();
  });

  // Check URL query parameters (e.g. ?action=report or ?track=MD-2026-0001)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'report') {
    openReportModal();
  }
  if (urlParams.get('track')) {
    openTrackingModal(urlParams.get('track'));
  }

  // Demo database reset button
  const resetBtn = document.querySelector('.demo-btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      MargDrishtiStore.resetDatabase();
      showToast('Demo Reset', 'Database reset to default seed complaints.');
      setTimeout(() => window.location.reload(), 600);
    });
  }
});

/* ================= 0. Profile & Authentication ================= */
function initCitizenProfile() {
  if (!activeCitizenSession || !activeCitizenSession.user) return;
  const nameEl = document.getElementById('citizenDisplayName');
  const emailEl = document.getElementById('citizenDisplayEmail');
  const dotEl = document.getElementById('citizenAvatarDot');
  const idEl = document.getElementById('citizenDisplayId');

  const user = activeCitizenSession.user;
  if (nameEl) nameEl.textContent = user.name || 'Aishwarya Patil';
  if (emailEl) emailEl.textContent = user.email || 'aishwarya@test.com';
  if (dotEl) dotEl.textContent = (user.name || 'A').charAt(0).toUpperCase();
  if (idEl) idEl.textContent = user.citizenId || user.id || 'CIT-0001';
}

window.citizenLogout = function() {
  AuthService.logout();
};

/* ================= 1. KPI Metrics ================= */
function initKPIs() {
  const curCitizenId = activeCitizenSession?.user?.citizenId || activeCitizenSession?.user?.id || 'CIT-0001';
  const allComplaints = MargDrishtiStore.getAllComplaints();
  const complaints = curCitizenId 
    ? allComplaints.filter(c => c.citizenId === curCitizenId)
    : allComplaints;

  const totalEl = document.getElementById('kpiTotalReports');
  const pendingEl = document.getElementById('kpiPending');
  const progressEl = document.getElementById('kpiInProgress');
  const resolvedEl = document.getElementById('kpiResolved');

  const pendingCount = complaints.filter(c => c.status === 'REPORTED' || c.status === 'AI_ANALYZED' || c.status === 'VERIFIED' || c.status === 'ASSIGNED').length;
  const inProgressCount = complaints.filter(c => c.status === 'IN_PROGRESS' || c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED').length;
  const resolvedCount = complaints.filter(c => c.status === 'RESOLVED').length;

  if (totalEl) totalEl.textContent = complaints.length;
  if (pendingEl) pendingEl.textContent = pendingCount;
  if (progressEl) progressEl.textContent = inProgressCount;
  if (resolvedEl) resolvedEl.textContent = resolvedCount;
}

/* ================= 2. My Reports Table ================= */
function initMyReports() {
  const tbody = document.getElementById('myReportsTbody');
  if (!tbody) return;

  const curCitizenId = activeCitizenSession?.user?.citizenId;
  const allComplaints = MargDrishtiStore.getAllComplaints();
  const complaints = curCitizenId 
    ? allComplaints.filter(c => c.citizenId === curCitizenId)
    : allComplaints;

  if (complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem 1.5rem;" class="text-muted">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
            <i data-lucide="inbox" style="width: 42px; height: 42px; stroke-width: 1.25; color: #94a3b8;"></i>
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-secondary);">No complaints yet</div>
            <div style="font-size: 0.82rem; max-width: 380px; line-height: 1.4; color: var(--text-muted);">
              You haven't reported any road defects yet. Help keep our roads safe by reporting potholes, cracks, or surface damage in your area.
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.openReportModal && window.openReportModal()" style="margin-top: 0.5rem;">
              <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i>
              <span>Report Road Damage</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  tbody.innerHTML = complaints.map(c => {
    const isVideo = c.mediaType === 'video';
    const prioScore = c.priority?.score || 50;
    const prioLevel = c.priority?.level || 'MEDIUM';

    let prioBadgeClass = 'badge-priority-medium';
    if (prioScore >= 80) prioBadgeClass = 'badge-priority-critical';
    else if (prioScore >= 60) prioBadgeClass = 'badge-priority-high';

    let statusBadgeClass = 'badge-status-reported';
    let statusLabel = I18n.t('status.reported', 'Reported');
    if (c.status === 'AI_ANALYZED') { statusBadgeClass = 'badge-status-analyzed'; statusLabel = I18n.t('status.analyzed', 'AI Analyzed'); }
    else if (c.status === 'VERIFIED') { statusBadgeClass = 'badge-status-verified'; statusLabel = I18n.t('status.verified', 'Verified'); }
    else if (c.status === 'ASSIGNED') { statusBadgeClass = 'badge-status-assigned'; statusLabel = I18n.t('status.assigned', 'Assigned'); }
    else if (c.status === 'IN_PROGRESS') { statusBadgeClass = 'badge-status-in-progress'; statusLabel = I18n.t('status.inProgress', 'In Progress'); }
    else if (c.status === 'REPAIR_COMPLETED') { statusBadgeClass = 'badge-status-monitoring'; statusLabel = I18n.t('status.monitoring', 'Under Monitoring (90%)'); }
    else if (c.status === 'CONFIRMATION_REQUIRED') { statusBadgeClass = 'badge-status-confirmation'; statusLabel = I18n.t('status.confirmationRequired', 'Confirmation Required'); }
    else if (c.status === 'REINSPECTION_REQUIRED') { statusBadgeClass = 'badge-status-reinspection'; statusLabel = I18n.t('status.reinspection', 'Reinspection Required'); }
    else if (c.status === 'RESOLVED') { statusBadgeClass = 'badge-status-resolved'; statusLabel = I18n.t('status.resolved', '100% Resolved'); }

    return `
      <tr>
        <td>
          <span class="font-mono font-bold" style="color: var(--cyan-dark);">${c.complaintId}</span>
        </td>
        <td>
          <span class="badge ${isVideo ? 'badge-media-video' : 'badge-media-image'}">
            <i data-lucide="${isVideo ? 'video' : 'image'}" style="width: 12px; height: 12px;"></i>
            ${isVideo ? 'Video' : 'Image'}
          </span>
        </td>
        <td>
          <strong style="font-size: 0.85rem;">${c.damageType}</strong>
          <span class="text-xs text-muted" style="display: block;">Conf: ${Math.round((c.confidence || 0.9) * 100)}%</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 600;">${c.location?.roadName || 'Unknown Road'}</div>
          <div class="text-xs text-muted">${c.location?.ward || ''}</div>
        </td>
        <td>
          <span class="badge ${prioBadgeClass}">
            ${prioScore} / 100 • ${prioLevel}
          </span>
        </td>
        <td>
          <span class="badge ${statusBadgeClass}">
            ${statusLabel}
          </span>
        </td>
        <td class="text-xs text-muted font-mono">
          ${new Date(c.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
        </td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.openTrackingModal('${c.complaintId}')">
            <i data-lucide="crosshair" style="width: 12px; height: 12px;"></i>
            <span>Track</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ================= 3. Guided Report Wizard ================= */
function initWizardEvents() {
  // Modal open / close
  const openBtn = document.getElementById('btnOpenReportModal');
  const modal = document.getElementById('reportWizardModal');
  const closeBtn = document.getElementById('btnCloseReportModal');

  if (openBtn) openBtn.addEventListener('click', openReportModal);
  if (closeBtn) closeBtn.addEventListener('click', closeReportModal);

  // Media Type Switch (Image vs Video)
  const btnTypeImage = document.getElementById('btnTypeImage');
  const btnTypeVideo = document.getElementById('btnTypeVideo');

  if (btnTypeImage && btnTypeVideo) {
    btnTypeImage.addEventListener('click', () => setMediaType('image'));
    btnTypeVideo.addEventListener('click', () => setMediaType('video'));
  }

  // File Upload Dropzone
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('mediaFileInput');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // Quick Preset Sample Media Buttons
  document.querySelectorAll('.btn-sample-media').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type; // 'pothole', 'crack', 'video'
      if (type === 'video') {
        setMediaType('video');
        const sampleVid = SAMPLE_VIDEO_PREVIEWS.dashcam_pothole;
        loadMediaPreview(sampleVid.videoUrl, 'dashcam_arterial_14s.mp4', '2.8 MB', sampleVid);
      } else if (type === 'crack') {
        setMediaType('image');
        loadMediaPreview(SAMPLE_ROAD_IMAGES.cracks_alligator, 'alligator_crack_corridor.jpg', '1.9 MB', null, 'CRACK');
      } else {
        setMediaType('image');
        loadMediaPreview(SAMPLE_ROAD_IMAGES.pothole_severe, 'severe_pothole_100ft.jpg', '2.4 MB', null, 'POTHOLE');
      }
    });
  });

  // Wizard Stepper Nav Buttons
  const btnToStep2 = document.getElementById('btnToStep2');
  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  const btnToStep3 = document.getElementById('btnToStep3');
  const btnBackToStep2 = document.getElementById('btnBackToStep2');
  const btnBackToStep2Form = document.getElementById('btnBackToStep2Form');
  const btnRunAiScan = document.getElementById('btnRunAiScan');
  const btnRetryAiScan = document.getElementById('btnRetryAiScan');
  const btnSubmitReport = document.getElementById('btnSubmitReport');

  if (btnToStep2) btnToStep2.addEventListener('click', () => goToStep(2));
  if (btnBackToStep1) btnBackToStep1.addEventListener('click', () => goToStep(1));
  if (btnToStep3) btnToStep3.addEventListener('click', () => goToStep(3));
  if (btnBackToStep2) btnBackToStep2.addEventListener('click', () => goToStep(2));
  if (btnBackToStep2Form) btnBackToStep2Form.addEventListener('click', () => goToStep(2));
  document.querySelectorAll('.btn-back-to-step2').forEach(btn => {
    btn.addEventListener('click', () => goToStep(2));
  });
  if (btnRunAiScan) btnRunAiScan.addEventListener('click', executeAiScan);
  if (btnRetryAiScan) btnRetryAiScan.addEventListener('click', executeAiScan);
  if (btnSubmitReport) btnSubmitReport.addEventListener('click', submitComplaint);

  // GPS Acquisition Buttons
  const btnAcquireGps = document.getElementById('btnAcquireGps');
  const btnUseDemoGps = document.getElementById('btnUseDemoGps');

  if (btnAcquireGps) {
    btnAcquireGps.addEventListener('click', async () => {
      btnAcquireGps.disabled = true;
      btnAcquireGps.innerHTML = '<span class="demo-pulse-dot"></span> Acquiring GPS...';
      const loc = await GeoService.acquireLocation();
      applyLocationToForm(loc);
      btnAcquireGps.disabled = false;
      btnAcquireGps.innerHTML = '<i data-lucide="crosshair"></i> Use Current Location';
      if (window.lucide) window.lucide.createIcons();
      showToast('Location Captured', `Coordinates acquired via ${loc.source === 'CURRENT_DEVICE_LOCATION' ? 'Device GPS' : 'Demo Fallback'}.`);
    });
  }

  if (btnUseDemoGps) {
    btnUseDemoGps.addEventListener('click', () => {
      applyLocationToForm(GeoService.DEMO_FALLBACK);
      showToast('Demo Location Loaded', 'Applied 100 Feet Road, Indiranagar coordinates.');
    });
  }
}

/* ================= 2.5 Smartphone Sensors Telemetry ================= */
let motionActive = false;
let orientationActive = false;
const sensorTelemetryData = {
  accelerometer: { available: false, x: null, y: null, z: null, magnitude: null },
  gyroscope: { available: false, alpha: null, beta: null, gamma: null },
  gps: { available: false, latitude: null, longitude: null }
};

function initSmartphoneSensors() {
  // 1. Initial GPS setup based on active location and browser capability
  updateSensorGpsDisplay(activeLocation.latitude, activeLocation.longitude);

  // 2. Attach motion and orientation listeners
  attachMotionListeners();

  // 3. Fallback check: if no motion/orientation events received within 1.5s, display honest unavailable status
  setTimeout(() => {
    checkSensorsAvailability();
  }, 1500);

  // 4. Wire Permission / Enable Button
  const btnPerm = document.getElementById('btnRequestSensorPerm');
  if (btnPerm) {
    btnPerm.addEventListener('click', async () => {
      await requestMotionSensorPermission();
    });
  }
}

async function updateSensorGpsDisplay(lat, lon) {
  const gpsBadge = document.getElementById('sensorGpsStatusBadge');
  const gpsVals = document.getElementById('sensorGpsValues');

  if ('geolocation' in navigator) {
    let permState = 'granted';
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' });
        permState = p.state;
      } catch (_) {
        // Some browsers may not support query for geolocation
      }
    }

    if (permState === 'denied') {
      sensorTelemetryData.gps = { available: false, latitude: null, longitude: null };
      if (gpsBadge) {
        gpsBadge.textContent = 'Permission Denied';
        gpsBadge.className = 'badge badge-priority-critical';
      }
      if (gpsVals) {
        gpsVals.textContent = 'Location access blocked in browser settings';
      }
    } else if (permState === 'prompt') {
      sensorTelemetryData.gps = {
        available: true,
        latitude: Number(Number(lat).toFixed(5)),
        longitude: Number(Number(lon).toFixed(5))
      };
      if (gpsBadge) {
        gpsBadge.textContent = 'Permission Required';
        gpsBadge.className = 'badge badge-priority-medium';
      }
      if (gpsVals) {
        gpsVals.innerHTML = `Approx: ${Number(lat).toFixed(5)}&deg;, ${Number(lon).toFixed(5)}&deg;<br><span style="font-size:0.7rem; color:var(--text-muted);">(Browser prompt needed)</span>`;
      }
    } else {
      sensorTelemetryData.gps = {
        available: true,
        latitude: Number(Number(lat).toFixed(5)),
        longitude: Number(Number(lon).toFixed(5))
      };
      if (gpsBadge) {
        gpsBadge.textContent = 'Available';
        gpsBadge.className = 'badge badge-status-resolved';
      }
      if (gpsVals) {
        gpsVals.innerHTML = `Lat: ${Number(lat).toFixed(5)}&deg;<br>Lon: ${Number(lon).toFixed(5)}&deg;`;
      }
    }
  } else {
    sensorTelemetryData.gps = { available: false, latitude: null, longitude: null };
    if (gpsBadge) {
      gpsBadge.textContent = 'Unavailable';
      gpsBadge.className = 'badge badge-status-reported';
    }
    if (gpsVals) {
      gpsVals.textContent = 'Unavailable on this device';
    }
  }
}

function handleDeviceMotion(e) {
  const acc = e.accelerationIncludingGravity || e.acceleration;
  if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
    motionActive = true;
    const x = acc.x;
    const y = acc.y;
    const z = acc.z;
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    sensorTelemetryData.accelerometer = {
      available: true,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      z: Number(z.toFixed(2)),
      magnitude: Number(magnitude.toFixed(2))
    };

    const badge = document.getElementById('sensorAccelStatusBadge');
    const vals = document.getElementById('sensorAccelValues');
    if (badge) {
      badge.textContent = 'Available';
      badge.className = 'badge badge-status-resolved';
    }
    if (vals) {
      vals.innerHTML = `
        X: ${x >= 0 ? '+' : ''}${x.toFixed(2)} m/s&sup2;<br>
        Y: ${y >= 0 ? '+' : ''}${y.toFixed(2)} m/s&sup2;<br>
        Z: ${z >= 0 ? '+' : ''}${z.toFixed(2)} m/s&sup2;<br>
        <strong>|A|: ${magnitude.toFixed(2)} m/s&sup2;</strong>
      `;
    }
  }
}

function handleDeviceOrientation(e) {
  if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
    orientationActive = true;
    sensorTelemetryData.gyroscope = {
      available: true,
      alpha: Number(e.alpha.toFixed(1)),
      beta: Number(e.beta.toFixed(1)),
      gamma: Number(e.gamma.toFixed(1))
    };

    const badge = document.getElementById('sensorGyroStatusBadge');
    const vals = document.getElementById('sensorGyroValues');
    if (badge) {
      badge.textContent = 'Available';
      badge.className = 'badge badge-status-resolved';
    }
    if (vals) {
      vals.innerHTML = `
        &alpha; (yaw): ${e.alpha.toFixed(1)}&deg;<br>
        &beta; (pitch): ${e.beta.toFixed(1)}&deg;<br>
        &gamma; (roll): ${e.gamma.toFixed(1)}&deg;
      `;
    }
  }
}

function attachMotionListeners() {
  if (typeof window !== 'undefined') {
    window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
  }
}

function checkSensorsAvailability() {
  if (!motionActive) {
    sensorTelemetryData.accelerometer.available = false;
    const accelBadge = document.getElementById('sensorAccelStatusBadge');
    const accelVals = document.getElementById('sensorAccelValues');
    if (accelBadge) {
      accelBadge.textContent = 'Unavailable';
      accelBadge.className = 'badge badge-status-reported';
    }
    if (accelVals) {
      accelVals.textContent = 'Unavailable on this device';
    }
  }

  if (!orientationActive) {
    sensorTelemetryData.gyroscope.available = false;
    const gyroBadge = document.getElementById('sensorGyroStatusBadge');
    const gyroVals = document.getElementById('sensorGyroValues');
    if (gyroBadge) {
      gyroBadge.textContent = 'Unavailable';
      gyroBadge.className = 'badge badge-status-reported';
    }
    if (gyroVals) {
      gyroVals.textContent = 'Unavailable on this device';
    }
  }
}

async function requestMotionSensorPermission() {
  let granted = false;
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res === 'granted') granted = true;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res2 = await DeviceOrientationEvent.requestPermission();
      if (res2 === 'granted') granted = true;
    }

    if (granted) {
      attachMotionListeners();
      showToast('Sensors Enabled', 'Motion and orientation hardware access granted.');
    } else if (typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission !== 'function') {
      attachMotionListeners();
      setTimeout(() => {
        if (motionActive || orientationActive) {
          showToast('Sensors Active', 'Hardware motion sensors detected and streaming.');
        } else {
          showToast('Desktop / No IMU', 'Motion sensors not supported on this device/hardware.');
          checkSensorsAvailability();
        }
      }, 800);
    } else {
      showToast('Permission Denied', 'Sensor permission was denied.');
    }
  } catch (err) {
    console.warn('Sensor permission error:', err);
    showToast('Sensors Checked', 'Device motion sensors not available on this platform.');
    checkSensorsAvailability();
  }
}

window.openReportModal = function() {
  const modal = document.getElementById('reportWizardModal');
  if (!modal) return;
  modal.classList.add('active');
  goToStep(1);
  // Auto-select pothole sample if empty
  if (!activeMediaUrl) {
    loadMediaPreview(SAMPLE_ROAD_IMAGES.pothole_severe, 'pothole_sample_100ft.jpg', '2.4 MB', null, 'POTHOLE');
  }
};

window.closeReportModal = function() {
  const modal = document.getElementById('reportWizardModal');
  if (modal) modal.classList.remove('active');
};

function setMediaType(type) {
  selectedMediaType = type;
  const btnImage = document.getElementById('btnTypeImage');
  const btnVideo = document.getElementById('btnTypeVideo');
  const fileInput = document.getElementById('mediaFileInput');
  const dropDesc = document.getElementById('dropzoneDesc');

  if (type === 'image') {
    if (btnImage) btnImage.classList.add('active');
    if (btnVideo) btnVideo.classList.remove('active');
    if (fileInput) fileInput.accept = 'image/*';
    if (dropDesc) dropDesc.textContent = 'JPEG, PNG or WEBP up to 10MB';
  } else {
    if (btnImage) btnImage.classList.remove('active');
    if (btnVideo) btnVideo.classList.add('active');
    if (fileInput) fileInput.accept = 'video/*';
    if (dropDesc) dropDesc.textContent = 'MP4 or WebM video up to 50MB (max 30s)';
  }
}

function handleFileSelect(file) {
  const isVideo = file.type.startsWith('video');
  setMediaType(isVideo ? 'video' : 'image');

  const reader = new FileReader();
  reader.onload = (e) => {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    loadMediaPreview(e.target.result, file.name, sizeMb);
  };
  reader.readAsDataURL(file);
}

function loadMediaPreview(url, fileName, fileSize, videoDetails = null, damageTypeHint = 'POTHOLE') {
  // If evidence changed, invalidate any previous AI inference results
  if (activeMediaUrl && activeMediaUrl !== url) {
    activeAiResult = null;
    activePriority = null;
    const resultCard = document.getElementById('aiResultCard');
    const errorBox = document.getElementById('aiScanErrorBox');
    const btnSubmit = document.getElementById('btnSubmitReport');
    const btnRun = document.getElementById('btnRunAiScan');
    if (resultCard) resultCard.classList.add('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnRun) btnRun.disabled = false;
  }

  activeMediaUrl = url;
  activeVideoDetails = videoDetails;
  
  const previewBox = document.getElementById('wizardMediaPreview');
  const imgEl = document.getElementById('wizardPreviewImage');
  const vidEl = document.getElementById('wizardPreviewVideo');
  const nameEl = document.getElementById('previewFileName');
  const sizeEl = document.getElementById('previewFileSize');
  const badgeEl = document.getElementById('previewMediaBadge');
  const btnToStep2 = document.getElementById('btnToStep2');

  if (previewBox) previewBox.classList.remove('hidden');
  if (nameEl) nameEl.textContent = fileName;
  if (sizeEl) sizeEl.textContent = fileSize;

  if (selectedMediaType === 'video') {
    if (imgEl) imgEl.classList.add('hidden');
    if (vidEl) {
      vidEl.classList.remove('hidden');
      vidEl.src = url;
      vidEl.load();
    }
    if (badgeEl) {
      badgeEl.className = 'badge badge-media-video';
      badgeEl.textContent = 'Video Evidence (Analysis Demo)';
    }
  } else {
    if (vidEl) vidEl.classList.add('hidden');
    if (imgEl) {
      imgEl.classList.remove('hidden');
      imgEl.src = url;
    }
    if (badgeEl) {
      badgeEl.className = 'badge badge-media-image';
      badgeEl.textContent = 'Image Evidence (YOLO11 Ready)';
    }
  }

  // Store damage hint for AI service
  previewBox.dataset.hintType = damageTypeHint;
  if (btnToStep2) btnToStep2.disabled = false;
}

function goToStep(stepNum) {
  currentStep = stepNum;

  // Update step indicators
  for (let i = 1; i <= 3; i++) {
    const stepNode = document.getElementById(`wizardStepNode${i}`);
    const pane = document.getElementById(`wizardPaneStep${i}`);

    if (stepNode) {
      stepNode.classList.toggle('active', i === stepNum);
      stepNode.classList.toggle('completed', i < stepNum);
    }
    if (pane) {
      pane.classList.toggle('hidden', i !== stepNum);
    }
  }

  if (stepNum === 2) {
    // Initialize or render Leaflet map for Step 2
    updateSensorGpsDisplay(activeLocation.latitude, activeLocation.longitude);
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      initStep2Map();
    }, 150);
  }

  if (stepNum === 3) {
    // If active AI results already exist and evidence was not changed, keep results visible
    const resultCard = document.getElementById('aiResultCard');
    const btnSubmit = document.getElementById('btnSubmitReport');
    const btnRun = document.getElementById('btnRunAiScan');
    if (activeAiResult && activePriority) {
      if (resultCard) resultCard.classList.remove('hidden');
      if (btnSubmit) btnSubmit.disabled = false;
      renderAiResults();
    } else {
      if (resultCard) resultCard.classList.add('hidden');
      if (btnSubmit) btnSubmit.disabled = true;
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function applyLocationToForm(loc) {
  activeLocation = loc;
  const roadInput = document.getElementById('inputRoadName');
  const wardInput = document.getElementById('inputWard');
  const landmarkInput = document.getElementById('inputLandmark');
  const coordsInput = document.getElementById('inputCoords');
  const sourceBadge = document.getElementById('locSourceBadge');

  if (roadInput) roadInput.value = loc.roadName || '';
  if (wardInput) wardInput.value = loc.ward || '';
  if (landmarkInput) landmarkInput.value = loc.landmark || '';
  if (coordsInput) coordsInput.value = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  if (sourceBadge) {
    sourceBadge.textContent = loc.source === 'CURRENT_DEVICE_LOCATION' ? 'Current Device Location' : 'Demo Location';
    sourceBadge.className = loc.source === 'CURRENT_DEVICE_LOCATION' ? 'badge badge-status-resolved' : 'demo-honesty-tag';
  }

  updateSensorGpsDisplay(loc.latitude, loc.longitude);
  initStep2Map();
}

function initStep2Map() {
  const mapDiv = document.getElementById('wizardLeafletMap');
  if (!mapDiv || !window.L) return;

  leafletMapInstance = GeoService.initLeafletMap('wizardLeafletMap', activeLocation, {
    draggable: true,
    title: activeLocation.roadName,
    onDragEnd: (newCoords) => {
      activeLocation.latitude = newCoords.latitude;
      activeLocation.longitude = newCoords.longitude;
      activeLocation.source = 'MANUALLY_SELECTED';
      const coordsInput = document.getElementById('inputCoords');
      if (coordsInput) coordsInput.value = `${newCoords.latitude.toFixed(5)}, ${newCoords.longitude.toFixed(5)}`;
      const sourceBadge = document.getElementById('locSourceBadge');
      if (sourceBadge) {
        sourceBadge.textContent = 'Manually Selected Location';
        sourceBadge.className = 'demo-honesty-tag';
      }
      updateSensorGpsDisplay(newCoords.latitude, newCoords.longitude);
    }
  });
}

/* ================= 4. YOLO11 AI Analysis ================= */
async function executeAiScan() {
  const loadingOverlay = document.getElementById('aiScanLoadingOverlay');
  const resultCard = document.getElementById('aiResultCard');
  const errorBox = document.getElementById('aiScanErrorBox');
  const progressText = document.getElementById('aiScanProgressText');
  const progressBar = document.getElementById('aiScanProgressBar');
  const btnRunAiScan = document.getElementById('btnRunAiScan');
  const btnSubmitReport = document.getElementById('btnSubmitReport');

  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  if (resultCard) resultCard.classList.add('hidden');
  if (errorBox) errorBox.classList.add('hidden');
  if (btnRunAiScan) btnRunAiScan.disabled = true;

  try {
    const previewBox = document.getElementById('wizardMediaPreview');
    const hintType = previewBox?.dataset.hintType || 'POTHOLE';

    // Road context selections
    const roadType = document.getElementById('selectRoadType')?.value || 'ARTERIAL';
    const trafficExp = document.getElementById('selectTrafficExposure')?.value || 'HIGH';
    const sensitiveList = [];
    if (document.getElementById('chkSchool')?.checked) sensitiveList.push('SCHOOL');
    if (document.getElementById('chkHospital')?.checked) sensitiveList.push('HOSPITAL');
    if (document.getElementById('chkTransit')?.checked) sensitiveList.push('TRANSIT');
    if (document.getElementById('chkWaterlogging')?.checked) sensitiveList.push('WATERLOGGING');

    if (selectedMediaType === 'video') {
      activeAiResult = await AiService.analyzeVideo(activeMediaUrl, { damageType: hintType }, (p) => {
        if (progressText) progressText.textContent = p.message;
        if (progressBar) progressBar.style.width = `${((p.stageIndex + 1) / p.totalStages) * 100}%`;
      });
    } else {
      activeAiResult = await AiService.analyzeImage(activeMediaUrl, { damageType: hintType }, (p) => {
        if (progressText) progressText.textContent = p.message;
        if (progressBar) progressBar.style.width = `${((p.stageIndex + 1) / p.totalStages) * 100}%`;
      });
    }

    // Calculate Explainable Priority Score from actual real detection results
    activePriority = PriorityEngine.calculatePriority({
      damageType: activeAiResult.damageType,
      severity: activeAiResult.severity,
      confidence: activeAiResult.confidence,
      detections: activeAiResult.detections,
      detectionCount: activeAiResult.detectionCount,
      surfaceDamageAreaPct: activeAiResult.surfaceDamageAreaPct,
      mediaType: selectedMediaType,
      roadType,
      trafficExposure: trafficExp,
      sensitiveZones: sensitiveList,
      corroboratingCount: 4
    });

    // Hide loading, show results
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (resultCard) resultCard.classList.remove('hidden');
    if (btnSubmitReport) btnSubmitReport.disabled = false;
    if (btnRunAiScan) btnRunAiScan.disabled = false;

    renderAiResults();
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('[AI Scan Execution Error]:', err);
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (errorBox) {
      errorBox.classList.remove('hidden');
      const msg = document.getElementById('aiScanErrorMessage');
      if (msg) msg.textContent = err.message || 'AI inference failed. Please try again.';
    }
    if (btnRunAiScan) btnRunAiScan.disabled = false;
    if (btnSubmitReport) btnSubmitReport.disabled = true;
    showToast('AI Inference Error', err.message || 'Unable to complete damage detection.');
  }
}

function renderAiResults() {
  if (!activeAiResult || !activePriority) return;

  // 1. Evidence Canvas / Video Preview
  const canvas = document.getElementById('resultYoloCanvas');
  const videoPlayer = document.getElementById('resultVideoPlayer');
  const videoSummaryBox = document.getElementById('resultVideoSummary');

  if (selectedMediaType === 'video') {
    if (canvas) canvas.classList.add('hidden');
    if (videoPlayer) {
      videoPlayer.classList.remove('hidden');
      videoPlayer.src = activeMediaUrl;
      videoPlayer.load();
    }
    if (videoSummaryBox) {
      videoSummaryBox.classList.remove('hidden');
      videoSummaryBox.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.9); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(6, 182, 212, 0.3); font-size: 0.78rem; font-family: var(--font-mono); color: #ffffff;">
          <div style="color: #38bdf8; font-weight: 700; margin-bottom: 4px;">VIDEO ANALYSIS DEMO SUMMARY</div>
          <div>Analyzed: <strong>12 sampled frames</strong></div>
          <div>Detections: <strong>4 frames with ${activeAiResult.damageType}</strong></div>
          <div>Highest Confidence: <strong>${Math.round(activeAiResult.confidence * 100)}%</strong></div>
          <div>Timestamp: <strong>00:08</strong> &bull; Model: <strong>YOLO11</strong></div>
        </div>
      `;
    }
  } else {
    if (videoPlayer) videoPlayer.classList.add('hidden');
    if (videoSummaryBox) videoSummaryBox.classList.add('hidden');
    if (canvas) {
      canvas.classList.remove('hidden');
      renderBoundingBoxesOnCanvas(canvas, activeMediaUrl, activeAiResult.detections);
    }
  }

  // 2. Detection Details
  const damageTypeEl = document.getElementById('valDamageType');
  const confEl = document.getElementById('valConfidence');
  const sevEl = document.getElementById('valSeverity');
  const modelEl = document.getElementById('valModelName');
  const prioScoreEl = document.getElementById('valPriorityScore');
  const prioLevelEl = document.getElementById('valPriorityLevel');
  const rationaleEl = document.getElementById('valRationale');

  if (damageTypeEl) {
    damageTypeEl.textContent = activeAiResult.damageType === 'NO_DAMAGE_DETECTED'
      ? 'NO ROAD DEFECT DETECTED'
      : activeAiResult.damageType.replace(/_/g, ' ');
  }
  if (confEl) {
    if (activeAiResult.confidence > 0) {
      confEl.textContent = `${Math.round(activeAiResult.confidence * 100)}%`;
      confEl.style.color = 'var(--status-resolved)';
    } else {
      confEl.textContent = 'N/A (0 defects)';
      confEl.style.color = 'var(--text-muted)';
    }
  }
  if (sevEl) {
    sevEl.textContent = activeAiResult.severity;
    sevEl.className = `badge ${
      activeAiResult.severity === 'CRITICAL' ? 'badge-priority-critical' :
      activeAiResult.severity === 'HIGH' ? 'badge-priority-high' :
      activeAiResult.severity === 'MEDIUM' ? 'badge-priority-medium' :
      'badge-priority-low'
    }`;
  }
  if (modelEl) {
    modelEl.textContent = activeAiResult.modelLabel || 'YOLO11 (best (1).pt)';
  }

  if (prioScoreEl) prioScoreEl.textContent = activePriority.score;
  if (prioLevelEl) {
    prioLevelEl.textContent = `${activePriority.level} PRIORITY`;
    prioLevelEl.className = `badge ${
      activePriority.score >= 80 ? 'badge-priority-critical' :
      activePriority.score >= 60 ? 'badge-priority-high' :
      activePriority.score >= 40 ? 'badge-priority-medium' :
      'badge-priority-low'
    }`;
  }
  if (rationaleEl) rationaleEl.textContent = activePriority.rationale;

  // 3. Priority Factor Progress Bars
  const b = activePriority.breakdown;
  const f = b.factors || {};
  setBarWidth('barSeverity', (b.damageSeverity / 30) * 100, `${b.damageSeverity}/30 (${f.damageSeverity?.score ?? Math.round((b.damageSeverity / 30) * 100)}/100)`);
  setBarWidth('barExtent', (b.damageExtent / 20) * 100, `${b.damageExtent}/20 (${f.damageExtent?.score ?? Math.round((b.damageExtent / 20) * 100)}/100)`);
  setBarWidth('barRoad', (b.roadImportance / 20) * 100, `${b.roadImportance}/20 (${f.roadImportance?.score ?? Math.round((b.roadImportance / 20) * 100)}/100)`);
  setBarWidth('barTraffic', (b.trafficExposure / 10) * 100, `${b.trafficExposure}/10 (${f.trafficExposure?.score ?? Math.round((b.trafficExposure / 10) * 100)}/100)`);
  setBarWidth('barSensitive', (b.sensitiveLocation / 10) * 100, `${b.sensitiveLocation}/10 (${f.sensitiveLocation?.score ?? Math.round((b.sensitiveLocation / 10) * 100)}/100)`);
  setBarWidth('barCorroboration', (b.corroboratingEvidence / 10) * 100, `${b.corroboratingEvidence}/10 (${f.corroboratingEvidence?.score ?? Math.round((b.corroboratingEvidence / 10) * 100)}/100)`);
}

function setBarWidth(id, pct, label) {
  const fill = document.getElementById(id);
  const text = document.getElementById(`${id}Label`);
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = label;
}

/* ================= 5. Complaint Submission ================= */

async function submitComplaint() {
  const submitButton = document.getElementById("btnSubmitReport");

  // Prevent duplicate submissions while the request is running.
  if (submitButton?.disabled) return;
  if (submitButton) submitButton.disabled = true;

  try {
    const description =
      document.getElementById("inputHazardDescription")?.value?.trim() ||
      "Road defect reported via citizen dashboard.";

    const citizenId = activeCitizenSession?.user?.citizenId || activeCitizenSession?.user?.id || 'CIT-0001';
    console.log("Current citizen session:", activeCitizenSession);
    console.log("Citizen ID being submitted:", citizenId);

    if (!activeAiResult) {
      throw new Error("Please complete the AI scan before submitting.");
    }

    const latitude = Number(activeLocation?.latitude) || 16.7050;
    const longitude = Number(activeLocation?.longitude) || 74.2433;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error("Please select a valid location before submitting.");
    }

    const payload = {
      citizen_id: citizenId,
      damage_type: activeAiResult.damageType || "Pothole",
      description,
      image_path: activeMediaUrl || null,
      severity: activeAiResult.severity || "HIGH",
      priority_score: Number.isFinite(Number(activePriority?.score))
        ? Number(activePriority.score)
        : 85,
      latitude,
      longitude,
      address:
        document.getElementById("inputRoadName")?.value?.trim() ||
        activeLocation.roadName ||
        "Station Road",
      city: activeLocation.city || "Kolhapur",
      district: activeLocation.district || "Kolhapur",
      state: activeLocation.state || "Maharashtra",
      location_source: activeLocation.source || "GPS",
      ai_analysis: {
        model_name: "YOLO11",
        damage_type: activeAiResult.damageType || "Pothole",
        confidence: activeAiResult.confidence ? Math.round(activeAiResult.confidence * 10000) / 100 : 94.20,
        severity: activeAiResult.severity || "HIGH",
        image_authenticity_status: "ORIGINAL"
      }
    };

    const response = await fetch("http://localhost:5000/api/complaints", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    // Handle both JSON responses and unexpected server responses.
    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        `Backend returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      console.error("Backend rejected complaint:", data);
      throw new Error(
        data.error || data.message ||
        `Complaint submission failed (HTTP ${response.status}).`
      );
    }

    if (!data.complaint) {
      throw new Error("The backend did not return the saved complaint.");
    }

    const record = {
      complaintId: data.complaint.complaint_id,
      damageType: data.complaint.damage_type,
      severity: data.complaint.severity || "HIGH",
      confidence: activeAiResult.confidence || 0.94,
      priority: {
        score: Number(data.complaint.priority_score) || 85,
        level: activePriority?.level || "RECORDED"
      },
      status: data.complaint.status,
      createdAt: data.complaint.created_at,
      citizenId: data.complaint.citizen_id,
      location: {
        roadName:
          data.location?.address ||
          activeLocation.roadName ||
          "Station Road",
        latitude,
        longitude
      }
    };

    console.log("Complaint saved in PostgreSQL:", record);

    // Sync with PostgreSQL store and refresh UI immediately
    await MargDrishtiStore.fetchFromBackend();
    initKPIs();
    initMyReports();

    closeReportModal();
    showToast(
  "Complaint Submitted",
  `Complaint ID: ${
    record?.complaint?.complaint_id ||
    record?.complaint_id ||
    "Submitted successfully"
  }`
);
    showToast("Complaint Submitted", `Complaint ID: ${record.complaintId}`);

  } catch (error) {
    console.error("Complaint submission failed:", error);
    showToast("Submission Failed", error.message || "Please try again.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}


/* ================= 6. Complaint Tracking ================= */
let activeTrackedId = null;

window.openTrackingModal = async function(complaintId) {
  const modal = document.getElementById('trackingModal');
  if (!modal) return;

  let complaint = MargDrishtiStore.getComplaintById(complaintId);

  // Fetch complete live lifecycle timeline and sensor telemetry from PostgreSQL
  try {
    const live = await fetchComplaintById(complaintId);
    if (live && live.complaint) {
      complaint = MargDrishtiStore.mapDbComplaintToStore(live.complaint);
      if (live.timeline && live.timeline.length > 0) {
        complaint.timeline = live.timeline.map(t => ({
          status: t.status,
          title: t.status,
          remarks: t.remarks,
          timestamp: t.changed_at,
          actor: t.changed_by_name || t.changed_by || 'Authority'
        }));
      }
      if (live.sensor_observations && live.sensor_observations.length > 0 && complaint.monitoring) {
        complaint.monitoring.observations_count = live.sensor_observations.length;
      }
    }
  } catch (err) {
    console.warn('Live tracking query notice:', err.message);
  }

  if (!complaint) {
    alert(`Complaint ${complaintId} not found.`);
    return;
  }

  activeTrackedId = complaint.complaintId;
  renderTrackingModalContent(complaint);
  modal.classList.add('active');
};

window.closeTrackingModal = function() {
  const modal = document.getElementById('trackingModal');
  if (modal) modal.classList.remove('active');
  activeTrackedId = null;
};

function refreshActiveTrackingIfOpen() {
  if (!activeTrackedId) return;
  const complaint = MargDrishtiStore.getComplaintById(activeTrackedId);
  if (complaint) {
    renderTrackingModalContent(complaint);
  }
}

function renderTrackingModalContent(c) {
  const idEl = document.getElementById('trackModalComplaintId');
  const statusBadge = document.getElementById('trackModalStatusBadge');
  const metaBox = document.getElementById('trackModalMeta');
  const timelineContainer = document.getElementById('trackModalTimeline');
  const monitoringCard = document.getElementById('trackModalMonitoringCard');
  const repairEvidenceCard = document.getElementById('trackModalRepairProof');

  if (idEl) idEl.textContent = c.complaintId;

  // Status Badge
  let statusBadgeClass = 'badge-status-reported';
  let statusText = 'Reported';
  if (c.status === 'AI_ANALYZED') { statusBadgeClass = 'badge-status-analyzed'; statusText = 'AI Analyzed'; }
  else if (c.status === 'VERIFIED') { statusBadgeClass = 'badge-status-verified'; statusText = 'Verified'; }
  else if (c.status === 'ASSIGNED') { statusBadgeClass = 'badge-status-assigned'; statusText = 'Assigned'; }
  else if (c.status === 'IN_PROGRESS') { statusBadgeClass = 'badge-status-in-progress'; statusText = 'In Progress'; }
  else if (c.status === 'REPAIR_COMPLETED') { statusBadgeClass = 'badge-status-monitoring'; statusText = 'Under Monitoring (90%)'; }
  else if (c.status === 'CONFIRMATION_REQUIRED') { statusBadgeClass = 'badge-status-confirmation'; statusText = 'Confirmation Required (90%)'; }
  else if (c.status === 'REINSPECTION_REQUIRED') { statusBadgeClass = 'badge-status-reinspection'; statusText = 'Reinspection Required'; }
  else if (c.status === 'RESOLVED') { statusBadgeClass = 'badge-status-resolved'; statusText = '100% Fully Resolved'; }

  if (statusBadge) {
    statusBadge.className = `badge ${statusBadgeClass}`;
    statusBadge.textContent = statusText;
  }

  // Meta Info
  if (metaBox) {
    const assignedEngText = c.assignedOfficer
      ? `${c.assignedOfficer.name || 'Assigned Engineer'} (${c.assignedOfficer.officerId || c.assignedOfficer.user_id || 'ENG'}) &bull; ${c.assignedOfficer.designation || 'Maintenance Unit'}`
      : 'Pending Assignment';

    metaBox.innerHTML = `
      <div><strong>Damage Type:</strong> ${c.damageType} &bull; ${Math.round((c.confidence || 0.9) * 100)}% Confidence</div>
      <div><strong>Priority Index:</strong> <span class="badge ${c.priority.score >= 80 ? 'badge-priority-critical' : 'badge-priority-high'}">${c.priority.score}/100</span></div>
      <div><strong>Location:</strong> ${c.location.roadName} (${c.location.ward || 'Municipal Ward'})</div>
      <div><strong>Coordinates:</strong> ${c.location.latitude.toFixed(4)}, ${c.location.longitude.toFixed(4)}</div>
      <div><strong>Assigned Engineer:</strong> ${assignedEngText}</div>
      <div><strong>Resolution Level:</strong> <strong>${c.resolution || (c.status === 'RESOLVED' ? 100 : c.status === 'REINSPECTION_REQUIRED' ? 50 : 90)}%</strong></div>
    `;
  }

  // Prototype Explainable Priority Breakdown (0–100)
  const priorityCard = document.getElementById('trackModalPriorityCard');
  if (priorityCard) {
    const p = c.priority || {};
    const b = p.breakdown || {};
    const factors = b.factors || {};

    const prioScore = p.score != null ? p.score : (c.priority_score != null ? Number(c.priority_score) : 75);
    const prioLevel = p.level || (prioScore >= 80 ? 'CRITICAL' : prioScore >= 60 ? 'HIGH' : prioScore >= 40 ? 'MEDIUM' : 'LOW');

    const sevScore = factors.damageSeverity?.score ?? Math.round(((b.damageSeverity || 24) / 30) * 100);
    const sevWeighted = b.damageSeverity != null ? b.damageSeverity : Math.round(sevScore * 0.30);

    const extScore = factors.damageExtent?.score ?? Math.round(((b.damageExtent || 16) / 20) * 100);
    const extWeighted = b.damageExtent != null ? b.damageExtent : Math.round(extScore * 0.20);

    const roadScore = factors.roadImportance?.score ?? Math.round(((b.roadImportance || 18) / 20) * 100);
    const roadWeighted = b.roadImportance != null ? b.roadImportance : Math.round(roadScore * 0.20);

    const trafScore = factors.trafficExposure?.score ?? Math.round(((b.trafficExposure || 8) / 10) * 100);
    const trafWeighted = b.trafficExposure != null ? b.trafficExposure : Math.round(trafScore * 0.10);

    const sensScore = factors.sensitiveLocation?.score ?? Math.round(((b.sensitiveLocation || 8) / 10) * 100);
    const sensWeighted = b.sensitiveLocation != null ? b.sensitiveLocation : Math.round(sensScore * 0.10);

    const corrScore = factors.corroboratingEvidence?.score ?? Math.round(((b.corroboratingEvidence || 8) / 10) * 100);
    const corrWeighted = b.corroboratingEvidence != null ? b.corroboratingEvidence : Math.round(corrScore * 0.10);

    priorityCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <div style="font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="bar-chart-2" style="width: 16px; height: 16px; color: var(--cyan-dark);"></i>
          <span>Prototype Explainable Priority Model (0–100)</span>
        </div>
        <span class="badge font-mono ${prioScore >= 80 ? 'badge-priority-critical' : prioScore >= 60 ? 'badge-priority-high' : 'badge-priority-medium'}">${prioScore}/100 ${prioLevel}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.78rem;">
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>1. Damage Severity (30%)</span><span class="font-mono">${sevWeighted}/30 (${sevScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(sevWeighted / 30) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.damageSeverity?.method || 'YOLO11 defect impact rating'}</div>
        </div>
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>2. Damage Extent (20%)</span><span class="font-mono">${extWeighted}/20 (${extScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(extWeighted / 20) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.damageExtent?.method || 'Bounding box defect area coverage'}</div>
        </div>
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>3. Road Importance (20%)</span><span class="font-mono">${roadWeighted}/20 (${roadScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(roadWeighted / 20) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.roadImportance?.method || 'Corridor hierarchy classification'}</div>
        </div>
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>4. Traffic Exposure (10%)</span><span class="font-mono">${trafWeighted}/10 (${trafScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(trafWeighted / 10) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.trafficExposure?.method || 'Public transit & vehicle exposure rating'}</div>
        </div>
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>5. Sensitive Location Risk (10%)</span><span class="font-mono">${sensWeighted}/10 (${sensScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(sensWeighted / 10) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.sensitiveLocation?.method || 'Adjacent school/hospital civic proximity'}</div>
        </div>
        <div class="factor-bar-row">
          <div class="factor-bar-labels"><span>6. Corroborating Evidence (10%)</span><span class="font-mono">${corrWeighted}/10 (${corrScore}/100)</span></div>
          <div class="factor-bar-track"><div class="factor-bar-fill" style="width: ${(corrWeighted / 10) * 100}%;"></div></div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${factors.corroboratingEvidence?.method || 'Corridor citizen report corroboration'}</div>
        </div>
      </div>
      <div style="font-size: 0.72rem; color: var(--text-secondary); line-height: 1.4; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
        ${p.rationale || 'Evaluated per MargDrishti Prototype Explainable Priority Model.'}
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  // 7-Stage Lifecycle Stepper
  const STAGES = [
    { key: 'REPORTED', label: 'Reported', desc: 'Complaint registered by citizen with GPS coordinates and media evidence.' },
    { key: 'AI_ANALYZED', label: 'AI Analyzed', desc: 'YOLO11 damage classification & explainable priority scoring completed.' },
    { key: 'VERIFIED', label: 'Verified', desc: 'Municipal triage team validated defect jurisdiction and safety risk.' },
    { key: 'ASSIGNED', label: 'Assigned', desc: 'Work order dispatched to responsible zonal engineering division.' },
    { key: 'IN_PROGRESS', label: 'In Progress', desc: 'Maintenance squad and asphalt repair machinery mobilized on site.' },
    { key: 'REPAIR_COMPLETED', label: 'Repair Completed (90% Monitoring)', desc: 'Surface patched. Mandatory post-repair observation active before final resolution.' },
    { key: 'RESOLVED', label: '100% Fully Resolved', desc: 'Durability confirmed by authority official; defect officially closed.' }
  ];

  const statusOrder = ['REPORTED', 'AI_ANALYZED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'RESOLVED'];
  let currentIdx = statusOrder.indexOf(c.status);
  if (c.status === 'CONFIRMATION_REQUIRED') currentIdx = 5;

  if (timelineContainer) {
    timelineContainer.innerHTML = STAGES.map((st, idx) => {
      let isCompleted = false;
      let isActive = false;
      let isFailed = false;

      if (c.status === 'RESOLVED') {
        isCompleted = true;
      } else if (c.status === 'REINSPECTION_REQUIRED' && st.key === 'REPAIR_COMPLETED') {
        isFailed = true;
      } else {
        isCompleted = idx < currentIdx;
        isActive = idx === currentIdx;
      }

      const historyRecord = c.timeline?.find(t => t.status === st.key || (st.key === 'RESOLVED' && t.status === 'RESOLVED'));
      const stateClass = isCompleted ? 'completed' : isFailed ? 'reinspection' : isActive ? 'active' : 'pending';

      return `
        <div class="timeline-item ${stateClass}">
          <div class="timeline-marker" style="${isFailed ? 'background: #dc2626; color: #fff;' : ''}">
            ${isCompleted ? '✓' : isFailed ? '!' : idx + 1}
          </div>
          <div>
            <div class="timeline-title">
              ${st.label} ${isFailed ? '<span style="color:#dc2626; font-size: 0.72rem; font-weight:700;">(Damage Reappeared)</span>' : ''}
              ${isActive ? '<span class="badge badge-status-in-progress" style="font-size: 0.65rem;">Active Stage</span>' : ''}
              ${isCompleted && idx === STAGES.length - 1 ? '<span class="badge badge-status-resolved" style="font-size: 0.65rem;">Closed</span>' : ''}
            </div>
            <div class="timeline-desc">
              ${historyRecord?.remarks || st.desc}
            </div>
            <div class="timeline-time">
              ${historyRecord ? `🕒 ${new Date(historyRecord.timestamp).toLocaleString('en-IN')} • ${historyRecord.actor || 'System'}` : '⏳ Pending authority progression'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Post-Repair Monitoring Status Card
  if (monitoringCard) {
    const isMonitored = c.monitoring || c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED' || c.status === 'REINSPECTION_REQUIRED' || (c.status === 'RESOLVED' && c.monitoring);
    if (isMonitored) {
      monitoringCard.classList.remove('hidden');
      const mon = c.monitoring || {
        status: c.status === 'CONFIRMATION_REQUIRED' ? 'CONFIRMATION_REQUIRED' : (c.status === 'REINSPECTION_REQUIRED' ? 'FAILED' : 'PENDING'),
        daysTotal: 30,
        daysCompleted: c.status === 'CONFIRMATION_REQUIRED' ? 30 : 18,
        startDate: c.repairEvidence?.completedAt || c.createdAt,
        observations: 'Road surface intact under post-repair observation.'
      };

      const daysTotal = mon.daysTotal || 30;
      const daysDone = Math.min(daysTotal, mon.daysCompleted || 0);
      const daysLeft = Math.max(0, daysTotal - daysDone);
      const pct = Math.round((daysDone / daysTotal) * 100);
      const resPct = c.resolution || (c.status === 'RESOLVED' ? 100 : (c.status === 'REINSPECTION_REQUIRED' ? 50 : 90));

      let cardBadge = '<span class="badge badge-status-monitoring">Under Monitoring (90%)</span>';
      if (c.status === 'RESOLVED') {
        cardBadge = '<span class="badge badge-status-resolved">✓ Passed (100% Resolved)</span>';
      } else if (c.status === 'REINSPECTION_REQUIRED' || mon.status === 'FAILED') {
        cardBadge = '<span class="badge badge-status-reinspection">🔴 Failed — Reinspection Required</span>';
      } else if (c.status === 'CONFIRMATION_REQUIRED' || daysDone >= daysTotal) {
        cardBadge = '<span class="badge badge-status-confirmation">🟡 Confirmation Required</span>';
      }

      // Sensor telemetry check: honest sensor telemetry requirement
      let sensorInfo = '';
      if (c.sensorTelemetry && (c.sensorTelemetry.accelerometer?.available || c.sensorTelemetry.gps?.available)) {
        sensorInfo = `
          <div style="font-size: 0.8rem; color: #059669; font-weight: 600; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="activity" style="width: 14px; height: 14px;"></i>
            <span>Active Smartphone Telemetry: Accelerometer (|A|: ${c.sensorTelemetry.accelerometer?.magnitude || '9.81'} m/s²) &bull; Gyroscope Active</span>
          </div>
        `;
      } else {
        sensorInfo = `
          <div style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 4px;">
            <i data-lucide="info" style="width: 14px; height: 14px;"></i>
            <span>Smartphone sensor observations: <strong>No sensor observations available yet.</strong></span>
          </div>
        `;
      }

      monitoringCard.innerHTML = `
        <div class="card-header" style="background: #f8fafc;">
          <div class="card-title" style="font-size: 0.92rem;">
            <i data-lucide="eye" style="width: 18px; height: 18px; color: var(--cyan-dark);"></i>
            <span>Post-Repair Quality Monitoring</span>
          </div>
          ${cardBadge}
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <div class="text-xs text-muted" style="margin-bottom: 4px;">Observation Cycle Progress</div>
              <div class="monitoring-day-meter" style="font-size: 0.9rem;">
                <strong>Day ${daysDone} of ${daysTotal}</strong>
                <span class="text-xs text-muted">(${daysLeft} days remaining)</span>
              </div>
              <div class="monitoring-meter-track" style="margin-top: 6px; height: 8px;">
                <div class="monitoring-meter-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
            <div>
              <div class="text-xs text-muted" style="margin-bottom: 4px;">Current Resolution Level</div>
              <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-display); color: ${resPct === 100 ? '#15803d' : resPct === 50 ? '#dc2626' : 'var(--cyan-dark)'};">
                ${resPct}%
              </div>
              <div class="text-xs text-muted">
                ${resPct === 100 ? 'Final durability confirmed' : resPct === 50 ? 'Dropped below 100% due to defect recurrence' : 'Under observation (Requires 100% final confirmation)'}
              </div>
            </div>
          </div>

          <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: 6px; margin-bottom: 0.75rem; border: 1px solid var(--border-light);">
            ${sensorInfo}
            <div class="text-xs text-muted" style="margin-top: 5px;">
              Observations: "${mon.observations || 'Road surface intact under post-repair observation.'}"
            </div>
          </div>

          <div style="font-size: 0.76rem; color: var(--text-secondary); background: #f0f9ff; border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 6px; padding: 0.65rem 0.85rem; line-height: 1.4;">
            💡 <strong>Why Post-Repair Monitoring?</strong> The repair has been completed on-site by the maintenance engineer. The road is now under a mandatory ${daysTotal}-day observation period to ensure the patch holds under real-world traffic loads before the municipal authority grants 100% final resolution.
          </div>
        </div>
      `;
    } else {
      monitoringCard.classList.add('hidden');
    }
  }

  // Post-repair evidence section (Visible when Resolved or Repair Completed)
  if (repairEvidenceCard) {
    if ((c.status === 'RESOLVED' || c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED') && c.repairEvidence) {
      const isFullResolved = c.status === 'RESOLVED';
      repairEvidenceCard.classList.remove('hidden');
      repairEvidenceCard.innerHTML = `
        <div class="card-header" style="background: ${isFullResolved ? '#f0fdf4' : '#eff6ff'};">
          <div class="card-title" style="color: ${isFullResolved ? '#15803d' : '#1d4ed8'};">
            <i data-lucide="${isFullResolved ? 'check-circle' : 'shield-check'}" style="width: 18px; height: 18px;"></i>
            <span>${isFullResolved ? 'Verified Repair Proof (Before vs After)' : 'Repair Completed — Quality Verification Pending'}</span>
          </div>
          <span class="badge ${isFullResolved ? 'badge-status-resolved' : 'badge-status-in-progress'}">
            ${isFullResolved ? 'Officially Closed' : 'Quality Monitoring'}
          </span>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">
                Initial Damage Evidence
              </div>
              <img src="${c.mediaUrl || SAMPLE_ROAD_IMAGES.pothole_severe}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-medium);" alt="Before Repair" />
            </div>
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; color: #15803d; text-transform: uppercase; margin-bottom: 4px;">
                Post-Repair Surface Verification
              </div>
              <img src="${c.repairEvidence.imageUrl}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1.5px solid #16a34a;" alt="After Repair" />
            </div>
          </div>
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-subtle); border-radius: 6px; font-size: 0.8rem;">
            <strong>Authority Repair Notes:</strong> ${c.repairEvidence.notes}<br/>
            <span class="text-xs text-muted">Officer: ${c.repairEvidence.resolvedBy} ${c.repairEvidence.completedAt || c.repairEvidence.resolvedAt ? `&bull; ${new Date(c.repairEvidence.completedAt || c.repairEvidence.resolvedAt).toLocaleString('en-IN')}` : ''}</span>
          </div>
        </div>
      `;
    } else {
      repairEvidenceCard.classList.add('hidden');
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function initTrackingSearch() {
  const searchInput = document.getElementById('searchComplaintInput');
  const searchBtn = document.getElementById('btnSearchComplaint');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const q = searchInput.value.trim();
      if (q) openTrackingModal(q);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) openTrackingModal(q);
      }
    });
  }
}

/* ================= Toast Notification ================= */
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
    <i data-lucide="check-circle-2" style="width: 18px; height: 18px; color: var(--cyan-glow);"></i>
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

/**
 * MargDrishti — Authority Dashboard Controller
 * Prioritized Maintenance Queue, YOLO11 AI Inspector, Officer Assignment,
 * and Verified Repair Resolution with immediate cross-dashboard sync.
 */

import { MargDrishtiStore, POST_REPAIR_MONITORING_DAYS } from './store.js';
import { DEMO_OFFICERS, SAMPLE_ROAD_IMAGES } from './mockData.js';
import { renderBoundingBoxesOnCanvas } from './boundingBox.js';
import { GeoService } from './geoService.js';
import { AuthService } from './auth.js';
import { I18n } from './i18n.js';

let activeFilter = 'ALL';
let selectedComplaintId = null;
let inspectorMapInstance = null;
let activeAuthoritySession = null;

document.addEventListener('DOMContentLoaded', () => {
  // Enforce Authority Route Protection
  activeAuthoritySession = AuthService.requireAuth('authority', 'index.html?login=authority');
  if (!activeAuthoritySession) return;

  if (window.lucide) window.lucide.createIcons();

  initAuthorityProfile();
  initMonitoringConfig();
  initKPIs();
  renderMonitoringTable();
  renderQueue();
  initFilterTabs();
  initAssignModalEvents();
  initResolveModalEvents();
  initConfirmFinalModalEvents();
  initReinspectionModalEvents();

  // Listen to cross-dashboard store updates
  window.addEventListener('margdrishti:updated', () => {
    initKPIs();
    renderMonitoringTable();
    renderQueue();
    if (selectedComplaintId) {
      const updated = MargDrishtiStore.getComplaintById(selectedComplaintId);
      if (updated) renderComplaintInspector(updated);
    }
  });

  // Listen to language changes
  window.addEventListener('margdrishti:lang_changed', () => {
    renderMonitoringTable();
    renderQueue();
    if (selectedComplaintId) {
      const updated = MargDrishtiStore.getComplaintById(selectedComplaintId);
      if (updated) renderComplaintInspector(updated);
    }
  });

  // Demo reset
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
function initAuthorityProfile() {
  if (!activeAuthoritySession || !activeAuthoritySession.user) return;
  const nameEl = document.getElementById('authorityDisplayName');
  const roleEl = document.getElementById('authorityDisplayRole');
  const dotEl = document.getElementById('authorityAvatarDot');
  const idEl = document.getElementById('authorityDisplayId');

  if (nameEl) nameEl.textContent = activeAuthoritySession.user.name;
  if (roleEl) {
    const roadType = activeAuthoritySession.user.roadType ? ` • ${activeAuthoritySession.user.roadType}` : '';
    roleEl.textContent = `${activeAuthoritySession.user.designation || 'Municipal Officer'}${roadType}`;
  }
  if (dotEl) dotEl.textContent = (activeAuthoritySession.user.name || 'R').charAt(0).toUpperCase();
  if (idEl) idEl.textContent = activeAuthoritySession.user.authorityId || 'AUT-2026-000001';
}

window.authorityLogout = function() {
  AuthService.logout();
};

/* ================= 0.5. Monitoring Period Configuration ================= */
function initMonitoringConfig() {
  const select = document.getElementById('selectMonitoringConfig');
  if (!select) return;

  const currentDays = MargDrishtiStore.getMonitoringDays();
  select.value = String(currentDays);

  select.addEventListener('change', (e) => {
    const days = parseInt(e.target.value, 10);
    MargDrishtiStore.setMonitoringDays(days);
    showToast('Monitoring Period Updated', `Default post-repair observation set to ${days} days.`);
  });
}

/* ================= 1. KPI Indicators ================= */
function initKPIs() {
  const all = MargDrishtiStore.getAllComplaints();

  const totalEl = document.getElementById('authKpiTotal');
  const criticalEl = document.getElementById('authKpiCritical');
  const inProgressEl = document.getElementById('authKpiInProgress');
  const monitoringEl = document.getElementById('authKpiMonitoring');
  const resolvedEl = document.getElementById('authKpiResolved');

  const countCrit = all.filter(c => (c.priority?.score || 0) >= 80).length;
  const countProg = all.filter(c => c.status === 'IN_PROGRESS').length;
  const countMon = all.filter(c => c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED').length;
  const countRes = all.filter(c => c.status === 'RESOLVED').length;

  if (totalEl) totalEl.textContent = all.length;
  if (criticalEl) criticalEl.textContent = countCrit;
  if (inProgressEl) inProgressEl.textContent = countProg;
  if (monitoringEl) monitoringEl.textContent = countMon;
  if (resolvedEl) resolvedEl.textContent = countRes;

  // Secondary indicators & jurisdiction context
  const potholeCount = all.filter(c => c.damageType === 'POTHOLE').length;
  const crackCount = all.filter(c => c.damageType === 'CRACK').length;

  const subIndicatorsEl = document.getElementById('authSubIndicators');
  if (subIndicatorsEl) {
    const authId = activeAuthoritySession?.user?.authorityId || 'AUT-2026-000001';
    const juris = activeAuthoritySession?.user?.jurisdiction || 'State PWD (PWD Roads & Highways)';
    const roadType = activeAuthoritySession?.user?.roadType || 'State Highway';
    subIndicatorsEl.innerHTML = `
      <span>ID: <strong style="color:var(--cyan-dark);">${authId}</strong></span> &bull;
      <span>Jurisdiction: <strong>${juris}</strong></span> &bull;
      <span>Road Scope: <strong>${roadType}</strong></span> &bull;
      <span>Potholes: <strong>${potholeCount}</strong></span> &bull;
      <span>Cracks: <strong>${crackCount}</strong></span>
    `;
  }
}

/* ================= 2. Post-Repair Monitoring Table ================= */
function renderMonitoringTable() {
  const tbody = document.getElementById('repairsMonitoringTbody');
  if (!tbody) return;

  const all = MargDrishtiStore.getAllComplaints();
  const monitored = all.filter(c => 
    c.monitoring || 
    c.status === 'REPAIR_COMPLETED' || 
    c.status === 'CONFIRMATION_REQUIRED' || 
    c.status === 'REINSPECTION_REQUIRED'
  );

  if (monitored.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem;" class="text-muted">
          No repairs currently in post-repair monitoring. When an engineer marks "Repair Completed", complaints enter the mandatory 60-day observation cycle here.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = monitored.map(c => {
    const mon = c.monitoring || {
      status: c.status === 'CONFIRMATION_REQUIRED' ? 'CONFIRMATION_REQUIRED' : 'PENDING',
      daysTotal: MargDrishtiStore.getMonitoringDays(),
      daysCompleted: c.status === 'CONFIRMATION_REQUIRED' ? MargDrishtiStore.getMonitoringDays() : 18,
      startDate: c.repairEvidence?.completedAt || c.createdAt,
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      observations: 'Road surface intact under post-repair observation.'
    };

    const daysTotal = mon.daysTotal || MargDrishtiStore.getMonitoringDays();
    const daysDone = Math.min(daysTotal, mon.daysCompleted || 0);
    const daysLeft = Math.max(0, daysTotal - daysDone);
    const pct = Math.round((daysDone / daysTotal) * 100);

    const isConfirmationRequired = c.status === 'CONFIRMATION_REQUIRED' || daysDone >= daysTotal;
    const isFailed = c.status === 'REINSPECTION_REQUIRED' || mon.status === 'FAILED' || mon.status === 'ABNORMAL_DETECTED';
    const isPassed = c.status === 'RESOLVED' && (mon.status === 'PASSED' || c.resolution === 100);

    let statusBadgeHtml = '';
    if (isPassed) {
      statusBadgeHtml = `<span class="badge badge-status-resolved">🟢 100% Fully Resolved</span>`;
    } else if (isFailed) {
      statusBadgeHtml = `<span class="badge badge-status-reinspection">🔴 Reinspection Required</span>`;
    } else if (isConfirmationRequired) {
      statusBadgeHtml = `<span class="badge badge-status-confirmation">🟡 Confirmation Required</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-status-monitoring">🟡 Under Monitoring (90%)</span>`;
    }

    const startDateStr = mon.startDate ? new Date(mon.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recent';
    const endDateStr = mon.endDate ? new Date(mon.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : `${daysTotal} Days`;

    // Sensor observations & Deterioration Detection
    let sensorHtml = '';
    if (isFailed || mon.status === 'ABNORMAL_DETECTED') {
      sensorHtml = `
        <div style="font-size: 0.7rem; color: #b91c1c; font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; background: #fef2f2; padding: 3px 6px; border-radius: 4px; border: 1px solid #fecaca;">
          <i data-lucide="alert-triangle" style="width: 12px; height: 12px; color: #dc2626;"></i>
          <span>Possible Deterioration Detected &bull; Authority Review Required</span>
        </div>
      `;
    } else if (mon.sensorEvidence || (c.sensorTelemetry && (c.sensorTelemetry.accelerometer?.available || c.sensorTelemetry.gps?.available))) {
      const mag = mon.sensorEvidence?.accelerometer || (c.sensorTelemetry?.accelerometer?.magnitude ? `|A|: ${c.sensorTelemetry.accelerometer.magnitude} m/s²` : '|A|: 9.81 m/s²');
      sensorHtml = `
        <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 3px; display: flex; align-items: center; gap: 3px;">
          <i data-lucide="activity" style="width: 12px; height: 12px;"></i>
          <span>Sensor Evidence: Normal (${mag}) &bull; Stable</span>
        </div>
      `;
    } else {
      sensorHtml = `
        <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 3px;">
          <i data-lucide="info" style="width: 12px; height: 12px;"></i>
          <span>No sensor observations available yet.</span>
        </div>
      `;
    }

    return `
      <tr style="${isConfirmationRequired ? 'background: #fffdf5;' : isFailed ? 'background: #fff8f8;' : ''}">
        <td>
          <div style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-dark);">${c.complaintId}</div>
          <div style="font-size: 0.82rem; font-weight: 600;">${c.location?.roadName || 'Arterial Corridor'}</div>
          <div class="text-xs text-muted">${c.location?.ward || ''} &bull; <span class="badge" style="padding: 1px 5px; font-size: 0.65rem;">${c.damageType} (${c.severity})</span></div>
        </td>
        <td class="text-xs">
          <strong>${c.assignedOfficer?.name || c.repairEvidence?.resolvedBy || 'Rajesh Kumar'}</strong>
          <div class="text-muted">${c.assignedOfficer?.designation || 'Assistant Executive Engineer'}</div>
        </td>
        <td class="text-xs font-mono">
          ${c.repairEvidence?.completedAt ? new Date(c.repairEvidence.completedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '5 Sept 2026'}
        </td>
        <td class="text-xs">
          <div>Start: <strong>${startDateStr}</strong></div>
          <div class="text-muted">End: <strong>${endDateStr}</strong></div>
        </td>
        <td>
          <div class="monitoring-day-meter">
            <strong>Day ${daysDone} / ${daysTotal}</strong>
            <span class="text-muted text-xs">(${daysLeft} left)</span>
          </div>
          <div class="monitoring-meter-track" style="margin-top: 4px;">
            <div class="monitoring-meter-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td>
          ${statusBadgeHtml}
          <div style="font-size: 0.72rem; margin-top: 3px; font-weight: 700; color: var(--text-secondary);">
            Resolution: ${c.resolution || (isPassed ? 100 : isFailed ? 50 : 90)}%
          </div>
        </td>
        <td style="max-width: 230px;">
          <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.35;">
            "${mon.observations || c.repairEvidence?.notes || 'Road surface intact.'}"
          </div>
          ${sensorHtml}
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${!isPassed && !isFailed ? `
              <button type="button" class="btn btn-emerald btn-sm" onclick="window.openConfirmFinalModal('${c.complaintId}')" style="font-size: 0.72rem; padding: 0.25rem 0.5rem;" title="Confirm durability and mark 100% Fully Resolved">
                <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i>
                <span>Confirm Final Resolution</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.openReinspectionModal('${c.complaintId}')" style="font-size: 0.72rem; padding: 0.25rem 0.5rem; color: #dc2626; border-color: rgba(239, 68, 68, 0.4);" title="Flag damage recurrence and request re-repair">
                <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i>
                <span>Request Reinspection</span>
              </button>
              <div style="display: flex; gap: 0.25rem; margin-top: 2px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.simulateSensor('${c.complaintId}', false)" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; flex: 1; color: #059669;" title="Simulate normal sensor telemetry">
                  + Normal Sensor
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.simulateSensor('${c.complaintId}', true)" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; flex: 1; color: #dc2626;" title="Simulate deterioration detected by sensors">
                  ! Deterioration
                </button>
              </div>
              <div style="display: flex; gap: 0.25rem; margin-top: 2px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.simulateMonitoring('${c.complaintId}', 7)" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; flex: 1;" title="Simulate passing 7 days">
                  +7d
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.simulateMonitoring('${c.complaintId}', 15)" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; flex: 1;" title="Simulate passing 15 days">
                  +15d
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.simulateMonitoring('${c.complaintId}', ${daysLeft || 1})" style="font-size: 0.65rem; padding: 0.15rem 0.35rem; flex: 1;" title="Advance to 60-day completion">
                  Complete
                </button>
              </div>
            ` : `
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.inspectComplaint('${c.complaintId}')" style="font-size: 0.72rem; padding: 0.25rem 0.5rem;">
                <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                <span>Inspect Report</span>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ================= 3. Priority Maintenance Queue ================= */
function initFilterTabs() {
  document.querySelectorAll('.auth-filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderQueue();
    });
  });
}

function renderQueue() {
  const tbody = document.getElementById('authorityQueueTbody');
  if (!tbody) return;

  const totalInDb = MargDrishtiStore.getAllComplaints();

  if (totalInDb.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem 1.5rem;" class="text-muted">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
            <i data-lucide="clipboard-check" style="width: 42px; height: 42px; stroke-width: 1.25; color: #94a3b8;"></i>
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-secondary);">No complaints received yet</div>
            <div style="font-size: 0.82rem; max-width: 420px; line-height: 1.4; color: var(--text-muted);">
              There are currently zero active road hazard reports in the municipal database. Reports filed by citizens or patrol cameras will appear here dynamically ranked by priority.
            </div>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let list = totalInDb;

  // Apply filters
  if (activeFilter === 'IMAGE') list = list.filter(c => c.mediaType === 'image');
  else if (activeFilter === 'VIDEO') list = list.filter(c => c.mediaType === 'video');
  else if (activeFilter === 'POTHOLE') list = list.filter(c => c.damageType === 'POTHOLE');
  else if (activeFilter === 'CRACK') list = list.filter(c => c.damageType === 'CRACK');
  else if (activeFilter === 'CRITICAL') list = list.filter(c => (c.priority?.score || 0) >= 80);
  else if (activeFilter === 'IN_PROGRESS') list = list.filter(c => c.status === 'IN_PROGRESS');
  else if (activeFilter === 'MONITORING') list = list.filter(c => c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED');
  else if (activeFilter === 'RESOLVED') list = list.filter(c => c.status === 'RESOLVED');

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem;" class="text-muted">
          No complaints match the filter "${activeFilter}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((c, idx) => {
    const isVideo = c.mediaType === 'video';
    const score = c.priority?.score || 50;
    const isCritical = score >= 80;

    let prioBadgeClass = 'badge-priority-medium';
    if (score >= 80) prioBadgeClass = 'badge-priority-critical';
    else if (score >= 60) prioBadgeClass = 'badge-priority-high';

    let statusBadgeClass = 'badge-status-reported';
    let statusLabel = I18n.getStatusLabel(c.status);
    if (c.status === 'AI_ANALYZED') { statusBadgeClass = 'badge-status-analyzed'; }
    else if (c.status === 'VERIFIED') { statusBadgeClass = 'badge-status-verified'; }
    else if (c.status === 'ASSIGNED') { statusBadgeClass = 'badge-status-assigned'; }
    else if (c.status === 'IN_PROGRESS') { statusBadgeClass = 'badge-status-in-progress'; }
    else if (c.status === 'REPAIR_COMPLETED') { statusBadgeClass = 'badge-status-monitoring'; statusLabel = 'Under Monitoring (90%)'; }
    else if (c.status === 'CONFIRMATION_REQUIRED') { statusBadgeClass = 'badge-status-confirmation'; statusLabel = 'Confirmation Required (90%)'; }
    else if (c.status === 'REINSPECTION_REQUIRED') { statusBadgeClass = 'badge-status-reinspection'; statusLabel = 'Reinspection Required'; }
    else if (c.status === 'RESOLVED') { statusBadgeClass = 'badge-status-resolved'; statusLabel = '100% Resolved'; }

    return `
      <tr style="${isCritical ? 'background: #fffafa;' : ''}">
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="font-mono font-bold" style="font-size: 1.1rem; color: ${isCritical ? 'var(--priority-critical)' : 'var(--priority-high)'};">
              #${idx + 1}
            </span>
            <span class="badge ${prioBadgeClass}" style="font-size: 0.78rem;">
              ${score}/100 &bull; ${I18n.getPriorityLabel(c.priority?.level || 'HIGH')}
            </span>
          </div>
        </td>
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
          <strong>${c.damageType}</strong>
          <span class="text-xs text-muted" style="display: block;">Severity: ${c.severity}</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 600;">${c.location?.roadName || 'Arterial Road'}</div>
          <div class="text-xs text-muted">${c.location?.ward || ''}</div>
        </td>
        <td>
          <span class="badge ${statusBadgeClass}">
            ${statusLabel}
          </span>
        </td>
        <td class="text-xs">
          ${c.assignedOfficer ? `<strong>${c.assignedOfficer.name}</strong>` : '<span class="text-muted">Unassigned</span>'}
        </td>
        <td>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.inspectComplaint('${c.complaintId}')">
            <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
            <span>Inspect Report</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

/* ================= 3. Complaint Details Inspector ================= */
window.inspectComplaint = function(complaintId) {
  selectedComplaintId = complaintId;
  const complaint = MargDrishtiStore.getComplaintById(complaintId);
  if (!complaint) return;

  const modal = document.getElementById('complaintInspectorModal');
  renderComplaintInspector(complaint);
  modal.classList.add('active');
};

window.closeComplaintInspector = function() {
  const modal = document.getElementById('complaintInspectorModal');
  if (modal) modal.classList.remove('active');
  selectedComplaintId = null;
};

function renderComplaintInspector(c) {
  // 1. Header Info
  const idEl = document.getElementById('inspectorComplaintId');
  const prioTag = document.getElementById('inspectorPrioTag');
  const statusBadge = document.getElementById('inspectorStatusBadge');
  const citizenDesc = document.getElementById('inspectorCitizenDesc');

  if (idEl) idEl.textContent = c.complaintId;
  if (prioTag) {
    prioTag.textContent = `${c.priority?.score || 84} / 100 • ${c.priority?.level || 'HIGH'} PRIORITY`;
    prioTag.className = `badge ${(c.priority?.score || 0) >= 80 ? 'badge-priority-critical' : 'badge-priority-high'}`;
  }

  let statusBadgeClass = 'badge-status-reported';
  let statusText = 'Reported';
  if (c.status === 'AI_ANALYZED') { statusBadgeClass = 'badge-status-analyzed'; statusText = 'AI Analyzed'; }
  else if (c.status === 'VERIFIED') { statusBadgeClass = 'badge-status-verified'; statusText = 'Verified'; }
  else if (c.status === 'ASSIGNED') { statusBadgeClass = 'badge-status-assigned'; statusText = 'Assigned'; }
  else if (c.status === 'IN_PROGRESS') { statusBadgeClass = 'badge-status-in-progress'; statusText = 'In Progress'; }
  else if (c.status === 'REPAIR_COMPLETED') { statusBadgeClass = 'badge-status-monitoring'; statusText = 'Under Monitoring (90%)'; }
  else if (c.status === 'CONFIRMATION_REQUIRED') { statusBadgeClass = 'badge-status-confirmation'; statusText = 'Confirmation Required'; }
  else if (c.status === 'REINSPECTION_REQUIRED') { statusBadgeClass = 'badge-status-reinspection'; statusText = 'Reinspection Required'; }
  else if (c.status === 'RESOLVED') { statusBadgeClass = 'badge-status-resolved'; statusText = '100% Resolved'; }

  if (statusBadge) {
    statusBadge.className = `badge ${statusBadgeClass}`;
    statusBadge.textContent = statusText;
  }

  if (citizenDesc) {
    citizenDesc.textContent = `"${c.description || 'Citizen road hazard submission.'}"`;
  }

  // 2. Evidence View (Canvas vs Video)
  const canvas = document.getElementById('inspectorYoloCanvas');
  const video = document.getElementById('inspectorVideoPlayer');
  const videoSummary = document.getElementById('inspectorVideoSummary');

  if (c.mediaType === 'video') {
    if (canvas) canvas.classList.add('hidden');
    if (video) {
      video.classList.remove('hidden');
      video.src = c.mediaUrl;
      video.load();
    }
    if (videoSummary) {
      videoSummary.classList.remove('hidden');
      videoSummary.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.95); padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(6, 182, 212, 0.35); font-size: 0.78rem; font-family: var(--font-mono); color: #ffffff;">
          <div style="color: #38bdf8; font-weight: 700; margin-bottom: 4px;">VIDEO EVIDENCE & FRAME AGGREGATION</div>
          <div>Duration: <strong>${c.videoDetails?.duration || '00:14'}</strong> &bull; Analyzed Frames: <strong>${c.videoDetails?.framesAnalyzed || 12}</strong></div>
          <div>Detections: <strong>${c.videoDetails?.framesWithDetections || 4} frames with ${c.damageType}</strong></div>
          <div>Highest Confidence: <strong>${Math.round((c.confidence || 0.91) * 100)}%</strong> at timestamp <strong>${c.videoDetails?.evidenceTimestamp || '00:08'}</strong></div>
          <div style="margin-top: 4px; color: #94a3b8; font-size: 0.7rem;">Model: YOLO11-RDD2022 [Video Analysis Demo]</div>
        </div>
      `;
    }
  } else {
    if (video) video.classList.add('hidden');
    if (videoSummary) videoSummary.classList.add('hidden');
    if (canvas) {
      canvas.classList.remove('hidden');
      renderBoundingBoxesOnCanvas(canvas, c.mediaUrl, c.detections || []);
    }
  }

  // 3. Priority Breakdown
  const p = c.priority || {};
  const b = p.breakdown || { damageSeverity: 24, damageExtent: 16, roadImportance: 18, trafficExposure: 8, sensitiveLocation: 10, corroboratingEvidence: 8 };

  setInspectorBar('inspBarSev', (b.damageSeverity / 30) * 100, `${b.damageSeverity}/30`);
  setInspectorBar('inspBarExt', (b.damageExtent / 20) * 100, `${b.damageExtent}/20`);
  setInspectorBar('inspBarRoad', (b.roadImportance / 20) * 100, `${b.roadImportance}/20`);
  setInspectorBar('inspBarTraf', (b.trafficExposure / 10) * 100, `${b.trafficExposure}/10`);
  setInspectorBar('inspBarSens', (b.sensitiveLocation / 10) * 100, `${b.sensitiveLocation}/10`);
  setInspectorBar('inspBarCorr', (b.corroboratingEvidence / 10) * 100, `${b.corroboratingEvidence}/10`);

  const rationaleEl = document.getElementById('inspectorRationale');
  if (rationaleEl) rationaleEl.textContent = p.rationale || 'Evaluated via MargDrishti explainable priority formula.';

  // 4. Location Context & Leaflet Map
  const locText = document.getElementById('inspectorLocText');
  const locCoords = document.getElementById('inspectorLocCoords');
  if (locText) {
    const auth = c.responsibleAuthority || 'Municipal Corporation / Municipal Council';
    const road = c.roadType || 'City / Municipal Road';
    const juris = c.jurisdiction || c.location?.ward || 'Local Municipal Ward';
    locText.innerHTML = `
      <strong>${c.location?.roadName || 'Arterial Road'}</strong> (${c.location?.ward || ''})<br/>
      <span style="color: #15803d; font-size: 0.76rem; font-weight: 700;">Responsible Authority: ${auth}</span><br/>
      <span class="text-xs text-muted">Scope: ${road} &bull; ${juris} &bull; Citizen: <strong class="font-mono">${c.citizenId || 'CIT-2026-000001'}</strong></span>
    `;
  }
  if (locCoords) locCoords.textContent = `${c.location?.latitude.toFixed(4)}, ${c.location?.longitude.toFixed(4)} (${c.location?.source === 'CURRENT_DEVICE_LOCATION' ? 'GPS' : 'Manual'})`;

  setTimeout(() => {
    if (c.location && window.L) {
      inspectorMapInstance = GeoService.initLeafletMap('inspectorLeafletMap', c.location, {
        title: c.location.roadName,
        zoom: 15
      });
    }
  }, 150);

  // 5. Lifecycle Timeline
  renderInspectorTimeline(c);

  // 6. Action Button States
  updateInspectorActionButtons(c);
}

function setInspectorBar(id, pct, text) {
  const el = document.getElementById(id);
  const lbl = document.getElementById(`${id}Label`);
  if (el) el.style.width = `${pct}%`;
  if (lbl) lbl.textContent = text;
}

function renderInspectorTimeline(c) {
  const container = document.getElementById('inspectorTimeline');
  if (!container) return;

  const STAGES = [
    { key: 'REPORTED', label: 'Reported' },
    { key: 'AI_ANALYZED', label: 'AI Analyzed' },
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'ASSIGNED', label: 'Assigned' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'REPAIR_COMPLETED', label: 'Repair Completed (90% Monitoring)' },
    { key: 'RESOLVED', label: '100% Fully Resolved' }
  ];

  const statusOrder = ['REPORTED', 'AI_ANALYZED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'RESOLVED'];
  let currentIdx = statusOrder.indexOf(c.status);
  if (c.status === 'CONFIRMATION_REQUIRED') currentIdx = 5;

  container.innerHTML = STAGES.map((st, idx) => {
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

    const history = c.timeline?.find(t => t.status === st.key || (st.key === 'RESOLVED' && t.status === 'RESOLVED'));

    let marker = idx + 1;
    let markerClass = 'pending';
    if (isCompleted) {
      marker = '✓';
      markerClass = 'completed';
    } else if (isFailed) {
      marker = '!';
      markerClass = 'reinspection';
    } else if (isActive) {
      markerClass = 'active';
    }

    const monitoringRemark = c.monitoring ? 
      `Day ${c.monitoring.daysCompleted || 0}/${c.monitoring.daysTotal || 30} • ${c.monitoring.status || 'PENDING'} • ${c.resolution || 90}%` :
      'Under post-repair quality observation';

    return `
      <div class="timeline-item ${markerClass}">
        <div class="timeline-marker" style="${isFailed ? 'background:#dc2626; color:#fff;' : ''}">${marker}</div>
        <div>
          <div class="timeline-title">${st.label} ${isFailed ? '<span style="color:#dc2626; font-size:0.75rem;">(Damage Reappeared)</span>' : ''}</div>
          <div class="timeline-desc text-xs">${history?.remarks || (st.key === 'REPAIR_COMPLETED' ? monitoringRemark : 'Pending authority action')}</div>
          ${history ? `<div class="timeline-time">${new Date(history.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} &bull; ${history.actor}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateInspectorActionButtons(c) {
  const btnVerify = document.getElementById('btnActionVerify');
  const btnAssign = document.getElementById('btnActionAssign');
  const btnInProgress = document.getElementById('btnActionInProgress');
  const btnRepairCompleted = document.getElementById('btnActionRepairCompleted');
  const btnConfirmFinal = document.getElementById('btnActionConfirmFinal');
  const btnReinspect = document.getElementById('btnActionReinspect');

  const isResolved = c.status === 'RESOLVED';
  const isMonitoring = c.status === 'REPAIR_COMPLETED' || c.status === 'CONFIRMATION_REQUIRED';
  const isReinspection = c.status === 'REINSPECTION_REQUIRED';

  if (btnVerify) {
    const alreadyVerified = (c.status === 'VERIFIED' || c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || isMonitoring || isResolved);
    btnVerify.disabled = isResolved || alreadyVerified;
    btnVerify.textContent = alreadyVerified ? '✓ Hazard Verified' : 'Verify Hazard Triage';
    btnVerify.onclick = () => {
      MargDrishtiStore.verifyComplaint(c.complaintId, activeAuthoritySession?.user?.name || 'Assistant Executive Engineer');
      showToast('Verified', `${c.complaintId} verified and confirmed for maintenance triage.`);
    };
  }

  if (btnAssign) {
    btnAssign.disabled = isResolved;
    btnAssign.innerHTML = c.assignedOfficer ? `<i data-lucide="user-check"></i> Re-assign Crew` : `<i data-lucide="user-plus"></i> Assign Engineer`;
    btnAssign.onclick = () => openAssignModal(c.complaintId);
  }

  // 15-Day Assignment Rule Enforcement
  const ruleBanner = document.getElementById('assignmentRuleBanner');
  const ruleText = document.getElementById('assignmentRuleText');
  const ruleDays = document.getElementById('assignmentRuleDays');
  const btnFastForward = document.getElementById('btnFastForwardAssignment');

  if (btnInProgress) {
    if (c.status === 'ASSIGNED') {
      const daysElapsed = MargDrishtiStore.getDaysSinceAssignment(c);
      const progressCheck = MargDrishtiStore.canStartProgress(c.complaintId);
      const canProgress = typeof progressCheck === 'boolean' ? progressCheck : !!progressCheck?.allowed;
      const daysRemaining = Math.max(0, 15 - daysElapsed);

      if (ruleBanner) {
        ruleBanner.style.display = 'block';
        if (canProgress) {
          ruleBanner.style.background = '#f0fdf4';
          ruleBanner.style.borderColor = '#bbf7d0';
          ruleBanner.style.color = '#15803d';
          if (ruleText) ruleText.textContent = 'Minimum 15-day assignment period satisfied. Ground repair operations may commence.';
          if (ruleDays) ruleDays.textContent = `Days elapsed: ${daysElapsed} / 15 (Ready)`;
          if (btnFastForward) btnFastForward.style.display = 'none';
        } else {
          ruleBanner.style.background = '#fffbeb';
          ruleBanner.style.borderColor = '#fde68a';
          ruleBanner.style.color = '#92400e';
          if (ruleText) ruleText.textContent = 'Repair work can be started only after the minimum 15-day assignment period.';
          if (ruleDays) ruleDays.textContent = `Days elapsed: ${daysElapsed} / 15 (${daysRemaining} days remaining)`;
          if (btnFastForward) {
            btnFastForward.style.display = 'inline-flex';
            btnFastForward.onclick = () => {
              MargDrishtiStore.fastForwardAssignment(c.complaintId, 15);
              showToast('Fast-Forward Applied', `Advanced assignment timestamp by 15 days for ${c.complaintId}.`);
              const refreshed = MargDrishtiStore.getComplaintById(c.complaintId);
              if (refreshed) renderComplaintInspector(refreshed);
            };
          }
        }
      }

      btnInProgress.disabled = !canProgress;
      btnInProgress.textContent = canProgress ? 'Mark In Progress (15-Day Lock Satisfied)' : `Mark In Progress (${daysRemaining}d lock remaining)`;
      btnInProgress.title = canProgress ? 'Mobilize repair crew' : 'Repair work can be started only after the minimum 15-day assignment period';
      btnInProgress.onclick = () => {
        MargDrishtiStore.updateStatus(c.complaintId, 'IN_PROGRESS', 'Zonal asphalt repair squad deployed to coordinates.', activeAuthoritySession?.user?.name || 'Assistant Executive Engineer');
        showToast('Status Updated', `${c.complaintId} marked as IN PROGRESS.`);
      };
    } else {
      if (ruleBanner) ruleBanner.style.display = 'none';

      if (c.status === 'IN_PROGRESS') {
        btnInProgress.disabled = true;
        btnInProgress.textContent = 'Currently In Progress';
      } else if (isReinspection) {
        btnInProgress.disabled = false;
        btnInProgress.textContent = 'Resume Repair (In Progress)';
        btnInProgress.onclick = () => {
          MargDrishtiStore.updateStatus(c.complaintId, 'IN_PROGRESS', 'Repair resumed after reinspection flag.', activeAuthoritySession?.user?.name || 'Assistant Executive Engineer');
          showToast('Status Updated', `${c.complaintId} resumed in progress.`);
        };
      } else {
        btnInProgress.disabled = true;
        btnInProgress.textContent = isResolved ? 'Resolved' : isMonitoring ? 'Under Monitoring' : 'Mark In Progress (Assign First)';
      }
    }
  }

  if (btnRepairCompleted) {
    btnRepairCompleted.disabled = isResolved || isMonitoring;
    btnRepairCompleted.textContent = isMonitoring ? '✓ Repair Completed (90% In Monitoring)' : 'Mark Repair Completed (Enters Monitoring — 90%)';
    btnRepairCompleted.onclick = () => {
      MargDrishtiStore.markRepairCompleted(c.complaintId, {
        resolvedBy: activeAuthoritySession?.user ? `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})` : 'Rajesh Kumar (AEE)'
      });
      showToast('Repair Completed', `${c.complaintId} marked Repair Completed. Post-repair monitoring initialized at 90% resolution.`);
    };
  }

  if (btnConfirmFinal) {
    btnConfirmFinal.disabled = isResolved || (!isMonitoring && c.status !== 'IN_PROGRESS');
    btnConfirmFinal.onclick = () => openConfirmFinalModal(c.complaintId);
  }

  if (btnReinspect) {
    btnReinspect.disabled = isReinspection || isResolved;
    btnReinspect.onclick = () => openReinspectionModal(c.complaintId);
  }

  if (window.lucide) window.lucide.createIcons();
}

/* ================= 4. Assign Engineer Modal ================= */
function initAssignModalEvents() {
  const form = document.getElementById('assignOfficerForm');
  if (!form) return;

  // Populate demo officers
  const select = document.getElementById('selectAssignOfficer');
  if (select) {
    select.innerHTML = DEMO_OFFICERS.map(o => `
      <option value="${o.id}">${o.name} &bull; ${o.designation} (${o.zone})</option>
    `).join('');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const officerId = select.value;
    const officer = DEMO_OFFICERS.find(o => o.id === officerId) || DEMO_OFFICERS[0];
    const notes = document.getElementById('assignNotesInput')?.value || 'Dispatched for pothole repair.';

    if (selectedComplaintId) {
      MargDrishtiStore.assignOfficer(selectedComplaintId, officer, notes);
      document.getElementById('assignOfficerModal').classList.remove('active');
      showToast('Work Order Assigned', `Assigned ${selectedComplaintId} to ${officer.name}.`);
    }
  });
}

window.openAssignModal = function(complaintId) {
  selectedComplaintId = complaintId;
  const modal = document.getElementById('assignOfficerModal');
  if (modal) modal.classList.add('active');
};

window.closeAssignModal = function() {
  const modal = document.getElementById('assignOfficerModal');
  if (modal) modal.classList.remove('active');
};

/* ================= 5. Mark Resolved & Repair Proof Modal ================= */
function initResolveModalEvents() {
  const form = document.getElementById('resolveComplaintForm');
  if (!form) return;

  // Set default sample repaired road image
  const previewImg = document.getElementById('resolvePreviewImg');
  if (previewImg) previewImg.src = SAMPLE_ROAD_IMAGES.repaired_road;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = document.getElementById('resolveNotesInput')?.value || 'Surface patched with bitumen mix, compaction tested and verified.';
    const defaultOfficer = activeAuthoritySession?.user ? `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})` : 'Rajesh Kumar (Assistant Executive Engineer)';
    const officerName = document.getElementById('resolveOfficerName')?.value || defaultOfficer;
    const imageUrl = previewImg.src || SAMPLE_ROAD_IMAGES.repaired_road;

    if (selectedComplaintId) {
      MargDrishtiStore.resolveComplaint(selectedComplaintId, {
        imageUrl,
        notes,
        resolvedBy: officerName
      });

      document.getElementById('resolveComplaintModal').classList.remove('active');
      showToast('Complaint Resolved', `${selectedComplaintId} successfully marked as RESOLVED.`);
    }
  });
}

window.openResolveModal = function(complaintId) {
  selectedComplaintId = complaintId;
  const modal = document.getElementById('resolveComplaintModal');
  const officerInput = document.getElementById('resolveOfficerName');
  if (officerInput && activeAuthoritySession?.user) {
    officerInput.value = `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})`;
  }
  if (modal) modal.classList.add('active');
};

window.closeResolveModal = function() {
  const modal = document.getElementById('resolveComplaintModal');
  if (modal) modal.classList.remove('active');
};

/* ================= 6. Confirm Final Resolution Modal ================= */
function initConfirmFinalModalEvents() {
  const form = document.getElementById('confirmFinalForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = document.getElementById('confirmFinalNotes')?.value || 'Surface integrity verified after post-repair observation period. No subsidence, cracks, or loose aggregate detected under ambient traffic loads.';
    const defaultOfficer = activeAuthoritySession?.user ? `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})` : 'Rajesh Kumar (Assistant Executive Engineer)';
    const officerName = document.getElementById('confirmFinalOfficer')?.value || defaultOfficer;

    if (selectedComplaintId) {
      MargDrishtiStore.confirmFinalResolution(selectedComplaintId, {
        confirmedBy: officerName,
        notes: notes
      });
      closeConfirmFinalModal();
      showToast('Resolution Confirmed', `${selectedComplaintId} confirmed 100% RESOLVED.`);
    }
  });
}

window.openConfirmFinalModal = function(complaintId) {
  selectedComplaintId = complaintId;
  const modal = document.getElementById('confirmFinalModal');
  const officerInput = document.getElementById('confirmFinalOfficer');
  if (officerInput && activeAuthoritySession?.user) {
    officerInput.value = `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})`;
  }
  if (modal) modal.classList.add('active');
};

window.closeConfirmFinalModal = function() {
  const modal = document.getElementById('confirmFinalModal');
  if (modal) modal.classList.remove('active');
};

/* ================= 7. Request Reinspection Modal ================= */
function initReinspectionModalEvents() {
  const form = document.getElementById('requestReinspectionForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = document.getElementById('reinspectionReasonInput')?.value || 'Road damage was observed again during the post-repair monitoring period.';
    const defaultOfficer = activeAuthoritySession?.user ? `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})` : 'Rajesh Kumar (Assistant Executive Engineer)';
    const officerName = document.getElementById('reinspectionOfficerName')?.value || defaultOfficer;

    if (selectedComplaintId) {
      MargDrishtiStore.requestReinspection(selectedComplaintId, {
        requestedBy: officerName,
        reason: reason
      });
      closeReinspectionModal();
      showToast('Reinspection Requested', `${selectedComplaintId} flagged: damage reappeared. Status set to REINSPECTION REQUIRED.`);
    }
  });
}

window.openReinspectionModal = function(complaintId) {
  selectedComplaintId = complaintId;
  const modal = document.getElementById('requestReinspectionModal');
  const officerInput = document.getElementById('reinspectionOfficerName');
  if (officerInput && activeAuthoritySession?.user) {
    officerInput.value = `${activeAuthoritySession.user.name} (${activeAuthoritySession.user.designation})`;
  }
  if (modal) modal.classList.add('active');
};

window.closeReinspectionModal = function() {
  const modal = document.getElementById('requestReinspectionModal');
  if (modal) modal.classList.remove('active');
};

/* ================= 8. Live Evaluator Simulator ================= */
window.simulateMonitoring = function(complaintId, days) {
  const updated = MargDrishtiStore.simulateMonitoringProgress(complaintId, days);
  if (updated) {
    showToast('Fast-Forward Simulation', `${complaintId}: Advanced by +${days} days (Now Day ${updated.monitoring?.daysCompleted || 0}/${updated.monitoring?.daysTotal || 60}).`);
  }
};

window.simulateSensor = function(complaintId, isAbnormal) {
  const updated = MargDrishtiStore.simulateSensorObservation(complaintId, isAbnormal);
  if (updated) {
    if (isAbnormal) {
      showToast('Abnormal Vibration Flagged', `${complaintId}: High amplitude shock recorded (|A|: 18.7 m/s²). Deterioration alert active.`);
    } else {
      showToast('Normal Sensor Evidence Logged', `${complaintId}: Smooth ride vibration confirmed (|A|: 9.81 m/s²). Patch stable.`);
    }
  }
};

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
    <i data-lucide="check-circle-2" style="width: 18px; height: 18px; color: var(--emerald-glow);"></i>
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

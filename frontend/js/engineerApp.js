/**
 * MargDrishti — Field Engineer Task & Repair Workspace Controller
 * Connected workflow for acknowledging assignments, starting road repairs,
 * updating real progress milestones (including the 90% notice), and submitting
 * verified completion evidence for municipal post-repair monitoring.
 */

import { AuthService } from './auth.js';
import {
  fetchEngineerTasksApi,
  acknowledgeEngineerTaskApi,
  startEngineerRepairApi,
  updateEngineerProgressApi,
  submitEngineerCompletionApi
} from './api.js';
import { NotificationUI } from './notifications.js';
import { SAMPLE_ROAD_IMAGES } from './mockData.js';

let activeSession = null;
let engineerId = 'ENG-0001';
let engineerNotifications = null;
let currentTasks = [];
let activeFilter = 'ALL';
let activeEvidenceMap = null;
let selectedTask = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce Engineer Route Protection
  activeSession = AuthService.requireAuth('engineer', 'index.html?login=engineer');
  if (!activeSession) return;

  engineerId = activeSession?.user?.engineerId || activeSession?.user?.id || 'ENG-0001';

  initProfile();

  // Initialize Connected In-App Notifications
  engineerNotifications = new NotificationUI({
    containerId: 'engineerNotificationBellContainer',
    recipientId: engineerId,
    onSelectComplaint: (cid) => focusTask(cid)
  });

  if (window.lucide) window.lucide.createIcons();

  initFilterTabs();
  initModals();
  await loadTasks();

  const refreshBtn = document.getElementById('btnRefreshTasks');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      await loadTasks();
      refreshBtn.disabled = false;
      showToast('Tasks Refreshed', 'Latest assigned work orders synchronized.');
    });
  }

  // Cross-dashboard event listener
  window.addEventListener('margdrishti:updated', () => {
    loadTasks();
  });
});

function initProfile() {
  const user = activeSession?.user || {};
  const nameEl = document.getElementById('engineerDisplayName');
  const idEl = document.getElementById('engineerDisplayId');
  const dotEl = document.getElementById('engineerAvatarDot');

  if (nameEl) nameEl.textContent = user.name || 'Rajesh Kumar';
  if (idEl) idEl.textContent = engineerId;
  if (dotEl) dotEl.textContent = (user.name || 'R').charAt(0).toUpperCase();
}

window.engineerLogout = function() {
  AuthService.logout();
};

/* ================= 1. Load & Render Tasks ================= */

async function loadTasks() {
  const loadingEl = document.getElementById('engineerTasksLoadingState');
  const emptyEl = document.getElementById('engineerTasksEmptyState');
  const containerEl = document.getElementById('engineerTasksContainer');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    const res = await fetchEngineerTasksApi(engineerId);
    currentTasks = res?.tasks || [];
    updateKPIs(currentTasks);
    renderTasks();
  } catch (err) {
    console.error('[Engineer Workspace] Error loading tasks:', err);
    showToast('Sync Error', 'Failed to fetch assigned tasks from database.');
    if (containerEl) {
      containerEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #b91c1c; text-align: center;">
          Failed to load assigned tasks: ${err.message}. Please verify backend server status.
        </div>
      `;
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (window.lucide) window.lucide.createIcons();
  }
}

function updateKPIs(tasks) {
  const totalEl = document.getElementById('kpiTotalTasks');
  const pendingEl = document.getElementById('kpiPendingAck');
  const inProgEl = document.getElementById('kpiInProgress');
  const compEl = document.getElementById('kpiCompleted');

  const total = tasks.length;
  const pending = tasks.filter(t => t.status === 'ASSIGNED' && (!t.acknowledged_at && t.assignment_status !== 'ACKNOWLEDGED')).length;
  const inProg = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const comp = tasks.filter(t => ['REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'RESOLVED'].includes(t.status)).length;

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (inProgEl) inProgEl.textContent = inProg;
  if (compEl) compEl.textContent = comp;
}

function initFilterTabs() {
  const tabs = document.querySelectorAll('#engineerFilterTabs button');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'ALL';
      renderTasks();
    });
  });
}

function renderTasks() {
  const container = document.getElementById('engineerTasksContainer');
  const emptyEl = document.getElementById('engineerTasksEmptyState');
  if (!container) return;

  const filtered = currentTasks.filter(t => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING_ACK') {
      return t.status === 'ASSIGNED' && (!t.acknowledged_at && t.assignment_status !== 'ACKNOWLEDGED');
    }
    if (activeFilter === 'IN_PROGRESS') {
      return t.status === 'IN_PROGRESS';
    }
    if (activeFilter === 'COMPLETED') {
      return ['REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'RESOLVED'].includes(t.status);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  container.innerHTML = filtered.map(t => createTaskCardHtml(t)).join('');
  bindTaskCardActions();
  if (window.lucide) window.lucide.createIcons();
}

function createTaskCardHtml(t) {
  const isAcknowledged = !!t.acknowledged_at || t.assignment_status === 'ACKNOWLEDGED';
  const isAssigned = t.status === 'ASSIGNED';
  const isInProgress = t.status === 'IN_PROGRESS';
  const isCompleted = ['REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'RESOLVED'].includes(t.status);

  // Status badge styling
  let statusBadgeClass = 'badge-status-assigned';
  let statusText = 'Assigned';
  if (isInProgress) {
    statusBadgeClass = 'badge-status-in-progress';
    statusText = 'In Progress';
  } else if (t.status === 'REPAIR_COMPLETED') {
    statusBadgeClass = 'badge-status-monitoring';
    statusText = 'Under Monitoring (90%)';
  } else if (t.status === 'RESOLVED') {
    statusBadgeClass = 'badge-status-resolved';
    statusText = '100% Fully Resolved';
  }

  // Priority score
  const prioScore = t.priority_score ? Number(t.priority_score) : 75;
  const prioLevel = prioScore >= 80 ? 'CRITICAL' : prioScore >= 60 ? 'HIGH' : prioScore >= 40 ? 'MEDIUM' : 'LOW';
  const prioBadgeClass = prioScore >= 80 ? 'badge-priority-critical' : prioScore >= 60 ? 'badge-priority-high' : 'badge-priority-medium';

  // Progress
  const progressPct = t.progress_pct != null ? t.progress_pct : (isCompleted ? 100 : isInProgress ? 50 : 0);

  // SLA date formatting
  const slaText = t.expected_completion_date
    ? new Date(t.expected_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not Specified';

  const assignedAtText = t.assigned_at
    ? new Date(t.assigned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Recent';

  const imageThumb = t.image_path || SAMPLE_ROAD_IMAGES.pothole_severe;

  return `
    <div class="task-card" id="task-${t.complaint_id}" data-id="${t.complaint_id}">
      
      <!-- Top Row: ID, Badges, SLA -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="font-mono font-bold" style="font-size: 1.05rem; color: var(--cyan-dark);">${t.complaint_id}</span>
          <span class="badge ${statusBadgeClass}">${statusText}</span>
          ${isAcknowledged ? '<span class="badge" style="background: #ecfdf5; color: #047857; font-size: 0.65rem;">✓ Acknowledged</span>' : '<span class="badge" style="background: #fffbeb; color: #b45309; font-size: 0.65rem;">⏳ Pending Ack</span>'}
        </div>
        <span class="badge font-mono ${prioBadgeClass}">${prioScore}/100 ${prioLevel}</span>
      </div>

      <!-- Location & Road Meta -->
      <div style="font-size: 0.82rem; color: var(--text-primary); line-height: 1.4;">
        <div style="font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
          <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--cyan-dark); flex-shrink: 0;"></i>
          <span>${t.address || t.city || 'Municipal Arterial Corridor'}</span>
        </div>
        <div style="display: flex; gap: 12px; color: var(--text-muted); font-size: 0.75rem; margin-left: 18px;">
          <span>Coords: <strong class="font-mono">${Number(t.latitude || 16.705).toFixed(4)}, ${Number(t.longitude || 74.243).toFixed(4)}</strong></span>
          <button type="button" class="btn-link btn-view-evidence" data-id="${t.complaint_id}" style="font-size: 0.72rem; color: var(--cyan-dark); text-decoration: underline; background: none; border: none; cursor: pointer;">
            View Map & Evidence
          </button>
        </div>
      </div>

      <!-- Defect Details & Evidence Snapshot -->
      <div style="display: grid; grid-template-columns: 80px 1fr; gap: 0.85rem; align-items: center; background: var(--bg-subtle); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-light);">
        <div style="width: 80px; height: 60px; border-radius: 6px; overflow: hidden; background: #0f172a; flex-shrink: 0;">
          <img src="${imageThumb}" alt="Defect Snapshot" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="font-size: 0.78rem;">
          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
            ${(t.damage_type || 'POTHOLE').replace(/_/g, ' ')} &bull; 
            <span style="color: ${t.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}; font-weight: 700;">${t.severity || 'HIGH'}</span>
            ${t.ai_confidence ? `<span style="color: var(--text-muted); font-size: 0.7rem;">(${Math.round(Number(t.ai_confidence) > 1 ? Number(t.ai_confidence) : Number(t.ai_confidence) * 100)}% Conf)</span>` : ''}
          </div>
          <div style="color: var(--text-secondary); font-size: 0.72rem; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            Citizen: "${t.description || 'Road surface failure reported via MargDrishti citizen portal.'}"
          </div>
        </div>
      </div>

      <!-- Assignment Authority & SLA SLA Context -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.75rem; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 6px; border: 1px solid var(--border-light);">
        <div>
          <span style="color: var(--text-muted);">Assigned At:</span>
          <div style="font-weight: 600;">${assignedAtText}</div>
        </div>
        <div>
          <span style="color: var(--text-muted);">Target SLA Completion:</span>
          <div style="font-weight: 700; color: #0369a1;">${slaText}</div>
        </div>
        ${t.assignment_remarks ? `
          <div style="grid-column: 1 / -1; margin-top: 2px; color: #475569; font-size: 0.72rem; border-top: 1px dashed var(--border-light); padding-top: 4px;">
            <strong>Authority Instructions:</strong> ${t.assignment_remarks}
          </div>
        ` : ''}
      </div>

      <!-- Repair Progress Bar -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 4px;">
          <span style="font-weight: 600; color: var(--text-secondary);">Repair Progress Milestone:</span>
          <span class="font-mono font-bold" style="color: ${progressPct >= 90 ? '#059669' : '#0284c7'};">${progressPct}%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${progressPct}%;"></div>
        </div>
        ${t.repair_notes ? `
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">
            Latest Note: ${t.repair_notes}
          </div>
        ` : ''}
      </div>

      <!-- Action Buttons Row -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
        
        ${!isAcknowledged ? `
          <button type="button" class="btn btn-primary btn-sm btn-action-ack" data-id="${t.complaint_id}" style="flex: 1;">
            <i data-lucide="check"></i>
            <span>Acknowledge Work Order</span>
          </button>
        ` : ''}

        ${isAcknowledged && isAssigned ? `
          <button type="button" class="btn btn-primary btn-sm btn-action-start" data-id="${t.complaint_id}" style="flex: 1; background: #0284c7; border-color: #0284c7;">
            <i data-lucide="play"></i>
            <span>Start Repair Work</span>
          </button>
        ` : ''}

        ${isInProgress ? `
          <button type="button" class="btn btn-secondary btn-sm btn-action-progress" data-id="${t.complaint_id}">
            <i data-lucide="trending-up"></i>
            <span>Update Progress</span>
          </button>
          <button type="button" class="btn btn-emerald btn-sm btn-action-submit-comp" data-id="${t.complaint_id}" style="flex: 1;">
            <i data-lucide="camera"></i>
            <span>Submit Completion Evidence</span>
          </button>
        ` : ''}

        ${t.status === 'REPAIR_COMPLETED' ? `
          <div style="display: flex; align-items: center; gap: 6px; width: 100%; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.75rem; color: #047857;">
            <i data-lucide="clock" style="width: 15px; height: 15px; color: #059669; flex-shrink: 0;"></i>
            <span>Repair Evidence Submitted &bull; Mandatory 60-day durability observation active. Awaiting municipal authority resolution.</span>
          </div>
        ` : ''}

        ${t.status === 'RESOLVED' ? `
          <div style="display: flex; align-items: center; gap: 6px; width: 100%; background: #f0fdf4; border: 1px solid #86efac; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.75rem; color: #15803d; font-weight: 600;">
            <i data-lucide="check-circle-2" style="width: 15px; height: 15px; color: #16a34a; flex-shrink: 0;"></i>
            <span>Work Verified & 100% Resolved by Authority Official.</span>
          </div>
        ` : ''}

      </div>

    </div>
  `;
}

function bindTaskCardActions() {
  // Acknowledge Button
  document.querySelectorAll('.btn-action-ack').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i><span>Acknowledging...</span>`;
      if (window.lucide) window.lucide.createIcons();

      try {
        const res = await acknowledgeEngineerTaskApi(id, engineerId);
        showToast('Work Order Acknowledged', `Task ${id} confirmed. Authority notified.`);
        await loadTasks();
      } catch (err) {
        showToast('Acknowledgment Failed', err.message);
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check"></i><span>Acknowledge Work Order</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  });

  // Start Repair Button
  document.querySelectorAll('.btn-action-start').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i><span>Mobilizing...</span>`;
      if (window.lucide) window.lucide.createIcons();

      try {
        await startEngineerRepairApi(id, engineerId, `Field repair crew deployed on site by Engineer ${activeSession?.user?.name || 'Rajesh Kumar'}.`);
        showToast('Repair Started', `Complaint ${id} is now In Progress. Citizen and Authority notified.`);
        await loadTasks();
      } catch (err) {
        showToast('Start Repair Failed', err.message);
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="play"></i><span>Start Repair Work</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  });

  // Update Progress Button
  document.querySelectorAll('.btn-action-progress').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const task = currentTasks.find(t => t.complaint_id === id);
      if (task) openProgressModal(task);
    });
  });

  // Submit Completion Evidence Button
  document.querySelectorAll('.btn-action-submit-comp').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const task = currentTasks.find(t => t.complaint_id === id);
      if (task) openCompletionModal(task);
    });
  });

  // View Evidence Button
  document.querySelectorAll('.btn-view-evidence').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const task = currentTasks.find(t => t.complaint_id === id);
      if (task) openEvidenceModal(task);
    });
  });
}

function focusTask(complaintId) {
  const el = document.getElementById(`task-${complaintId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--cyan-dark)';
    el.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.4)';
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 2500);
  }
}

/* ================= 2. Progress Modal ================= */

function initModals() {
  const progForm = document.getElementById('updateProgressForm');
  const progRange = document.getElementById('progRangeInput');
  const progVal = document.getElementById('progSliderValue');
  const prog90Notice = document.getElementById('prog90Notice');

  if (progRange && progVal) {
    progRange.addEventListener('input', () => {
      const val = parseInt(progRange.value, 10);
      progVal.textContent = `${val}%`;
      if (prog90Notice) {
        prog90Notice.classList.toggle('hidden', val !== 90);
      }
    });
  }

  if (progForm) {
    progForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedTask) return;

      const submitBtn = document.getElementById('btnSubmitProgress');
      const errorBox = document.getElementById('progErrorBox');
      const val = parseInt(progRange?.value || 50, 10);
      const notes = document.getElementById('progNotesInput')?.value?.trim() || '';

      if (submitBtn) submitBtn.disabled = true;
      if (errorBox) errorBox.classList.add('hidden');

      try {
        await updateEngineerProgressApi(selectedTask.complaint_id, engineerId, val, notes);
        showToast('Progress Updated', `Complaint ${selectedTask.complaint_id} updated to ${val}%.`);
        window.closeProgressModal();
        await loadTasks();
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Failed to update progress.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const compForm = document.getElementById('submitCompletionForm');
  if (compForm) {
    compForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedTask) return;

      const submitBtn = document.getElementById('btnSubmitCompletion');
      const errorBox = document.getElementById('compErrorBox');
      const imgUrl = document.getElementById('compImageUrlInput')?.value?.trim();
      const materials = document.getElementById('compMaterialsInput')?.value?.trim();
      const notes = document.getElementById('compNotesInput')?.value?.trim();

      if (submitBtn) submitBtn.disabled = true;
      if (errorBox) errorBox.classList.add('hidden');

      try {
        await submitEngineerCompletionApi(selectedTask.complaint_id, engineerId, {
          imageUrl: imgUrl || SAMPLE_ROAD_IMAGES.repaired_road,
          materials_used: materials,
          notes: notes,
          monitoring_days: 60
        });

        showToast('Repair Completed', `Evidence submitted for ${selectedTask.complaint_id}. Entered 60-day monitoring. Authority notified.`);
        window.closeCompletionModal();
        await loadTasks();
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Failed to submit repair evidence.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

function openProgressModal(task) {
  selectedTask = task;
  const modal = document.getElementById('updateProgressModal');
  const idEl = document.getElementById('progModalComplaintId');
  const locEl = document.getElementById('progModalLocation');
  const dmgEl = document.getElementById('progModalDamage');
  const rangeInput = document.getElementById('progRangeInput');
  const sliderVal = document.getElementById('progSliderValue');
  const notesInput = document.getElementById('progNotesInput');
  const notice90 = document.getElementById('prog90Notice');
  const errorBox = document.getElementById('progErrorBox');

  if (idEl) idEl.textContent = task.complaint_id;
  if (locEl) locEl.textContent = task.address || task.city || 'Municipal Corridor';
  if (dmgEl) dmgEl.textContent = task.damage_type || 'POTHOLE';

  const curPct = task.progress_pct || 50;
  if (rangeInput) rangeInput.value = curPct;
  if (sliderVal) sliderVal.textContent = `${curPct}%`;
  if (notesInput) notesInput.value = task.repair_notes || '';
  if (notice90) notice90.classList.toggle('hidden', curPct !== 90);
  if (errorBox) errorBox.classList.add('hidden');

  if (modal) modal.classList.add('active');
  if (window.lucide) window.lucide.createIcons();
}

window.closeProgressModal = function() {
  const modal = document.getElementById('updateProgressModal');
  if (modal) modal.classList.remove('active');
  selectedTask = null;
};

window.setProgressPreset = function(pct, note) {
  const rangeInput = document.getElementById('progRangeInput');
  const sliderVal = document.getElementById('progSliderValue');
  const notesInput = document.getElementById('progNotesInput');
  const notice90 = document.getElementById('prog90Notice');

  if (rangeInput) rangeInput.value = pct;
  if (sliderVal) sliderVal.textContent = `${pct}%`;
  if (notesInput) notesInput.value = note;
  if (notice90) notice90.classList.toggle('hidden', pct !== 90);
};

/* ================= 3. Completion Modal ================= */

function openCompletionModal(task) {
  selectedTask = task;
  const modal = document.getElementById('submitCompletionModal');
  const idEl = document.getElementById('compModalComplaintId');
  const locEl = document.getElementById('compModalLocation');
  const dmgEl = document.getElementById('compModalDamage');
  const prioEl = document.getElementById('compModalPriority');
  const beforeImg = document.getElementById('compBeforeImg');
  const afterPreview = document.getElementById('compAfterPreview');
  const imgInput = document.getElementById('compImageUrlInput');
  const errorBox = document.getElementById('compErrorBox');

  if (idEl) idEl.textContent = task.complaint_id;
  if (locEl) locEl.textContent = task.address || task.city || 'Municipal Corridor';
  if (dmgEl) dmgEl.textContent = task.damage_type || 'POTHOLE';
  if (prioEl) prioEl.textContent = `${task.priority_score || 75}/100`;

  if (beforeImg) beforeImg.src = task.image_path || SAMPLE_ROAD_IMAGES.pothole_severe;
  if (imgInput) imgInput.value = SAMPLE_ROAD_IMAGES.repaired_road;
  if (afterPreview) afterPreview.src = SAMPLE_ROAD_IMAGES.repaired_road;
  if (errorBox) errorBox.classList.add('hidden');

  if (modal) modal.classList.add('active');
  if (window.lucide) window.lucide.createIcons();
}

window.closeCompletionModal = function() {
  const modal = document.getElementById('submitCompletionModal');
  if (modal) modal.classList.remove('active');
  selectedTask = null;
};

window.useSampleRepairPhoto = function() {
  const imgInput = document.getElementById('compImageUrlInput');
  const afterPreview = document.getElementById('compAfterPreview');
  if (imgInput) imgInput.value = SAMPLE_ROAD_IMAGES.repaired_road;
  if (afterPreview) afterPreview.src = SAMPLE_ROAD_IMAGES.repaired_road;
};

/* ================= 4. Evidence / Map Modal ================= */

function openEvidenceModal(task) {
  const modal = document.getElementById('viewEvidenceModal');
  const title = document.getElementById('evidenceModalTitle');
  const badge = document.getElementById('evidenceModalBadge');
  const img = document.getElementById('evidenceModalImage');
  const road = document.getElementById('evidenceModalRoad');
  const coords = document.getElementById('evidenceModalCoords');

  const prioScore = task.priority_score ? Number(task.priority_score) : 75;
  const prioLevel = prioScore >= 80 ? 'CRITICAL' : prioScore >= 60 ? 'HIGH' : 'MEDIUM';

  if (title) title.textContent = `${task.complaint_id} — AI Vision Evidence`;
  if (badge) {
    badge.textContent = `${prioScore}/100 ${prioLevel}`;
    badge.className = `badge ${prioScore >= 80 ? 'badge-priority-critical' : 'badge-priority-high'}`;
  }
  if (img) img.src = task.image_path || SAMPLE_ROAD_IMAGES.pothole_severe;
  if (road) road.textContent = task.address || task.city || 'Indiranagar Corridor';

  const lat = Number(task.latitude) || 16.705;
  const lng = Number(task.longitude) || 74.243;
  if (coords) coords.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  if (modal) modal.classList.add('active');

  setTimeout(() => {
    initEvidenceLeafletMap(lat, lng, task.complaint_id);
  }, 150);
}

window.closeEvidenceModal = function() {
  const modal = document.getElementById('viewEvidenceModal');
  if (modal) modal.classList.remove('active');
};

function initEvidenceLeafletMap(lat, lng, label) {
  const mapContainer = document.getElementById('evidenceLeafletMap');
  if (!mapContainer || typeof L === 'undefined') return;

  if (activeEvidenceMap) {
    activeEvidenceMap.remove();
    activeEvidenceMap = null;
  }

  activeEvidenceMap = L.map(mapContainer, {
    center: [lat, lng],
    zoom: 16,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(activeEvidenceMap);

  L.marker([lat, lng])
    .addTo(activeEvidenceMap)
    .bindPopup(`<strong>${label}</strong><br/>Damage Location`)
    .openPopup();
}

function showToast(title, message) {
  const container = document.querySelector('.toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div style="font-weight: 700; font-size: 0.82rem; margin-bottom: 2px;">${title}</div>
    <div style="font-size: 0.75rem; color: var(--text-secondary);">${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

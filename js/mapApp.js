/**
 * MargDrishti — Pothole Map & Pothole-Aware Route Planner Controller
 * Full GIS integration using Leaflet + OpenStreetMap.
 * Connects directly with shared MargDrishtiStore and RouteService.
 */

import { MargDrishtiStore } from './store.js';
import { RouteService, DEMO_PRESET_ROUTES } from './routeService.js';
import { AuthService } from './auth.js';

let mapInstance = null;
let markersLayerGroup = null;
let routesLayerGroup = null;
let activeTab = 'explore'; // 'explore' | 'route'
let activeFilter = 'ALL';
let currentActiveRouteKey = 'safest';
let currentCalculatedRoutes = null;
let currentPresetKey = 'indiranagar_to_koramangala';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  initMapProfile();
  initLeafletMap();
  initSidebarTabs();
  initFilters();
  initRoutePlanner();

  // Listen for shared store changes (e.g. if authority resolves or citizen submits)
  window.addEventListener('margdrishti:updated', () => {
    refreshMapData();
    if (activeTab === 'route' && currentPresetKey) {
      calculateAndRenderRoutes(currentPresetKey);
    }
  });

  // Demo reset button
  const resetBtn = document.querySelector('.demo-btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      MargDrishtiStore.resetDatabase();
      alert('MargDrishti demo database reset.');
      window.location.reload();
    });
  }
});

/* ================= 1. Profile & Header ================= */
function initMapProfile() {
  const container = document.getElementById('mapProfileContainer');
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
        <a href="${targetUrl}" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;">
          <span>${isAuthority ? 'Authority View' : 'Citizen View'}</span>
        </a>
        <button type="button" class="btn-logout" onclick="window.mapLogout()">
          <i data-lucide="log-out" style="width: 12px; height: 12px;"></i>
          <span>Logout</span>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <a href="index.html?login=citizen" class="btn btn-secondary btn-sm">
        <i data-lucide="log-in" style="width: 13px; height: 13px;"></i>
        <span>Login</span>
      </a>
      <a href="index.html?signup=citizen" class="btn btn-primary btn-sm">
        <i data-lucide="user-plus" style="width: 13px; height: 13px;"></i>
        <span>Sign Up</span>
      </a>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
}

window.mapLogout = function() {
  AuthService.logout();
};

/* ================= 2. Leaflet Map Initialization ================= */
function initLeafletMap() {
  const mapEl = document.getElementById('mainGisMap');
  if (!mapEl) return;

  // Center on Central/East Bengaluru corridor (Indiranagar / Koramangala / MG Road)
  mapInstance = L.map('mainGisMap', {
    zoomControl: true
  }).setView([12.9560, 77.6350], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | MargDrishti AI',
    maxZoom: 19
  }).addTo(mapInstance);

  markersLayerGroup = L.layerGroup().addTo(mapInstance);
  routesLayerGroup = L.layerGroup().addTo(mapInstance);

  // Update visible potholes on move
  mapInstance.on('moveend', () => {
    updateVisibleCount();
  });

  renderPotholeMarkers();
}

function refreshMapData() {
  renderPotholeMarkers();
  updateExploreSidebarList();
}

function renderPotholeMarkers() {
  if (!markersLayerGroup) return;
  markersLayerGroup.clearLayers();

  const all = MargDrishtiStore.getAllComplaints();

  all.forEach(complaint => {
    if (!complaint.location || !complaint.location.latitude || !complaint.location.longitude) return;

    // Apply active filter
    if (activeFilter !== 'ALL') {
      if (activeFilter === 'RESOLVED' && complaint.status !== 'RESOLVED') return;
      if (activeFilter === 'ACTIVE' && complaint.status === 'RESOLVED') return;
      if (activeFilter === 'CRITICAL' && complaint.severity !== 'CRITICAL') return;
      if (activeFilter === 'HIGH' && complaint.severity !== 'HIGH') return;
      if (activeFilter === 'MEDIUM' && complaint.severity !== 'MEDIUM') return;
    }

    const isResolved = complaint.status === 'RESOLVED';
    let color = '#f59e0b'; // amber default
    let pulseClass = '';

    if (isResolved) {
      color = '#10b981'; // emerald
    } else if (complaint.severity === 'CRITICAL') {
      color = '#ef4444'; // red
      pulseClass = 'marker-pulse-critical';
    } else if (complaint.severity === 'HIGH') {
      color = '#f97316'; // orange
    } else if (complaint.severity === 'MEDIUM') {
      color = '#eab308'; // yellow
    } else {
      color = '#06b6d4'; // cyan
    }

    const iconHtml = `
      <div class="custom-pothole-pin ${pulseClass}" style="background: ${color};">
        ${isResolved ? '<span style="font-size: 10px; color: #fff;">✓</span>' : '!'}
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: 'pothole-div-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    const marker = L.marker([complaint.location.latitude, complaint.location.longitude], { icon: customIcon });

    const popupHtml = `
      <div class="gis-popup-card">
        <div style="position: relative;">
          <img src="${complaint.mediaUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=400&q=80'}" class="gis-popup-img" alt="Road damage" />
          <span class="badge ${isResolved ? 'badge-status-resolved' : (complaint.severity === 'CRITICAL' ? 'badge-priority-critical' : 'badge-priority-high')}" style="position: absolute; top: 6px; left: 6px; font-size: 10px;">
            ${isResolved ? 'RESOLVED' : `${complaint.damageType} • ${complaint.severity}`}
          </span>
        </div>
        <div style="padding: 10px 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="font-family: monospace; color: #0284c7; font-size: 12px;">${complaint.complaintId}</strong>
            <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Priority: ${complaint.priority?.score || 80}/100</span>
          </div>
          <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 2px;">
            ${complaint.location.roadName}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            ${complaint.location.landmark || complaint.location.ward}
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-primary btn-sm" style="width: 100%; font-size: 11px; padding: 4px;" onclick="window.handleViewComplaint('${complaint.complaintId}')">
              View Complaint →
            </button>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    markersLayerGroup.addLayer(marker);
  });

  updateVisibleCount();
  updateExploreSidebarList();
}

function updateVisibleCount() {
  if (!mapInstance) return;
  const bounds = mapInstance.getBounds();
  const all = MargDrishtiStore.getAllComplaints();
  
  let visibleActive = 0;
  all.forEach(c => {
    if (!c.location || !c.location.latitude || !c.location.longitude) return;
    const latLng = L.latLng(c.location.latitude, c.location.longitude);
    if (bounds.contains(latLng) && c.status !== 'RESOLVED') {
      visibleActive++;
    }
  });

  const badgeEl = document.getElementById('visiblePotholesBadge');
  if (badgeEl) {
    badgeEl.textContent = `${visibleActive} active hazards detected in visible area`;
  }
}

/* ================= 3. Explore Sidebar & Filters ================= */
function initSidebarTabs() {
  const tabExplore = document.getElementById('tabBtnExplore');
  const tabRoute = document.getElementById('tabBtnRoute');
  const panelExplore = document.getElementById('sidebarExplorePanel');
  const panelRoute = document.getElementById('sidebarRoutePanel');

  if (tabExplore && tabRoute) {
    tabExplore.addEventListener('click', () => {
      activeTab = 'explore';
      tabExplore.classList.add('active');
      tabRoute.classList.remove('active');
      if (panelExplore) panelExplore.style.display = 'block';
      if (panelRoute) panelRoute.style.display = 'none';

      // Clear route lines when in explore mode
      if (routesLayerGroup) routesLayerGroup.clearLayers();
    });

    tabRoute.addEventListener('click', () => {
      activeTab = 'route';
      tabRoute.classList.add('active');
      tabExplore.classList.remove('active');
      if (panelExplore) panelExplore.style.display = 'none';
      if (panelRoute) panelRoute.style.display = 'block';

      // Automatically calculate default preset
      calculateAndRenderRoutes(currentPresetKey);
    });
  }
}

function initFilters() {
  const filterBtns = document.querySelectorAll('.map-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderPotholeMarkers();
    });
  });
}

function updateExploreSidebarList() {
  const listContainer = document.getElementById('exploreHazardsList');
  if (!listContainer) return;

  const all = MargDrishtiStore.getAllComplaints();

  // Summary counts
  const totalActive = all.filter(c => c.status !== 'RESOLVED').length;
  const criticalCount = all.filter(c => c.severity === 'CRITICAL' && c.status !== 'RESOLVED').length;
  const resolvedCount = all.filter(c => c.status === 'RESOLVED').length;

  const countActiveEl = document.getElementById('statActiveHazards');
  const countCritEl = document.getElementById('statCriticalHazards');
  const countResEl = document.getElementById('statResolvedHazards');

  if (countActiveEl) countActiveEl.textContent = totalActive;
  if (countCritEl) countCritEl.textContent = criticalCount;
  if (countResEl) countResEl.textContent = resolvedCount;

  // Filter list items
  const filtered = all.filter(c => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'ACTIVE') return c.status !== 'RESOLVED';
    if (activeFilter === 'RESOLVED') return c.status === 'RESOLVED';
    if (activeFilter === 'CRITICAL') return c.severity === 'CRITICAL' && c.status !== 'RESOLVED';
    if (activeFilter === 'HIGH') return c.severity === 'HIGH' && c.status !== 'RESOLVED';
    if (activeFilter === 'MEDIUM') return c.severity === 'MEDIUM' && c.status !== 'RESOLVED';
    return true;
  });

  if (all.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; color: #94a3b8; font-size: 0.85rem;">
        <i data-lucide="map-pin-off" style="width: 36px; height: 36px; margin: 0 auto 0.5rem auto; color: #cbd5e1; display: block;"></i>
        <div style="font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">No reported potholes in this area</div>
        <div style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.4;">
          The municipal map database has zero active reports. As citizens and authorities report or scan road damages, geocoded markers will appear here in real time.
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.85rem;">
        No road hazards match this filter.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(c => {
    const isResolved = c.status === 'RESOLVED';
    return `
      <div class="hazard-summary-item" onclick="window.focusComplaintOnMap('${c.complaintId}')">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-family: var(--font-mono); font-weight: 700; color: #0284c7; font-size: 0.78rem;">${c.complaintId}</span>
          <span class="badge ${isResolved ? 'badge-status-resolved' : (c.severity === 'CRITICAL' ? 'badge-priority-critical' : 'badge-priority-high')}" style="font-size: 0.68rem; padding: 2px 6px;">
            ${isResolved ? 'RESOLVED' : c.severity}
          </span>
        </div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${c.location.roadName}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: var(--text-secondary);">
          <span>Priority: <strong>${c.priority?.score || 80}/100</strong></span>
          <span style="color: #0284c7; font-weight: 600;">Focus On Map →</span>
        </div>
      </div>
    `;
  }).join('');
}

window.focusComplaintOnMap = function(complaintId) {
  const all = MargDrishtiStore.getAllComplaints();
  const target = all.find(c => c.complaintId === complaintId);
  if (target && mapInstance && target.location?.latitude && target.location?.longitude) {
    mapInstance.setView([target.location.latitude, target.location.longitude], 16, { animate: true });
  }
};

window.handleViewComplaint = function(complaintId) {
  const session = AuthService.getCurrentUser();
  if (session && session.role === 'authority') {
    window.location.href = `authority.html?inspect=${complaintId}`;
  } else {
    window.location.href = `citizen.html?track=${complaintId}`;
  }
};

/* ================= 4. Pothole-Aware Route Planner ================= */
function initRoutePlanner() {
  // Preset buttons
  const presetContainer = document.getElementById('routePresetsContainer');
  if (presetContainer) {
    presetContainer.innerHTML = DEMO_PRESET_ROUTES.map((p, idx) => `
      <button type="button" class="btn btn-secondary btn-sm preset-route-btn ${idx === 0 ? 'active' : ''}" data-key="${p.id}" style="font-size: 0.75rem; text-align: left; padding: 0.4rem 0.65rem;">
        <span style="font-weight: 700;">⚡ ${p.name}</span>
      </button>
    `).join('');

    const presetBtns = presetContainer.querySelectorAll('.preset-route-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPresetKey = btn.dataset.key;
        
        const preset = DEMO_PRESET_ROUTES.find(r => r.id === currentPresetKey);
        if (preset) {
          const srcInput = document.getElementById('inputRouteSource');
          const dstInput = document.getElementById('inputRouteDest');
          if (srcInput) srcInput.value = preset.source;
          if (dstInput) dstInput.value = preset.destination;
        }

        calculateAndRenderRoutes(currentPresetKey);
      });
    });
  }

  // Calculate Button
  const btnCalculate = document.getElementById('btnCalculateRoute');
  if (btnCalculate) {
    btnCalculate.addEventListener('click', () => {
      calculateAndRenderRoutes(currentPresetKey);
    });
  }

  // Route option tab buttons (Safest, Fastest, Balanced)
  const modeBtns = document.querySelectorAll('.route-mode-pill');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectRouteOption(btn.dataset.mode);
    });
  });
}

function calculateAndRenderRoutes(presetKey) {
  currentCalculatedRoutes = RouteService.calculateRoutes(presetKey);
  renderRouteComparisonCards(currentCalculatedRoutes);
  selectRouteOption(currentActiveRouteKey);
}

function renderRouteComparisonCards(result) {
  const container = document.getElementById('routeComparisonCards');
  if (!container) return;

  const { safest, fastest, balanced } = result.routes;

  container.innerHTML = `
    <!-- SAFEST (RECOMMENDED) -->
    <div class="route-card ${currentActiveRouteKey === 'safest' ? 'active recommended' : ''}" onclick="window.selectRouteOption('safest')">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span class="badge badge-status-resolved" style="font-size: 10px; font-weight: 800; letter-spacing: 0.05em;">
          🟢 ${safest.badge}
        </span>
        <div style="text-align: right;">
          <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #059669;">
            Safety: ${safest.safetyScore}/100
          </span>
          <span style="font-size: 10px; color: var(--text-muted); display: block; font-family: monospace;">Score: ${safest.routeScore}</span>
        </div>
      </div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
        ${safest.title}
      </div>
      <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px;">
        ${safest.distanceKm} km &bull; ${safest.durationMins} mins &bull; <strong>${safest.potholeCount} active potholes</strong> (${safest.criticalCount} critical)
      </div>
      <div class="route-advisory-pill" style="background: #ecfdf5; color: #065f46; border: 1px solid rgba(16, 185, 129, 0.3);">
        ${safest.explanation}
      </div>
    </div>

    <!-- FASTEST -->
    <div class="route-card ${currentActiveRouteKey === 'fastest' ? 'active' : ''}" onclick="window.selectRouteOption('fastest')" style="margin-top: 0.75rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800;">
          🟡 ${fastest.badge}
        </span>
        <div style="text-align: right;">
          <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #b45309;">
            Safety: ${fastest.safetyScore}/100
          </span>
          <span style="font-size: 10px; color: var(--text-muted); display: block; font-family: monospace;">Score: ${fastest.routeScore}</span>
        </div>
      </div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
        ${fastest.title}
      </div>
      <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px;">
        ${fastest.distanceKm} km &bull; ${fastest.durationMins} mins &bull; <strong style="color: ${fastest.potholeCount > 0 ? '#b91c1c' : '#059669'};">${fastest.potholeCount} active potholes</strong> (${fastest.criticalCount} critical)
      </div>
      <div class="route-advisory-pill" style="background: #fffbeb; color: #92400e; border: 1px solid rgba(245, 158, 11, 0.3);">
        ${fastest.explanation}
      </div>
    </div>

    <!-- BALANCED -->
    <div class="route-card ${currentActiveRouteKey === 'balanced' ? 'active' : ''}" onclick="window.selectRouteOption('balanced')" style="margin-top: 0.75rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 800;">
          🔵 ${balanced.badge}
        </span>
        <div style="text-align: right;">
          <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #0284c7;">
            Safety: ${balanced.safetyScore}/100
          </span>
          <span style="font-size: 10px; color: var(--text-muted); display: block; font-family: monospace;">Score: ${balanced.routeScore}</span>
        </div>
      </div>
      <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
        ${balanced.title}
      </div>
      <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 8px;">
        ${balanced.distanceKm} km &bull; ${balanced.durationMins} mins &bull; <strong>${balanced.potholeCount} active potholes</strong> (${balanced.criticalCount} critical)
      </div>
      <div class="route-advisory-pill" style="background: #f0f9ff; color: #0369a1; border: 1px solid rgba(14, 165, 233, 0.3);">
        ${balanced.explanation}
      </div>
    </div>
  `;
}

window.selectRouteOption = function(modeKey) {
  currentActiveRouteKey = modeKey;

  // Highlight selected card
  document.querySelectorAll('.route-card').forEach(card => card.classList.remove('active'));
  const targetCard = document.querySelector(`.route-card[onclick*="${modeKey}"]`);
  if (targetCard) targetCard.classList.add('active');

  // Highlight mode pill
  document.querySelectorAll('.route-mode-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === modeKey);
  });

  if (!currentCalculatedRoutes || !routesLayerGroup || !mapInstance) return;

  routesLayerGroup.clearLayers();

  const selectedRoute = currentCalculatedRoutes.routes[modeKey];
  if (!selectedRoute) return;

  // Draw other routes with subtle opacity
  Object.keys(currentCalculatedRoutes.routes).forEach(key => {
    if (key !== modeKey) {
      const other = currentCalculatedRoutes.routes[key];
      const otherPolyline = L.polyline(other.waypoints, {
        color: '#94a3b8',
        weight: 3.5,
        opacity: 0.45,
        dashArray: '6, 6'
      });
      routesLayerGroup.addLayer(otherPolyline);
    }
  });

  // Draw active chosen route with prominent color
  const activePolyline = L.polyline(selectedRoute.waypoints, {
    color: selectedRoute.color,
    weight: 6,
    opacity: 0.9
  });
  routesLayerGroup.addLayer(activePolyline);

  // Start & End markers
  const startPt = selectedRoute.waypoints[0];
  const endPt = selectedRoute.waypoints[selectedRoute.waypoints.length - 1];

  const startIcon = L.divIcon({
    html: '<div style="background: #0284c7; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">A</div>',
    iconSize: [24, 24]
  });
  const endIcon = L.divIcon({
    html: '<div style="background: #10b981; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">B</div>',
    iconSize: [24, 24]
  });

  routesLayerGroup.addLayer(L.marker(startPt, { icon: startIcon }).bindTooltip('Start Location'));
  routesLayerGroup.addLayer(L.marker(endPt, { icon: endIcon }).bindTooltip('Destination'));

  // Fit map bounds to route
  mapInstance.fitBounds(activePolyline.getBounds(), { padding: [40, 40] });
};

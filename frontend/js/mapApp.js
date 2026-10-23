/**
 * MargDrishti — Pothole Map GIS Controller
 * Full GIS integration using Leaflet + OpenStreetMap.
 * Connects directly with shared MargDrishtiStore.
 */
import { GeoService } from './geoService.js';
import { MargDrishtiStore } from './store.js';
import { AuthService } from './auth.js';

let mapInstance = null;
let markersLayerGroup = null;
let currentLocationMarker = null;
let currentLocationCircle = null;
let activeFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();

  initMapProfile();
  await MargDrishtiStore.fetchFromBackend();
  initLeafletMap();
  initCurrentLocation();
  initFilters();

  // Listen for shared store changes (e.g. if authority resolves or citizen submits)
  window.addEventListener('margdrishti:updated', () => {
    refreshMapData();
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

  // Update visible potholes on move
  mapInstance.on('moveend', () => {
    updateVisibleCount();
  });

  renderPotholeMarkers();
}


/* ================= Current GPS Location ================= */

async function initCurrentLocation() {
  if (!mapInstance) {
    console.error("MargDrishti map is not initialized.");
    return;
  }

  try {
    const location = await GeoService.acquireLocation();

    const lat = Number(location.latitude);
    const lng = Number(location.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.error("Invalid GPS coordinates:", location);
      return;
    }

    // Do not silently present demo coordinates as real GPS.
    if (location.source !== "CURRENT_DEVICE_LOCATION") {
      console.warn(
        "Real GPS was not acquired. Demo location returned:",
        location
      );
      return;
    }

    const position = [lat, lng];

    // Remove the previous GPS marker and accuracy circle.
    if (currentLocationMarker) {
      mapInstance.removeLayer(currentLocationMarker);
    }

    if (currentLocationCircle) {
      mapInstance.removeLayer(currentLocationCircle);
    }

    // Add a clearly identifiable current-location marker.
    currentLocationMarker = L.marker(position, {
      title: "Your Current GPS Location",
      keyboard: true
    }).addTo(mapInstance);

    currentLocationMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px;">
        <strong>Your Current Location</strong><br>
        Latitude: ${lat.toFixed(5)}<br>
        Longitude: ${lng.toFixed(5)}<br>
        Accuracy: ±${Math.round(location.accuracy)} metres
      </div>
    `);

    // Show the estimated GPS accuracy area.
    if (Number.isFinite(location.accuracy) && location.accuracy > 0) {
      currentLocationCircle = L.circle(position, {
        radius: location.accuracy,
        color: "#0284c7",
        fillColor: "#38bdf8",
        fillOpacity: 0.15,
        weight: 2
      }).addTo(mapInstance);
    }

    // Move the map to the user's location.
    mapInstance.setView(position, 16);
    currentLocationMarker.openPopup();

    console.log("GPS marker added successfully:", {
      latitude: lat,
      longitude: lng,
      accuracy: location.accuracy
    });

  } catch (error) {
    console.error("Unable to display current location:", error);
  }
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

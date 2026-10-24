const API_BASE_URL = (() => {
  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }

  return "https://YOUR-BACKEND-DOMAIN/api";
})();

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Attach active authenticated session token if available
  let token = null;
  try {
    const rawAuth = localStorage.getItem("margdrishti_auth");
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth);
      token = parsed?.token;
    }
    if (!token) {
      token = localStorage.getItem("margdrishti_token");
    }
  } catch (_) {}

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned unparseable response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      console.warn("API request rejected with 401 Unauthorized for endpoint:", endpoint);
      // If unauthorized on a protected page, safely redirect to login
      if (typeof window !== "undefined" && !window.location.pathname.endsWith("index.html") && window.location.pathname !== "/" && !window.location.pathname.endsWith("map.html")) {
        localStorage.removeItem("margdrishti_auth");
        localStorage.removeItem("margdrishti_token");
        window.location.replace("index.html?unauthorized=true");
      }
    }
    throw new Error(data.message || data.error || `Request failed with HTTP ${response.status}`);
  }

  return data;
}

export async function loginUser(role, identifier, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ role, identifier, password }),
  });
}

export async function signupUser(userData) {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function fetchComplaints(citizenId = null, status = null) {
  const params = new URLSearchParams();
  if (citizenId) params.append("citizen_id", citizenId);
  if (status) params.append("status", status);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiRequest(`/complaints${q}`);
}

export async function fetchPublicMapHazards() {
  return apiRequest("/complaints/public-map");
}

export async function fetchComplaintById(id) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}`);
}

export async function createComplaint(complaintData) {
  return apiRequest("/complaints", {
    method: "POST",
    body: JSON.stringify(complaintData),
  });
}

export async function verifyComplaintApi(id, changedBy = "AUTHUSER-0001", remarks = "") {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    body: JSON.stringify({ changed_by: changedBy, remarks }),
  });
}

export async function assignComplaintApi(id, assignedTo = "ENG-0001", assignedBy = "AUTHUSER-0001", remarks = "", expectedCompletionDate = null) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/assign`, {
    method: "POST",
    body: JSON.stringify({
      assigned_to: assignedTo,
      assigned_by: assignedBy,
      remarks,
      expected_completion_date: expectedCompletionDate
    }),
  });
}

export async function fetchEngineersApi() {
  return apiRequest("/engineers");
}

export async function fetchNotificationsApi(recipientId) {
  const q = recipientId ? `?recipient_id=${encodeURIComponent(recipientId)}` : "";
  return apiRequest(`/notifications${q}`);
}

export async function markNotificationReadApi(id, recipientId = null) {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: JSON.stringify({ recipient_id: recipientId }),
  });
}

export async function markAllNotificationsReadApi(recipientId) {
  return apiRequest("/notifications/read-all", {
    method: "PATCH",
    body: JSON.stringify({ recipient_id: recipientId }),
  });
}

export async function getUnreadNotificationCountApi(recipientId) {
  const q = recipientId ? `?recipient_id=${encodeURIComponent(recipientId)}` : "";
  return apiRequest(`/notifications/unread-count${q}`);
}

export async function fetchEngineerTasksApi(engineerId = "ENG-0001") {
  const q = engineerId ? `?engineer_id=${encodeURIComponent(engineerId)}` : "";
  return apiRequest(`/engineer/tasks${q}`);
}

export async function acknowledgeEngineerTaskApi(id, engineerId = "ENG-0001") {
  return apiRequest(`/engineer/tasks/${encodeURIComponent(id)}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ engineer_id: engineerId }),
  });
}

export async function startEngineerRepairApi(id, engineerId = "ENG-0001", description = "") {
  return apiRequest(`/engineer/tasks/${encodeURIComponent(id)}/start-repair`, {
    method: "POST",
    body: JSON.stringify({ engineer_id: engineerId, description }),
  });
}

export async function updateEngineerProgressApi(id, engineerId = "ENG-0001", progressPct = 50, notes = "") {
  return apiRequest(`/engineer/tasks/${encodeURIComponent(id)}/update-progress`, {
    method: "POST",
    body: JSON.stringify({ engineer_id: engineerId, progress_pct: progressPct, notes }),
  });
}

export async function submitEngineerCompletionApi(id, engineerId = "ENG-0001", data = {}) {
  return apiRequest(`/engineer/tasks/${encodeURIComponent(id)}/submit-completion`, {
    method: "POST",
    body: JSON.stringify({
      engineer_id: engineerId,
      completion_image_path: data.imageUrl || data.completion_image_path,
      notes: data.notes,
      materials_used: data.materials_used,
      monitoring_days: data.monitoring_days || 60
    }),
  });
}

export async function fastForwardAssignmentApi(id, days = 15) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/fast-forward-assignment`, {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export async function markInProgressApi(id, engineerId = "AUTHUSER-0001", changedBy = "AUTHUSER-0001", description = "") {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/in-progress`, {
    method: "POST",
    body: JSON.stringify({ engineer_id: engineerId, changed_by: changedBy, description }),
  });
}

export async function markRepairCompletedApi(id, engineerId = "AUTHUSER-0001", changedBy = "AUTHUSER-0001", notes = "", monitoringDays = 60) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/repair-completed`, {
    method: "POST",
    body: JSON.stringify({ engineer_id: engineerId, changed_by: changedBy, notes, monitoring_days: monitoringDays }),
  });
}

export async function logSensorObservationApi(id, sensorData = {}) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/sensor`, {
    method: "POST",
    body: JSON.stringify(sensorData),
  });
}

export async function simulateMonitoringApi(id, days = 30) {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/simulate-monitoring`, {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export async function confirmFinalResolutionApi(id, changedBy = "AUTHUSER-0001", notes = "") {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/confirm-final`, {
    method: "POST",
    body: JSON.stringify({ changed_by: changedBy, notes }),
  });
}

export async function requestReinspectionApi(id, changedBy = "AUTHUSER-0001", reason = "") {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/reinspect`, {
    method: "POST",
    body: JSON.stringify({ changed_by: changedBy, reason }),
  });
}

export async function fetchMonitoringListApi() {
  return apiRequest("/monitoring");
}

export async function fetchKPIsApi(citizenId = null) {
  const q = citizenId ? `?citizen_id=${encodeURIComponent(citizenId)}` : "";
  return apiRequest(`/kpis${q}`);
}

// Make available globally if imported via regular script or module
if (typeof window !== "undefined") {
  window.MargDrishtiAPI = {
    apiRequest,
    loginUser,
    signupUser,
    fetchComplaints,
    fetchComplaintById,
    createComplaint,
    verifyComplaintApi,
    assignComplaintApi,
    fetchEngineersApi,
    fetchNotificationsApi,
    markNotificationReadApi,
    markAllNotificationsReadApi,
    getUnreadNotificationCountApi,
    fetchEngineerTasksApi,
    acknowledgeEngineerTaskApi,
    startEngineerRepairApi,
    updateEngineerProgressApi,
    submitEngineerCompletionApi,
    fastForwardAssignmentApi,
    markInProgressApi,
    markRepairCompletedApi,
    logSensorObservationApi,
    simulateMonitoringApi,
    confirmFinalResolutionApi,
    requestReinspectionApi,
    fetchMonitoringListApi,
    fetchKPIsApi,
  };
}
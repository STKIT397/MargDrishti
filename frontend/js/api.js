const API_BASE_URL = "http://localhost:5000/api";

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned unparseable response (HTTP ${response.status})`);
  }

  if (!response.ok) {
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

export async function assignComplaintApi(id, assignedTo = "AUTHUSER-0001", assignedBy = "AUTHUSER-0001", remarks = "") {
  return apiRequest(`/complaints/${encodeURIComponent(id)}/assign`, {
    method: "POST",
    body: JSON.stringify({ assigned_to: assignedTo, assigned_by: assignedBy, remarks }),
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
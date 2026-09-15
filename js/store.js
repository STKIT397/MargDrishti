/**
 * MargDrishti — Shared Data Store & Lifecycle State Manager
 * Ensures 100% synchronous state persistence between Citizen and Authority Dashboards.
 */

import { INITIAL_SEED_COMPLAINTS } from './mockData.js';

const STORAGE_KEY = 'margdrishti_complaints_v3';
const MONITORING_CONFIG_KEY = 'margdrishti_monitoring_days';
export const POST_REPAIR_MONITORING_DAYS = 60;

class MargDrishtiStoreManager {
  constructor() {
    this.init();
    // Listen for cross-tab storage changes
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === MONITORING_CONFIG_KEY) {
        this.dispatchChangeEvent();
      }
    });
  }

  init() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      this.resetDatabase();
    }
  }

  getMonitoringDays() {
    try {
      const stored = localStorage.getItem(MONITORING_CONFIG_KEY);
      return stored ? parseInt(stored, 10) : POST_REPAIR_MONITORING_DAYS;
    } catch {
      return POST_REPAIR_MONITORING_DAYS;
    }
  }

  setMonitoringDays(days) {
    const validDays = Math.max(1, parseInt(days, 10) || POST_REPAIR_MONITORING_DAYS);
    localStorage.setItem(MONITORING_CONFIG_KEY, String(validDays));
    this.dispatchChangeEvent();
    return validDays;
  }

  getAllComplaints() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      // Default sort: Priority Score Descending
      return list.sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0));
    } catch (e) {
      console.error('Failed to parse complaints from storage', e);
      return [...INITIAL_SEED_COMPLAINTS];
    }
  }

  getComplaintById(id) {
    if (!id) return null;
    const all = this.getAllComplaints();
    return all.find(c => c.complaintId.toUpperCase() === id.toUpperCase().trim()) || null;
  }

  getNextComplaintId() {
    const all = this.getAllComplaints();
    let maxNum = 0;
    all.forEach(c => {
      const match = c.complaintId.match(/MD-2026-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `MD-2026-${String(nextNum).padStart(6, '0')}`;
  }

  saveAllComplaints(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    this.dispatchChangeEvent();
  }

  addComplaint(data) {
    const all = this.getAllComplaints();
    const complaintId = data.complaintId || this.getNextComplaintId();

    const newRecord = {
      complaintId,
      citizenId: data.citizenId || 'CIT-2026-000001',
      citizenName: data.citizenName || 'Verified Citizen',
      citizenPhone: data.citizenPhone || '+91 98860 11223',
      description: data.description || 'Road damage reported via MargDrishti mobile portal.',
      mediaType: data.mediaType || 'image',
      mediaUrl: data.mediaUrl,
      videoDetails: data.videoDetails || null,
      damageType: data.damageType || 'POTHOLE',
      severity: data.severity || 'HIGH',
      confidence: data.confidence || 0.91,
      detections: data.detections || [],
      priority: data.priority || {
        score: 84,
        level: 'HIGH',
        breakdown: { damageSeverity: 24, damageExtent: 16, roadImportance: 18, trafficExposure: 8, sensitiveLocation: 10, corroboratingEvidence: 8 },
        rationale: 'Evaluated according to MargDrishti explainable priority formula.'
      },
      location: data.location || {
        latitude: 12.9784,
        longitude: 77.6408,
        roadName: '100 Feet Road, Indiranagar',
        ward: 'Ward 80 - Hoysala Nagar',
        landmark: 'Opposite Metro Pillar 84',
        city: 'Bengaluru',
        source: 'CURRENT_DEVICE_LOCATION'
      },
      status: 'REPORTED',
      resolution: 0,
      createdAt: new Date().toISOString(),
      assignedOfficer: null,
      assignedAt: null,
      repairEvidence: null,
      monitoring: null,
      sensorTelemetry: data.sensorTelemetry || null,
      timeline: [
        {
          status: 'REPORTED',
          title: 'Reported',
          remarks: 'Citizen uploaded damage evidence with GPS coordinates.',
          timestamp: new Date().toISOString(),
          actor: data.citizenName || 'Citizen'
        },
        {
          status: 'AI_ANALYZED',
          title: 'AI Analyzed',
          remarks: `YOLO11 detected ${data.damageType || 'damage'} with ${Math.round((data.confidence || 0.91) * 100)}% confidence. Priority score: ${data.priority?.score || 84}/100.`,
          timestamp: new Date().toISOString(),
          actor: 'MargDrishti AI Vision'
        }
      ]
    };

    all.unshift(newRecord);
    this.saveAllComplaints(all);
    return newRecord;
  }

  assignOfficer(complaintId, officer, remarks = '') {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const now = new Date();
    item.assignedOfficer = officer;
    item.assignedAt = now.toISOString();
    item.status = 'ASSIGNED';
    item.timeline.push({
      status: 'ASSIGNED',
      title: 'Assigned',
      remarks: remarks || `Work order dispatched to ${officer.name} (${officer.designation}). Minimum 15-day assignment period initiated.`,
      timestamp: now.toISOString(),
      actor: 'Municipal Control Room'
    });

    this.saveAllComplaints(all);
    return item;
  }

  getDaysSinceAssignment(complaint) {
    if (!complaint || !complaint.assignedAt) return 0;
    const assignedTime = new Date(complaint.assignedAt).getTime();
    const now = Date.now();
    const diffMs = now - assignedTime;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  canStartProgress(complaintId) {
    const c = this.getComplaintById(complaintId);
    if (!c) return { allowed: false, reason: 'Complaint record not found.' };
    if (!c.assignedAt) {
      return { allowed: false, reason: 'Work order must be assigned to an engineering officer before starting repair work.' };
    }
    const daysElapsed = this.getDaysSinceAssignment(c);
    if (daysElapsed < 15) {
      return {
        allowed: false,
        daysElapsed,
        daysRemaining: 15 - daysElapsed,
        assignedAt: c.assignedAt,
        reason: 'Repair work can be started only after the minimum 15-day assignment period.'
      };
    }
    return {
      allowed: true,
      daysElapsed,
      assignedAt: c.assignedAt
    };
  }

  fastForwardAssignment(complaintId, days = 15) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;
    const currentAssigned = item.assignedAt ? new Date(item.assignedAt).getTime() : Date.now();
    item.assignedAt = new Date(currentAssigned - days * 24 * 60 * 60 * 1000).toISOString();
    this.saveAllComplaints(all);
    return item;
  }

  verifyComplaint(complaintId, officerName = 'Municipal Control Room') {
    return this.updateStatus(complaintId, 'VERIFIED', 'Authority control room verified damage and confirmed maintenance triage priority.', officerName);
  }

  updateStatus(complaintId, newStatus, remarks = '', actor = 'Authority Control Room') {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    item.status = newStatus;
    
    // Map status key to display title
    const titles = {
      'REPORTED': 'Reported',
      'AI_ANALYZED': 'AI Analyzed',
      'VERIFIED': 'Verified',
      'ASSIGNED': 'Assigned',
      'IN_PROGRESS': 'In Progress',
      'REPAIR_COMPLETED': 'Repair Completed (Under Post-Repair Monitoring)',
      'CONFIRMATION_REQUIRED': 'Authority Confirmation Required',
      'REINSPECTION_REQUIRED': 'Reinspection Required',
      'RESOLVED': 'Fully Resolved'
    };

    item.timeline.push({
      status: newStatus,
      title: titles[newStatus] || newStatus,
      remarks: remarks || `Status updated to ${titles[newStatus] || newStatus}.`,
      timestamp: new Date().toISOString(),
      actor: actor
    });

    this.saveAllComplaints(all);
    return item;
  }

  /**
   * FEATURE 1: Mark Repair Completed — Enters Post-Repair Monitoring (Resolution = 90%)
   * "Repair Completed" must NOT immediately mean "Fully Resolved".
   */
  markRepairCompleted(complaintId, repairData = {}, monitoringDays = null) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const days = Number(monitoringDays) || this.getMonitoringDays() || POST_REPAIR_MONITORING_DAYS;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    item.status = 'REPAIR_COMPLETED';
    item.resolution = 90;

    item.repairEvidence = {
      imageUrl: repairData.imageUrl || 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1000&q=80',
      notes: repairData.notes || 'Repair execution completed on site. Marked for post-repair quality monitoring.',
      completedAt: now.toISOString(),
      resolvedBy: repairData.resolvedBy || 'Rajesh Kumar (Assistant Executive Engineer)'
    };

    item.monitoring = {
      status: 'UNDER_MONITORING', // 'UNDER_MONITORING' | 'CONFIRMATION_REQUIRED' | 'PASSED' | 'FAILED'
      daysTotal: days,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      daysCompleted: 0,
      sensorObservations: repairData.sensorObservations || null,
      deteriorationDetected: false,
      sensorSummary: 'Surface monitoring active. No abnormal motion patterns detected.',
      observations: repairData.notes || `Road surface patched and compacted. Entered mandatory ${days}-day post-repair monitoring period.`
    };

    item.timeline.push({
      status: 'REPAIR_COMPLETED',
      title: 'Repair Completed — Under Monitoring (90%)',
      remarks: `Physical road repair executed on site. Entered mandatory ${days}-day post-repair monitoring period before final resolution (Resolution: 90%).`,
      timestamp: now.toISOString(),
      actor: item.repairEvidence.resolvedBy
    });

    this.saveAllComplaints(all);
    return item;
  }

  simulateSensorObservation(complaintId, isAbnormal = false) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item || !item.monitoring) return null;

    if (isAbnormal) {
      item.monitoring.deteriorationDetected = true;
      item.monitoring.sensorSummary = 'Repeated Abnormal Motion Pattern (Peak |A| > 14.8 m/s²)';
      item.monitoring.observations = 'Repeated abnormal vehicle-motion and impact patterns observed near repaired coordinates across multi-vehicle passes. Possible surface subsidence detected. Authority review required.';
      item.timeline.push({
        status: 'UNDER_MONITORING',
        title: 'Sensor Evidence: Possible Deterioration Detected',
        remarks: 'Smartphone sensor evidence indicates repeated abnormal impact patterns near repaired location. Dispatched for Authority Review.',
        timestamp: new Date().toISOString(),
        actor: 'MargDrishti Post-Repair Monitoring'
      });
    } else {
      item.monitoring.deteriorationDetected = false;
      item.monitoring.sensorSummary = 'Normal Motion Pattern (|A|: 9.8–10.1 m/s²)';
      item.monitoring.observations = 'Road surface intact under 60-day post-repair observation. Zero abnormal jerk or vibration patterns detected.';
    }

    this.saveAllComplaints(all);
    return item;
  }

  /**
   * FEATURE 1: Authority Final Confirmation — Option 1: Confirm Repair (100% Fully Resolved)
   */
  confirmFinalResolution(complaintId, confirmationData = {}) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const now = new Date();
    item.status = 'RESOLVED';
    item.resolution = 100;

    if (!item.monitoring) {
      item.monitoring = {
        status: 'PASSED',
        daysTotal: this.getMonitoringDays(),
        startDate: now.toISOString(),
        endDate: now.toISOString(),
        daysCompleted: this.getMonitoringDays(),
        sensorObservations: null,
        observations: 'Confirmed without extended monitoring.'
      };
    } else {
      item.monitoring.status = 'PASSED';
      item.monitoring.daysCompleted = item.monitoring.daysTotal;
    }

    if (!item.repairEvidence) {
      item.repairEvidence = {
        imageUrl: confirmationData.imageUrl || 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1000&q=80',
        notes: confirmationData.notes || 'Surface integrity verified after post-repair monitoring.',
        resolvedAt: now.toISOString(),
        resolvedBy: confirmationData.confirmedBy || 'Rajesh Kumar (Assistant Executive Engineer)'
      };
    } else {
      item.repairEvidence.resolvedAt = now.toISOString();
      if (confirmationData.confirmedBy) item.repairEvidence.resolvedBy = confirmationData.confirmedBy;
      if (confirmationData.notes) item.repairEvidence.notes += ` | Final Confirmation: ${confirmationData.notes}`;
    }

    item.timeline.push({
      status: 'RESOLVED',
      title: '100% Fully Resolved',
      remarks: confirmationData.notes || 'Repair successfully completed and confirmed by the responsible authority.',
      timestamp: now.toISOString(),
      actor: confirmationData.confirmedBy || item.repairEvidence.resolvedBy || 'Authority Official'
    });

    this.saveAllComplaints(all);
    return item;
  }

  /**
   * FEATURE 1: Authority Final Confirmation — Option 2: Request Reinspection (Damage Reappeared)
   */
  requestReinspection(complaintId, reinspectionData = {}) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const now = new Date();
    item.status = 'REINSPECTION_REQUIRED';
    item.resolution = 50; // Dropped back below 100%

    if (!item.monitoring) {
      item.monitoring = {
        status: 'FAILED',
        daysTotal: this.getMonitoringDays(),
        startDate: now.toISOString(),
        endDate: now.toISOString(),
        daysCompleted: 0,
        sensorObservations: null,
        observations: reinspectionData.reason || 'Road damage re-appeared during monitoring.'
      };
    } else {
      item.monitoring.status = 'FAILED';
      item.monitoring.failureReason = reinspectionData.reason || 'Road damage was observed again during the post-repair monitoring period. Further inspection is required.';
    }

    item.timeline.push({
      status: 'REINSPECTION_REQUIRED',
      title: 'Reinspection Required',
      remarks: reinspectionData.reason || 'Road damage was observed again during the post-repair monitoring period. Further inspection is required.',
      timestamp: now.toISOString(),
      actor: reinspectionData.requestedBy || 'Rajesh Kumar (Assistant Executive Engineer)'
    });

    this.saveAllComplaints(all);
    return item;
  }

  /**
   * FEATURE 1: Simulate monitoring elapsed days for live demo testing & evaluations
   */
  simulateMonitoringProgress(complaintId, daysElapsed) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item || !item.monitoring) return null;

    const added = Number(daysElapsed) || 1;
    item.monitoring.daysCompleted = Math.min(item.monitoring.daysTotal, (item.monitoring.daysCompleted || 0) + added);

    // If reached end of monitoring period, transition to CONFIRMATION_REQUIRED
    if (item.monitoring.daysCompleted >= item.monitoring.daysTotal && item.status === 'REPAIR_COMPLETED') {
      item.status = 'CONFIRMATION_REQUIRED';
      item.monitoring.status = 'CONFIRMATION_REQUIRED';
      item.timeline.push({
        status: 'CONFIRMATION_REQUIRED',
        title: 'Authority Confirmation Required',
        remarks: `Post-repair monitoring period of ${item.monitoring.daysTotal} days completed. Awaiting authority final inspection & confirmation.`,
        timestamp: new Date().toISOString(),
        actor: 'MargDrishti Automated System'
      });
    }

    this.saveAllComplaints(all);
    return item;
  }

  /**
   * FEATURE: Simulate normal vs abnormal smartphone/patrol sensor observations during post-repair monitoring
   * @param {string} complaintId
   * @param {boolean} isAbnormal
   */
  simulateSensorObservation(complaintId, isAbnormal = false) {
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    if (!item.monitoring) {
      item.monitoring = {
        status: 'PENDING',
        daysTotal: this.getMonitoringDays(),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + this.getMonitoringDays() * 86400000).toISOString(),
        daysCompleted: 5,
        observations: 'Under quality monitoring observation.'
      };
    }

    if (isAbnormal) {
      item.monitoring.status = 'ABNORMAL_DETECTED';
      item.monitoring.sensorEvidence = {
        accelerometer: '|A|: 18.7 m/s² (Severe Drop)',
        gyroscope: 'Roll: +14.2°, Pitch: -11.8°',
        flaggedAt: new Date().toISOString(),
        anomalyType: 'Patch Depression / Recurring Void'
      };
      item.monitoring.observations = 'High vibration anomalies detected by passing vehicle sensors. Surface deterioration suspected.';
      item.timeline.push({
        status: 'REINSPECTION_REQUIRED',
        title: 'Sensor Deterioration Detected',
        remarks: 'Repeated abnormal vertical acceleration spikes recorded by smartphone sensor telemetry. Authority review required.',
        timestamp: new Date().toISOString(),
        actor: 'MargDrishti Telemetry Sentinel'
      });
    } else {
      item.monitoring.status = 'NORMAL_OBSERVED';
      item.monitoring.sensorEvidence = {
        accelerometer: '|A|: 9.81 m/s² (Smooth Transit)',
        gyroscope: 'Stable (Roll: <1.5°)',
        recordedAt: new Date().toISOString()
      };
      item.monitoring.observations = 'Normal vehicular vibrations recorded across patch. Road surface intact.';
    }

    this.saveAllComplaints(all);
    return item;
  }

  resolveComplaint(complaintId, repairData) {
    // Backwards compatibility alias routing to confirmFinalResolution
    return this.confirmFinalResolution(complaintId, repairData);
  }

  resetDatabase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_COMPLAINTS));
    this.dispatchChangeEvent();
  }

  dispatchChangeEvent() {
    window.dispatchEvent(new CustomEvent('margdrishti:updated'));
  }
}

export const MargDrishtiStore = new MargDrishtiStoreManager();

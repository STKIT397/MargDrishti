/**
 * MargDrishti — Shared Data Store & Lifecycle State Manager
 * Connects directly to PostgreSQL Express Backend with instantaneous
 * client-side reactivity and synchronization across Citizen and Authority Dashboards.
 */

import { INITIAL_SEED_COMPLAINTS, SAMPLE_ROAD_IMAGES } from './mockData.js';
import { PriorityEngine } from './priorityEngine.js';
import {
  fetchComplaints,
  fetchComplaintById,
  verifyComplaintApi,
  assignComplaintApi,
  fastForwardAssignmentApi,
  markInProgressApi,
  markRepairCompletedApi,
  logSensorObservationApi,
  simulateMonitoringApi,
  confirmFinalResolutionApi,
  requestReinspectionApi
} from './api.js';

const STORAGE_KEY = 'margdrishti_complaints_v3';
const MONITORING_CONFIG_KEY = 'margdrishti_monitoring_days';
export const POST_REPAIR_MONITORING_DAYS = 60;

class MargDrishtiStoreManager {
  constructor() {
    this.inMemoryComplaints = null;
    this.isFetching = false;
    this.init();

    // Listen for cross-tab storage changes
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === MONITORING_CONFIG_KEY) {
        this.inMemoryComplaints = null;
        this.dispatchChangeEvent();
      }
    });

    // Automatically sync with PostgreSQL backend on load
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.fetchFromBackend().catch(err => {
          console.warn('Initial backend sync notice:', err.message);
        });
      }, 50);
    }
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

  /**
   * Syncs with PostgreSQL Express backend and maps records into frontend store
   */
  async fetchFromBackend() {
    if (this.isFetching) return this.getAllComplaints();
    this.isFetching = true;

    try {
      const res = await fetchComplaints();
      if (res && Array.isArray(res.complaints)) {
        const mappedList = res.complaints.map(c => this.mapDbComplaintToStore(c));
        this.inMemoryComplaints = mappedList;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedList));
        this.dispatchChangeEvent();
        return mappedList;
      }
    } catch (err) {
      console.warn('Unable to fetch live complaints from PostgreSQL, using local store:', err.message);
    } finally {
      this.isFetching = false;
    }

    return this.getAllComplaints();
  }

  mapDbComplaintToStore(c) {
    const isVideo = (c.image_path || '').includes('.mp4');
    const prioScore = Math.round(Number(c.priority_score) || 75);
    const confidence = c.ai_confidence != null
      ? (Number(c.ai_confidence) > 1 ? Number(c.ai_confidence) / 100 : Number(c.ai_confidence))
      : 0.92;

    const damageTypeUpper = (c.damage_type || 'POTHOLE').toUpperCase();
    const severityUpper = (c.severity || 'HIGH').toUpperCase();
    const statusUpper = (c.status || 'REPORTED').toUpperCase();

    // Map status to resolution percentage
    let resolution = 0;
    if (statusUpper === 'RESOLVED') resolution = 100;
    else if (statusUpper === 'REPAIR_COMPLETED' || statusUpper === 'CONFIRMATION_REQUIRED') resolution = 90;
    else if (statusUpper === 'IN_PROGRESS') resolution = 50;
    else if (statusUpper === 'ASSIGNED') resolution = 30;
    else if (statusUpper === 'VERIFIED') resolution = 20;
    else if (statusUpper === 'AI_ANALYZED') resolution = 10;

    const sampleImg = damageTypeUpper.includes('CRACK')
      ? SAMPLE_ROAD_IMAGES.cracks_alligator
      : SAMPLE_ROAD_IMAGES.pothole_severe;

    return {
      complaintId: c.complaint_id,
      citizenId: c.citizen_id || 'CIT-0001',
      citizenName: c.citizen_name || 'Aishwarya Patil',
      citizenPhone: c.citizen_phone || '9876543210',
      description: c.description || 'Road damage reported via MargDrishti portal.',
      mediaType: isVideo ? 'video' : 'image',
      mediaUrl: c.image_path || sampleImg,
      videoDetails: isVideo ? {
        duration: '00:14',
        framesAnalyzed: 12,
        framesWithDetections: 4,
        evidenceTimestamp: '00:08'
      } : null,
      damageType: damageTypeUpper,
      severity: severityUpper,
      confidence: confidence,
      detections: [
        {
          label: damageTypeUpper,
          confidence: confidence,
          box: [0.15, 0.25, 0.70, 0.65],
          severity: severityUpper
        }
      ],
      priority: (() => {
        if (c.priority_breakdown && typeof c.priority_breakdown === 'object') {
          const b = c.priority_breakdown;
          return {
            score: prioScore,
            level: prioScore >= 80 ? 'CRITICAL' : prioScore >= 60 ? 'HIGH' : prioScore >= 40 ? 'MEDIUM' : 'LOW',
            breakdown: b,
            rationale: b.rationale || `Evaluated via MargDrishti Prototype Explainable Priority Model (Score: ${prioScore}/100).`
          };
        }
        const calcP = PriorityEngine.calculatePriority({
          damageType: damageTypeUpper,
          severity: severityUpper,
          confidence: confidence,
          detectionCount: 1,
          surfaceDamageAreaPct: 0,
          roadType: 'ARTERIAL',
          trafficExposure: 'HIGH',
          sensitiveZones: ['SCHOOL', 'TRANSIT'],
          corroboratingCount: 1
        });
        return {
          score: prioScore || calcP.score,
          level: prioScore ? (prioScore >= 80 ? 'CRITICAL' : prioScore >= 60 ? 'HIGH' : 'MEDIUM') : calcP.level,
          breakdown: calcP.breakdown,
          rationale: calcP.rationale
        };
      })(),
      location: {
        latitude: Number(c.latitude) || 16.7050,
        longitude: Number(c.longitude) || 74.2433,
        roadName: c.address || c.city || 'Station Road',
        ward: c.district || 'City Zone',
        landmark: c.address || '',
        city: c.city || 'Kolhapur',
        district: c.district || 'Kolhapur',
        state: c.state || 'Maharashtra',
        source: c.location_source || 'GPS'
      },
      status: statusUpper,
      resolution: resolution,
      createdAt: c.created_at || c.complaint_date || new Date().toISOString(),
      assignedOfficer: c.assigned_to ? {
        id: c.assigned_to,
        user_id: c.assigned_to,
        name: c.assigned_to_name || (c.assigned_to === 'ENG-0001' ? 'Rajesh Kumar' : c.assigned_to === 'ENG-0002' ? 'Priya Sharma' : 'Municipal Engineer'),
        designation: c.assigned_to === 'ENG-0002' ? 'Junior Engineer (Civil)' : 'Assistant Executive Engineer',
        phone: c.assigned_to_phone || '+91 98450 12345',
        expectedCompletionDate: c.expected_completion_date,
        acknowledgedAt: c.acknowledged_at,
        assignmentStatus: c.assignment_status || 'ASSIGNED'
      } : null,
      assignedAt: c.assigned_at || null,
      repairEvidence: (statusUpper === 'RESOLVED' || statusUpper === 'REPAIR_COMPLETED') ? {
        imageUrl: c.completion_image_path || SAMPLE_ROAD_IMAGES.repaired_road,
        notes: c.repair_description || c.repair_notes || 'Surface integrity verified after post-repair monitoring.',
        completedAt: c.repair_completed_at || new Date().toISOString(),
        resolvedBy: c.assigned_to_name || 'Municipal Engineer (AEE)'
      } : null,
      repairProgress: Number(c.progress_pct) || (statusUpper === 'RESOLVED' ? 100 : statusUpper === 'REPAIR_COMPLETED' ? 90 : statusUpper === 'IN_PROGRESS' ? 50 : 0),
      repairNotes: c.repair_notes || '',
      monitoring: c.monitoring_id ? {
        monitoringId: c.monitoring_id,
        status: c.monitoring_status || 'UNDER_MONITORING',
        daysTotal: 60,
        daysCompleted: Math.min(60, Number(c.observations_count) || 0),
        observations_count: Number(c.observations_count) || 0,
        stability_score: c.stability_score != null ? Number(c.stability_score) : 96.5,
        result: c.monitoring_result || 'STABLE',
        authority_confirmation: !!c.authority_confirmation,
        sensorSummary: c.monitoring_status === 'FAILED'
          ? 'Abnormal Motion Detected (|A|: 18.7 m/s²)'
          : 'Normal Motion Pattern (|A|: 9.81 m/s²)',
        observations: c.monitoring_status === 'FAILED'
          ? 'High vibration anomaly detected by patrol sensor. Re-inspection required.'
          : 'Road surface compact and stable under 60-day post-repair monitoring.'
      } : null,
      timeline: [
        {
          status: 'REPORTED',
          title: 'Reported',
          remarks: c.description || 'Complaint submitted by citizen.',
          timestamp: c.created_at || new Date().toISOString(),
          actor: c.citizen_name || 'Citizen'
        }
      ]
    };
  }

  getAllComplaints() {
    if (this.inMemoryComplaints && this.inMemoryComplaints.length > 0) {
      return [...this.inMemoryComplaints].sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0));
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.sort((a, b) => (b.priority?.score || 0) - (a.priority?.score || 0));
    } catch (e) {
      console.error('Failed to parse complaints from storage', e);
      return [];
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
      const match = c.complaintId.match(/MD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `MD-${String(maxNum + 1).padStart(6, '0')}`;
  }

  saveAllComplaints(list) {
    this.inMemoryComplaints = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    this.dispatchChangeEvent();
  }

  addComplaint(data) {
    const all = this.getAllComplaints();
    const complaintId = data.complaintId || this.getNextComplaintId();

    const newRecord = {
      complaintId,
      citizenId: data.citizenId || 'CIT-0001',
      citizenName: data.citizenName || 'Aishwarya Patil',
      citizenPhone: data.citizenPhone || '9876543210',
      description: data.description || 'Road damage reported via MargDrishti portal.',
      mediaType: data.mediaType || 'image',
      mediaUrl: data.mediaUrl || SAMPLE_ROAD_IMAGES.pothole_severe,
      videoDetails: data.videoDetails || null,
      damageType: (data.damageType || 'POTHOLE').toUpperCase(),
      severity: (data.severity || 'HIGH').toUpperCase(),
      confidence: data.confidence || 0.94,
      detections: data.detections || [],
      priority: data.priority || {
        score: 84,
        level: 'HIGH',
        breakdown: { damageSeverity: 24, damageExtent: 16, roadImportance: 18, trafficExposure: 8, sensitiveLocation: 10, corroboratingEvidence: 8 },
        rationale: 'Evaluated according to MargDrishti explainable priority formula.'
      },
      location: data.location || {
        latitude: 16.7050,
        longitude: 74.2433,
        roadName: 'Station Road',
        ward: 'Kolhapur City',
        city: 'Kolhapur',
        district: 'Kolhapur',
        state: 'Maharashtra',
        source: 'GPS'
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
          remarks: `YOLO11 detected ${data.damageType || 'damage'} with ${Math.round((data.confidence || 0.94) * 100)}% confidence. Priority score: ${data.priority?.score || 84}/100.`,
          timestamp: new Date().toISOString(),
          actor: 'MargDrishti AI Vision'
        }
      ]
    };

    all.unshift(newRecord);
    this.saveAllComplaints(all);
    return newRecord;
  }

  async verifyComplaint(complaintId, officerName = 'Municipal Control Room') {
    // 1. Send to PostgreSQL backend
    try {
      await verifyComplaintApi(complaintId, 'AUTHUSER-0001', 'Authority control room verified damage and confirmed maintenance triage priority.');
    } catch (e) {
      console.warn('Backend verify API warning:', e.message);
    }

    // 2. Update local state
    const res = this.updateStatus(complaintId, 'VERIFIED', 'Authority control room verified damage and confirmed maintenance triage priority.', officerName);
    this.fetchFromBackend().catch(() => {});
    return res;
  }

  async assignOfficer(complaintId, officer, remarks = '', expectedCompletionDate = null) {
    // 1. Send to PostgreSQL backend
    let backendRes = null;
    try {
      const engId = officer.id || officer.user_id || 'ENG-0001';
      backendRes = await assignComplaintApi(complaintId, engId, 'AUTHUSER-0001', remarks, expectedCompletionDate);
    } catch (e) {
      console.warn('Backend assign API error:', e.message);
      throw e;
    }

    // 2. Update local state
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (item) {
      const now = new Date();
      item.assignedOfficer = {
        ...officer,
        expectedCompletionDate,
        assignedAt: now.toISOString(),
        assignmentStatus: 'ASSIGNED'
      };
      item.assignedAt = now.toISOString();
      item.status = 'ASSIGNED';
      item.resolution = 30;
      item.timeline = item.timeline || [];
      item.timeline.push({
        status: 'ASSIGNED',
        title: 'Assigned',
        remarks: remarks || `Work order dispatched to ${officer.name} (${officer.designation || 'Engineer'}). Minimum 15-day assignment period initiated.`,
        timestamp: now.toISOString(),
        actor: 'Municipal Control Room'
      });
      this.saveAllComplaints(all);
    }

    this.fetchFromBackend().catch(() => {});
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

  async fastForwardAssignment(complaintId, days = 15) {
    try {
      await fastForwardAssignmentApi(complaintId, days);
    } catch (e) {
      console.warn('Backend fast-forward API warning:', e.message);
    }

    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (item) {
      const currentAssigned = item.assignedAt ? new Date(item.assignedAt).getTime() : Date.now();
      item.assignedAt = new Date(currentAssigned - days * 24 * 60 * 60 * 1000).toISOString();
      this.saveAllComplaints(all);
    }
    return item;
  }

  async updateStatus(complaintId, newStatus, remarks = '', actor = 'Authority Control Room') {
    // 1. Send to PostgreSQL backend
    try {
      if (newStatus === 'IN_PROGRESS') {
        await markInProgressApi(complaintId, 'AUTHUSER-0001', 'AUTHUSER-0001', remarks);
      } else {
        await fetch(`http://localhost:5000/api/complaints/${encodeURIComponent(complaintId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, changed_by: 'AUTHUSER-0001', remarks })
        });
      }
    } catch (e) {
      console.warn('Backend updateStatus API warning:', e.message);
    }

    // 2. Update local state
    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    item.status = newStatus;
    if (newStatus === 'IN_PROGRESS') item.resolution = 50;
    else if (newStatus === 'REPAIR_COMPLETED') item.resolution = 90;
    else if (newStatus === 'RESOLVED') item.resolution = 100;

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

    item.timeline = item.timeline || [];
    item.timeline.push({
      status: newStatus,
      title: titles[newStatus] || newStatus,
      remarks: remarks || `Status updated to ${titles[newStatus] || newStatus}.`,
      timestamp: new Date().toISOString(),
      actor: actor
    });

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  /**
   * FEATURE 1: Mark Repair Completed — Enters Post-Repair Monitoring (Resolution = 90%)
   */
  async markRepairCompleted(complaintId, repairData = {}, monitoringDays = null) {
    const days = Number(monitoringDays) || this.getMonitoringDays() || POST_REPAIR_MONITORING_DAYS;

    try {
      await markRepairCompletedApi(complaintId, 'AUTHUSER-0001', 'AUTHUSER-0001', repairData.notes || 'Repair execution completed.', days);
    } catch (e) {
      console.warn('Backend repair completed API warning:', e.message);
    }

    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    item.status = 'REPAIR_COMPLETED';
    item.resolution = 90;

    item.repairEvidence = {
      imageUrl: repairData.imageUrl || SAMPLE_ROAD_IMAGES.repaired_road,
      notes: repairData.notes || 'Repair execution completed on site. Marked for post-repair quality monitoring.',
      completedAt: now.toISOString(),
      resolvedBy: repairData.resolvedBy || 'Municipal Engineer (Assistant Executive Engineer)'
    };

    item.monitoring = {
      status: 'UNDER_MONITORING',
      daysTotal: days,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      daysCompleted: 0,
      sensorObservations: repairData.sensorObservations || null,
      deteriorationDetected: false,
      sensorSummary: 'Surface monitoring active. Normal motion patterns confirmed (|A|: 9.81 m/s²).',
      observations: repairData.notes || `Road surface patched and compacted. Entered mandatory ${days}-day post-repair monitoring period.`
    };

    item.timeline = item.timeline || [];
    item.timeline.push({
      status: 'REPAIR_COMPLETED',
      title: 'Repair Completed — Under Monitoring (90%)',
      remarks: `Physical road repair executed on site. Entered mandatory ${days}-day post-repair monitoring period before final resolution (Resolution: 90%).`,
      timestamp: now.toISOString(),
      actor: item.repairEvidence.resolvedBy
    });

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  /**
   * FEATURE: Smartphone / Patrol Vehicle Sensor Observation
   */
  async simulateSensorObservation(complaintId, isAbnormal = false) {
    try {
      await logSensorObservationApi(complaintId, { is_abnormal: isAbnormal });
    } catch (e) {
      console.warn('Backend sensor observation API warning:', e.message);
    }

    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    if (!item.monitoring) {
      item.monitoring = {
        status: 'UNDER_MONITORING',
        daysTotal: this.getMonitoringDays(),
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + this.getMonitoringDays() * 86400000).toISOString(),
        daysCompleted: 5,
        observations: 'Under quality monitoring observation.'
      };
    }

    item.monitoring.observations_count = (item.monitoring.observations_count || 0) + 1;

    if (isAbnormal) {
      item.status = 'REINSPECTION_REQUIRED';
      item.monitoring.status = 'FAILED';
      item.monitoring.deteriorationDetected = true;
      item.monitoring.sensorSummary = 'Repeated Abnormal Motion Pattern (Peak |A| > 18.7 m/s²)';
      item.monitoring.observations = 'Repeated abnormal vehicle-motion shock patterns observed near repaired coordinates. Surface deterioration suspected.';
      item.timeline = item.timeline || [];
      item.timeline.push({
        status: 'REINSPECTION_REQUIRED',
        title: 'Sensor Evidence: Deterioration Detected',
        remarks: 'Smartphone sensor evidence indicates abnormal vertical impact patterns near repaired location. Dispatched for Authority Review.',
        timestamp: new Date().toISOString(),
        actor: 'MargDrishti Telemetry Sentinel'
      });
    } else {
      item.monitoring.deteriorationDetected = false;
      item.monitoring.sensorSummary = 'Normal Motion Pattern (|A|: 9.81 m/s²)';
      item.monitoring.observations = 'Road surface intact under 60-day post-repair observation. Zero abnormal jerk or vibration patterns detected.';
    }

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  /**
   * FEATURE 1: Simulate monitoring elapsed days
   */
  async simulateMonitoringProgress(complaintId, daysElapsed) {
    const added = Number(daysElapsed) || 15;

    try {
      await simulateMonitoringApi(complaintId, added);
    } catch (e) {
      console.warn('Backend simulate monitoring API warning:', e.message);
    }

    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item || !item.monitoring) return null;

    item.monitoring.daysCompleted = Math.min(item.monitoring.daysTotal, (item.monitoring.daysCompleted || 0) + added);

    if (item.monitoring.daysCompleted >= item.monitoring.daysTotal && item.status === 'REPAIR_COMPLETED') {
      item.status = 'CONFIRMATION_REQUIRED';
      item.monitoring.status = 'CONFIRMATION_REQUIRED';
      item.timeline = item.timeline || [];
      item.timeline.push({
        status: 'CONFIRMATION_REQUIRED',
        title: 'Authority Confirmation Required',
        remarks: `Post-repair monitoring period of ${item.monitoring.daysTotal} days completed. Awaiting authority final inspection & confirmation.`,
        timestamp: new Date().toISOString(),
        actor: 'MargDrishti Automated System'
      });
    }

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  /**
   * FEATURE 1: Authority Final Confirmation — Option 1: Confirm Repair (100% Fully Resolved)
   */
  async confirmFinalResolution(complaintId, confirmationData = {}) {
    try {
      await confirmFinalResolutionApi(complaintId, 'AUTHUSER-0001', confirmationData.notes || 'Surface integrity verified after post-repair monitoring.');
    } catch (e) {
      console.warn('Backend confirm final API warning:', e.message);
    }

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
        observations: 'Confirmed without extended monitoring.'
      };
    } else {
      item.monitoring.status = 'PASSED';
      item.monitoring.daysCompleted = item.monitoring.daysTotal;
    }

    if (!item.repairEvidence) {
      item.repairEvidence = {
        imageUrl: confirmationData.imageUrl || SAMPLE_ROAD_IMAGES.repaired_road,
        notes: confirmationData.notes || 'Surface integrity verified after post-repair monitoring.',
        resolvedAt: now.toISOString(),
        resolvedBy: confirmationData.confirmedBy || 'Municipal Engineer (Assistant Executive Engineer)'
      };
    } else {
      item.repairEvidence.resolvedAt = now.toISOString();
      if (confirmationData.confirmedBy) item.repairEvidence.resolvedBy = confirmationData.confirmedBy;
      if (confirmationData.notes) item.repairEvidence.notes += ` | Final Confirmation: ${confirmationData.notes}`;
    }

    item.timeline = item.timeline || [];
    item.timeline.push({
      status: 'RESOLVED',
      title: '100% Fully Resolved',
      remarks: confirmationData.notes || 'Repair successfully completed and confirmed by the responsible authority.',
      timestamp: now.toISOString(),
      actor: confirmationData.confirmedBy || item.repairEvidence.resolvedBy || 'Authority Official'
    });

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  /**
   * FEATURE 1: Authority Final Confirmation — Option 2: Request Reinspection (Damage Reappeared)
   */
  async requestReinspection(complaintId, reinspectionData = {}) {
    try {
      await requestReinspectionApi(complaintId, 'AUTHUSER-0001', reinspectionData.reason || 'Road damage observed again during monitoring.');
    } catch (e) {
      console.warn('Backend reinspect API warning:', e.message);
    }

    const all = this.getAllComplaints();
    const item = all.find(c => c.complaintId === complaintId);
    if (!item) return null;

    const now = new Date();
    item.status = 'REINSPECTION_REQUIRED';
    item.resolution = 50;

    if (!item.monitoring) {
      item.monitoring = {
        status: 'FAILED',
        daysTotal: this.getMonitoringDays(),
        startDate: now.toISOString(),
        endDate: now.toISOString(),
        daysCompleted: 0,
        observations: reinspectionData.reason || 'Road damage re-appeared during monitoring.'
      };
    } else {
      item.monitoring.status = 'FAILED';
      item.monitoring.failureReason = reinspectionData.reason || 'Road damage was observed again during the post-repair monitoring period. Further inspection is required.';
    }

    item.timeline = item.timeline || [];
    item.timeline.push({
      status: 'REINSPECTION_REQUIRED',
      title: 'Reinspection Required',
      remarks: reinspectionData.reason || 'Road damage was observed again during the post-repair monitoring period. Further inspection is required.',
      timestamp: now.toISOString(),
      actor: reinspectionData.requestedBy || 'Municipal Engineer (Assistant Executive Engineer)'
    });

    this.saveAllComplaints(all);
    this.fetchFromBackend().catch(() => {});
    return item;
  }

  resolveComplaint(complaintId, repairData) {
    return this.confirmFinalResolution(complaintId, repairData);
  }

  resetDatabase() {
    this.inMemoryComplaints = null;
    localStorage.removeItem(STORAGE_KEY);
    this.fetchFromBackend().catch(() => {});
  }

  dispatchChangeEvent() {
    window.dispatchEvent(new CustomEvent('margdrishti:updated'));
  }
}

export const MargDrishtiStore = new MargDrishtiStoreManager();

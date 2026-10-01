# MargDrishti — Operational Workflows

---

## 1. Citizen Reporting Workflow

1. **Authentication & Identity Allocation:**
   - Citizen signs up with Full Name, Email, and 10-digit Mobile Number.
   - Platform issues a unique Citizen ID in official format: `CIT-2026-XXXXXX`.
2. **Evidence Upload & Authenticity Check:**
   - Citizen uploads photo evidence (JPG/PNG) or dashcam video (MP4/WebM).
   - Before model inference, `imageAuthenticityService` verifies whether the media is a genuine optical camera photograph or synthetic / AI-generated.
   - If flagged as AI-Generated, the citizen is warned with an option to upload an original photograph.
3. **Location Selection & Location Confirmation:**
   - **Option 1 (Current GPS):** Retrieves high-accuracy device coordinates via browser geolocation.
   - **Option 2 (Manual Location):** Citizen enters street name, municipal ward, landmark, and jurisdiction, or clicks/drags the marker directly on the Leaflet map.
   - **Responsible Authority Resolution:** The system displays the responsible civic agency:
     - `City / Municipal Road` &rarr; Municipal Corporation / Municipal Council
     - `State Highway` &rarr; State PWD
     - `National Highway` &rarr; NHAI / Relevant NH Authority
     - `Rural / Village Road` &rarr; Zilla Parishad / Rural Development Authority / PWD
     - `Private / Society Road` &rarr; Society / Developer / Private Owner
   - Location Confirmation Card allows the citizen to review details and click "Change Location" before submission.
4. **AI Damage Detection (YOLO11):**
   - Classifies defect into `Pothole`, `Longitudinal Crack`, `Transverse Crack`, or `Alligator Crack`.
   - Generates bounding box coordinates and class confidence ratings.
5. **Explainable Priority Formulation:**
   - Synthesizes defect severity with road classification, peak transit traffic, and hospital/school proximity.
6. **Submission & Tracking:**
   - Generates unique tracking ID: `MD-2026-XXXXXX`.
   - Complaint appears synchronously in the municipal authority maintenance queue.

---

## 2. Municipal Authority Triage & Lifecycle Workflow

1. **Authority Authentication & Scope:**
   - Officer logs in with municipal credentials (`AUT-2026-XXXXXX`), road classification, and jurisdiction.
2. **Priority Queue Triage:**
   - Complaints appear dynamically ranked from highest priority score (100) to lowest.
   - Officers inspect AI bounding boxes, surface area damage, and spatial coordinates.
3. **Verification & Work Order Assignment:**
   - Officer reviews jurisdiction validity, marks complaint `VERIFIED`, and assigns work order to a designated field officer (`ASSIGNED`).
4. **15-Day Minimum Cooldown Enforcement:**
   - Work order cannot transition to `IN_PROGRESS` until a minimum of 15 days have elapsed since assignment.
   - Dashboard displays days remaining until field crews can mobilize.
5. **Repair Completed (90% Resolution Cap):**
   - Field crew submits photographic proof of repair. Status becomes `REPAIR_COMPLETED`.
   - Resolution is strictly capped at **90%** — defect is not closed.
6. **60-Day Post-Repair Observation Cycle:**
   - Complaint enters mandatory 60-day post-repair monitoring table.
   - Hardware sensor telemetry tracks vibration and pavement stability.
   - If road deteriorates, authority can flag `REINSPECTION_REQUIRED` to re-dispatch crews.
7. **Final Authority Durability Confirmation (100% Fully Resolved):**
   - Only after successful completion of the observation period and manual confirmation by an authorized municipal official is the complaint closed as `100% Fully Resolved`.

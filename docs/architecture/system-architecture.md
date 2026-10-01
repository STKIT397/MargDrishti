# MargDrishti — System Architecture

```mermaid
flowchart TD
    subgraph CitizenClient["Citizen Client Portal"]
        C1[Citizen Registration / Login] --> C2[Evidence Upload Image / Video]
        C2 --> C3[Image Authenticity Check]
        C3 --> C4[Manual Location or GPS Confirmation]
        C4 --> C5[YOLO11 AI Vision Analysis]
        C5 --> C6[6-Factor Priority Scoring]
        C6 --> C7[Complaint Submission ID: MD-2026-XXXX]
    end

    subgraph CorePlatform["MargDrishti Core & Storage Layer"]
        C7 --> S1[(Shared Data Layer PostGIS / LocalStore)]
        S1 --> S2[15-Day Minimum Assignment Policy Engine]
        S1 --> S3[60-Day Post-Repair Monitoring Engine]
        S1 --> S4[Pothole-Aware Routing Engine]
    end

    subgraph AuthorityConsole["Municipal Authority Console"]
        S1 --> A1[Prioritized Maintenance Queue]
        A1 --> A2[Defect Inspection & Verification]
        A2 --> A3[Work Order Assignment to Field Officer]
        A3 --> A4[In Progress Work 15-Day Lock]
        A4 --> A5[Repair Completed 90% Resolution]
        A5 --> S3
        S3 --> A6[Authority Final Confirmation 100% Resolved]
    end

    subgraph PotholeMapNav["Pothole Map & Navigation"]
        S1 --> N1[Active Defect Visualization]
        N1 --> N2[Route Calculation Safest vs Fastest]
        N2 --> N3[Corridor Hazard Penalty Scoring]
    end
```

---

## Architectural Principles

1. **Dual-Role Segregation with Shared Ground Truth:** Citizens register as civic watchdogs, while municipal engineers authenticate against designated jurisdictions. Both access a unified data model.
2. **Pre-Validation Integrity:** Images pass through an authenticity gate before running YOLO11 road damage object detection.
3. **Accountability Through Strict State Locks:**
   - 15-Day assignment cooldown prevents rushed or uncoordinated work starts.
   - Repair Completed caps resolution at 90%, requiring a 60-day post-repair monitoring cycle before final authority confirmation yields 100% Fully Resolved status.
4. **Explainable Civic Prioritization:** Prioritization uses deterministic, weighted civic risk formulas rather than opaque black-box scoring.

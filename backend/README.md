# MargDrishti — Backend Microservices (Spring Boot Architecture)

> **Status:** Architecture Blueprint & Phase 2 Specification  
> **Target Framework:** Spring Boot 3.3.x (Java 21 LTS) & PostgreSQL 16 with PostGIS 3.4

---

## Overview

This directory is reserved for the production Spring Boot backend. In the initial prototype phase, application state is managed client-side via `MargDrishtiStore` (`localStorage`) with synchronous event dispatching. The backend will transition the platform to a distributed, scalable REST/WebSocket civic architecture.

---

## Planned Module Architecture

```
backend/
├── src/main/java/com/margdrishti/
│   ├── auth/                      # JWT Spring Security 6 Authentication
│   │   ├── controllers/           # AuthController (Signup, Login, Refresh)
│   │   ├── services/              # AuthService, TokenProvider
│   │   ├── entities/              # User, Citizen, AuthorityOfficer, Role
│   │   └── repositories/          # UserRepository
│   ├── complaints/                # Road Damage Complaint Lifecycle
│   │   ├── controllers/           # ComplaintController, TimelineController
│   │   ├── services/              # ComplaintService, DispatchService
│   │   ├── entities/              # Complaint, MediaEvidence, TimelineEvent
│   │   └── repositories/          # ComplaintRepository (PostGIS Spatial Queries)
│   ├── priority/                  # Explainable Civic Risk Scoring Engine
│   │   ├── services/              # PriorityScoringEngine, RoadNetworkService
│   │   └── formulas/              # Weighted 6-factor civic priority calculator
│   ├── monitoring/                # 60-Day Post-Repair Observation Engine
│   │   ├── services/              # MonitoringService, DeteriorationDetector
│   │   └── jobs/                  # Scheduled observation cron tasks
│   ├── ai/                        # Deep Learning Gateway & Model Clients
│   │   ├── clients/               # YOLO11InferenceClient (gRPC/HTTP)
│   │   └── services/              # AuthenticityVerificationClient
│   └── routing/                   # Pothole-Aware Route Evaluation API
│       ├── controllers/           # RoutingController
│       └── services/              # CorridorHazardAggregator, OSRMClient
└── src/main/resources/
    ├── application.yml            # Database, Security, and ML Service Configs
    └── db/migration/              # Flyway SQL schema migrations
```

---

## Core Modules & Functional Responsibilities

### 1. Authentication & RBAC Module (`com.margdrishti.auth`)
- **Dual-Role RBAC:** Segregates `ROLE_CITIZEN` and `ROLE_AUTHORITY`.
- **Unique Identification:** Issues `CIT-YYYY-XXXXXX` and `AUT-YYYY-XXXXXX` identifiers on registration.
- **Authority Scope Binding:** Enforces road jurisdiction boundaries (`City / Municipal Road`, `State Highway`, `National Highway`, `Rural / Village Road`, `Private Road`).

### 2. Complaint Management Module (`com.margdrishti.complaints`)
- **Spatial Indexing:** Leverages PostGIS geometry types (`POINT(lat, lng)`) for spatial indexing and proximity clustering.
- **Workflow State Machine:** Enforces transition locks:
  `REPORTED` &rarr; `AI_ANALYZED` &rarr; `VERIFIED` &rarr; `ASSIGNED` &rarr; `IN_PROGRESS` (15-day minimum window) &rarr; `REPAIR_COMPLETED` (90% resolution & 60-day observation) &rarr; `RESOLVED` (100% confirmation).

### 3. Priority Engine Integration (`com.margdrishti.priority`)
- Server-side validation of the 6-factor civic priority formula:
  $$\text{Score} = 0.30 \times \text{Damage Severity} + 0.20 \times \text{Damage Extent} + 0.20 \times \text{Road Importance} + 0.10 \times \text{Traffic Exposure} + 0.10 \times \text{Sensitive Location} + 0.10 \times \text{Corroborating Evidence}$$

### 4. YOLO11 Inference Integration (`com.margdrishti.ai`)
- Connects to the standalone Python FastAPI / Triton inference server hosting the YOLO11 model.
- Transmits raw citizen images, receives bounding boxes (`[ymin, xmin, ymax, xmax]`), class labels (`Pothole`, `Longitudinal Crack`, `Transverse Crack`, `Alligator Crack`), and confidence ratings.
- Communicates with synthetic image authenticity detector to flag non-optical media before database insertion.

### 5. PostgreSQL + PostGIS Database Integration
- High-efficiency spatial queries: `ST_DWithin` for corridor hazard lookup and hotspot density heatmaps.
- Auditable complaint timeline tables preserving tamper-evident records of municipal officer actions.

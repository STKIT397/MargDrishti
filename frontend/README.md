# MargDrishti — Frontend Client Application

> **Smarter Roads. Safer Journeys.**  
> AI-Powered Road Damage Detection, Prioritization & Citizen Reporting System

---

## Overview

The MargDrishti frontend is a responsive, high-performance civic client built with modern vanilla web standards (HTML5, CSS3, ES Modules, Canvas 2D, and Leaflet GIS). It features dual-portal workflows for Citizens and Municipal Authorities, an explainable road defect prioritization engine, interactive routing, and real-time synchrony.

---

## Directory Layout

```
frontend/
├── index.html                 # MargDrishti Portal Home & Dual-Role Auth
├── citizen.html               # Citizen Dashboard & Guided Report Wizard
├── authority.html             # Municipal Authority Triage & 60-Day Monitoring Console
├── map.html                   # GIS Pothole Explorer & Pothole-Aware Route Planner
├── css/
│   └── margdrishti.css        # Unified Design System, Cyber-Civic Theme & Animations
├── js/
│   ├── config/
│   │   └── authorityConfig.js # Centralized Road Type to Responsible Authority Mapping
│   ├── services/
│   │   ├── store.js           # Shared LocalStorage state manager & lifecycle sync
│   │   ├── auth.js            # Dual-role authentication & ID generation
│   │   ├── aiService.js       # YOLO11 inference simulation & class mapping
│   │   ├── imageAuthenticityService.js # Modular synthetic image detection gate
│   │   ├── priorityEngine.js  # 6-Factor civic hazard risk formula
│   │   ├── routeService.js    # Pothole-aware routing engine (OSRM + OSM)
│   │   └── geoService.js      # Leaflet mapping & browser GPS acquisition
│   ├── components/
│   │   ├── boundingBox.js     # Canvas YOLO11 bounding box renderer
│   │   └── aiChatbot.js       # Repositioned floating AI assistant widget
│   ├── citizenApp.js          # Citizen portal application controller
│   ├── authorityApp.js        # Authority portal application controller
│   ├── landingApp.js          # 3D canvas road & landing page controller
│   └── mapApp.js              # Leaflet GIS map & route planner UI controller
├── pages/
│   ├── citizen/               # Citizen portal page views
│   ├── authority/             # Municipal authority page views
│   └── shared/                # Public home and map views
└── assets/                    # Static image previews and icons
```

---

## Key Features

1. **Clean Empty States & Zero-Pollution Data Layer**  
   Starts with clean state (`No complaints yet`, `No complaints received yet`), ready for real citizen reports.
2. **Dual-Role Authentication**  
   - Citizen signup & login generating official Citizen IDs (`CIT-2026-000001`).
   - Authority registration capturing Name, Email, Contact, Road Type, and Jurisdiction (`AUT-2026-000001`).
3. **Responsible Authority Identification**  
   Centralized mapping resolving jurisdiction authority for City Roads, State Highways, National Highways, Rural Roads, and Private Roads.
4. **Manual Location & Location Confirmation**  
   Supports browser GPS acquisition and manual pinpointing with click/drag Leaflet markers.
5. **Image Authenticity Verification Gate**  
   Modular `imageAuthenticityService` verifying optical vs synthetic/AI images before YOLO11 road damage inference.
6. **YOLO11 Road Damage Classification**  
   Detects 4 primary classes: `Pothole`, `Longitudinal Crack`, `Transverse Crack`, and `Alligator Crack`.
7. **Pothole-Aware Routing ("Find Best Route")**  
   Computes `SAFEST`, `FASTEST`, and `BALANCED` routes using OSRM driving geometry and active pothole penalty scoring (excluding resolved defects).
8. **15-Day Rule & 60-Day Post-Repair Monitoring**  
   Enforces minimum 15-day assignment gap and mandatory 60-day observation cycle before final authority confirmation (100% resolution).
9. **Hardware Telemetry**  
   Accurate smartphone sensor telemetry (Accelerometer, Gyroscope, GPS) reporting `"Unavailable on this device"` on unsupported hardware without fabricated metrics.

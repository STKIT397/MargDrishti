# MargDrishti — Core Algorithms & Mathematical Formulations

---

## 1. Explainable Civic Priority Formula

MargDrishti prioritizes road maintenance work orders through a 6-factor deterministic civic risk model:

$$\text{Priority Score} = w_1 S_{\text{sev}} + w_2 S_{\text{ext}} + w_3 S_{\text{road}} + w_4 S_{\text{traf}} + w_5 S_{\text{sens}} + w_6 S_{\text{corr}}$$

### Weights & Factor Specifications:

| Factor | Weight | Max Pts | Description & Evaluation Logic |
|---|---|---|---|
| **1. Damage Severity ($S_{\text{sev}}$)** | **0.30** | 30 | Defect physical depth and skidding danger: `CRITICAL` (28-30 pts), `HIGH` (22-26 pts), `MEDIUM` (14-20 pts), `LOW` (6-12 pts). |
| **2. Damage Extent ($S_{\text{ext}}$)** | **0.20** | 20 | Surface area affected and detection bounding box coverage across pavement width. |
| **3. Road Importance ($S_{\text{road}}$)** | **0.20** | 20 | Classification: `HIGHWAY` (18-20 pts), `ARTERIAL` (16-18 pts), `COLLECTOR` (10-14 pts), `LOCAL` (4-8 pts). |
| **4. Traffic Exposure ($S_{\text{traf}}$)** | **0.10** | 10 | Transit density: `HIGH` (bus routes/metro corridors: 9-10 pts), `MEDIUM` (5-8 pts), `LOW` (1-4 pts). |
| **5. Sensitive Zone Risk ($S_{\text{sens}}$)** | **0.10** | 10 | Cumulative infrastructure: Schools (+3 pts), Hospitals (+4 pts), Transit interchange (+3 pts), Waterlogging zone (+3 pts) (capped at 10). |
| **6. Corroborating Evidence ($S_{\text{corr}}$)** | **0.10** | 10 | Supporting evidence: Multi-citizen reports (+2 pts/report), Dashcam video frame consistency (+4 pts), IMU sensor telemetry (+3 pts). |

### Priority Levels:
- **$\ge 80$ / 100:** `CRITICAL PRIORITY` (SLA: 24-48 Hours)
- **$60 - 79$ / 100:** `HIGH PRIORITY` (SLA: 3-5 Days)
- **$40 - 59$ / 100:** `MEDIUM PRIORITY` (SLA: 7-10 Days)
- **$< 40$ / 100:** `LOW PRIORITY` (Routine Maintenance)

---

## 2. Pothole-Aware Route Optimization Algorithm

Unlike standard navigation systems that only minimize travel time, MargDrishti computes route safety scores by penalizing routes that traverse active, unresolved road defects.

$$\text{Route Score} = T_{\text{travel}} + D_{\text{dist}} + P_{\text{pothole}} + P_{\text{severity}} + P_{\text{density}}$$

$$\text{Safety Score} = \max(10, \min(100, 100 - (P_{\text{pothole}} + P_{\text{severity}} + P_{\text{density}})))$$

### Penalty Formulations:
1. **Active Defect Filter:** Only complaints where $\text{status} \neq \text{RESOLVED}$ are counted.
2. **Pothole Penalty:** $P_{\text{pothole}} = N_{\text{hazards}} \times 5$
3. **Severity Surcharges:**
   - Critical Potholes: $+15\text{ pts each}$
   - High Severity Cracks/Potholes: $+10\text{ pts each}$
   - Medium Defects: $+5\text{ pts each}$
   - Low Defects: $+2\text{ pts each}$
4. **Defect Density Penalty:** $P_{\text{density}} = \left(\frac{N_{\text{hazards}}}{D_{\text{km}}}\right) \times 8$

### Navigation Modes:
- **`FASTEST`:** Minimizes travel duration $T_{\text{travel}}$.
- **`SAFEST`:** Maximizes Safety Score (lowest cumulative defect penalty).
- **`BALANCED`:** Optimal pareto-frontier tradeoff between travel duration and road damage exposure.

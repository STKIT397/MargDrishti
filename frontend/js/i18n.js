/**
 * MargDrishti — Lightweight Multilingual Internationalization (i18n) Engine
 * Supports English, Hindi (हिंदी), and Marathi (मराठी).
 * Persists language selection across pages, tabs, and sessions.
 * Preserves internal backend keys (e.g. status identifiers remain stable).
 */

const LANG_STORAGE_KEY = 'margdrishti_lang';
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' }
];

// Embedded Fallback Dictionaries ensuring zero downtime even under offline file:// usage
const EMBEDDED_FALLBACK_TRANSLATIONS = {
  en: {
  "app": {
    "title": "MargDrishti",
    "tagline": "Smarter Roads. Safer Journeys.",
    "selectLanguage": "Select Language",
    "language": "Language",
    "home": "Home",
    "citizenDashboard": "Citizen Dashboard",
    "authorityDashboard": "Authority Dashboard",
    "potholeMap": "Pothole Map & Navigation",
    "resetDemoData": "Reset Demo Data",
    "login": "Login",
    "signup": "Sign Up",
    "logout": "Logout",
    "aiVisionOnline": "AI Vision Online",
    "liveDemoTag": "SIH 2026 Live Demo",
    "trlTag": "TRL08 — Software Category",
    "demoMode": "AI Analysis Demo Mode",
    "authorityView": "Authority View",
    "citizenView": "Citizen View",
    "authorityRole": "Municipal Officer",
    "citizenRole": "Citizen Account"
  },
  "nav": {
    "home": "Home",
    "citizenDashboard": "Citizen Dashboard",
    "authorityDashboard": "Authority Dashboard",
    "potholeMap": "Pothole Map",
    "reportDamage": "+ Report Road Damage",
    "searchComplaint": "Track",
    "searchPlaceholder": "Search Complaint ID (e.g. MD-2026-0001)"
  },
  "hero": {
    "badge": "TRL08 — Software Category",
    "demoBadge": "AI Analysis Demo Mode",
    "titlePart1": "SMARTER ROADS.",
    "titlePart2": "SAFER JOURNEYS.",
    "subtitle": "Capture road damage through an image or video. Let AI detect potholes and cracks, identify the location, prioritize what matters, and track repairs to verified resolution.",
    "ctaReport": "Report Road Damage",
    "ctaAuthority": "Authority Dashboard",
    "ctaMap": "Pothole Map & Route",
    "bullet1": "Image & Dashcam Video Inference",
    "bullet2": "Explainable Priority Score (0–100)",
    "bullet3": "Current GPS & Demo Location",
    "bullet4": "Synchronous Repair Tracking",
    "scanHint": "⚡ Click road to initiate surface scan"
  },
  "process": {
    "capture": "CAPTURE",
    "detect": "DETECT",
    "locate": "LOCATE",
    "prioritize": "PRIORITIZE",
    "track": "TRACK",
    "resolve": "RESOLVE"
  },
  "value": {
    "badge": "Core Innovation",
    "title": "MORE THAN JUST A POTHOLE DETECTOR",
    "subtitle": "MargDrishti closes the loop between computer vision intelligence, transparent prioritization, and municipal action.",
    "card1Title": "Image & Video AI Detection",
    "card1Desc": "Analyze road photos or dashcam videos to accurately identify supported damage types such as potholes and structural cracks.",
    "card2Title": "Current Location Intelligence",
    "card2Desc": "Capture the user's current GPS location with high accuracy, paired with a reliable Demo Location fallback for bulletproof presentations.",
    "card3Title": "Explainable Prioritization",
    "card3Desc": "A transparent 6-factor formula accounts for damage severity, road type, traffic exposure, and sensitive nearby infrastructure.",
    "card4Title": "Two-Phase Repair Accountability",
    "card4Desc": "Repair Completed enters mandatory post-repair monitoring (90%) before the municipal authority grants 100% final confirmation."
  },
  "triage": {
    "badge": "Live Triage Preview",
    "title": "HIGH-CONCURRENCY MUNICIPAL QUEUE",
    "subtitle": "Real-time dispatch system prioritizing repairs based on actual safety and traffic risks.",
    "colId": "Complaint ID",
    "colDamage": "Damage Type",
    "colLocation": "Location",
    "colPriority": "Priority",
    "colStatus": "Status",
    "colDate": "Reported"
  },
  "architecture": {
    "badge": "System Architecture",
    "title": "TRL08 PRODUCTION PIPELINE",
    "subtitle": "Modular edge-to-cloud architecture designed for scalable municipal deployment.",
    "step1Title": "1. Edge Ingestion",
    "step1Desc": "Citizen photos, dashcam video streams, and smartphone IMU sensor telemetry.",
    "step2Title": "2. Vision & Sensor Fusion",
    "step2Desc": "YOLO11 neural detection correlated with accelerometer vibration spikes.",
    "step3Title": "3. Priority Matrix",
    "step3Desc": "Multi-factor ranking balancing structural depth, traffic volume, and school zones.",
    "step4Title": "4. Dispatch & Two-Phase Verification",
    "step4Desc": "Zonal crew deployment followed by 30-day post-repair durability observation."
  },
  "footer": {
    "title": "MargDrishti",
    "tagline": "Smarter Roads. Safer Journeys.",
    "hackathonTag": "Smart India Hackathon Prototype",
    "demoDataMode": "Demo Data Mode",
    "yoloModel": "YOLO11 Model Simulation"
  },
  "auth": {
    "portalCitizen": "Citizen Portal",
    "portalAuthority": "Municipal Dispatch Console",
    "title": "Access Your MargDrishti Account",
    "tabCitizen": "Citizen",
    "tabAuthority": "Municipal Authority",
    "loginTab": "Log In",
    "signupTab": "Create Account",
    "fullName": "Full Name",
    "email": "Email Address",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "department": "Municipal Department / Division",
    "designation": "Designation / Title",
    "zone": "Assigned Municipal Zone",
    "roadType": "Road Jurisdiction Classification",
    "respAuthority": "Auto-Resolved Responsible Authority",
    "btnLogin": "Log In to Account",
    "btnSignup": "Create Citizen Account",
    "btnSignupAuthority": "Register Authority Official",
    "noAccount": "Don't have an account?",
    "haveAccount": "Already have an account?",
    "signupLink": "Sign Up",
    "loginLink": "Log In"
  },
  "citizen": {
    "portalBadge": "Citizen Portal",
    "demoMode": "AI Analysis Demo Mode",
    "heroTitle": "Make Your Road Safer",
    "heroSubtitle": "Report potholes or cracks using an image or video and help improve your community's roads.",
    "totalReports": "Total Reports",
    "pendingTriage": "Pending Triage",
    "inProgress": "In Progress",
    "resolvedVerified": "Resolved & Verified",
    "myReports": "My Road Damage Reports",
    "subTitleReports": "Persistent Local Storage",
    "subAcross": "Across indiranagar & metro corridors",
    "subAwaiting": "Awaiting authority dispatch",
    "subSquads": "Repair squads on site",
    "subConfirmed": "Confirmed by municipal authority",
    "btnReportDamage": "+ Report Road Damage",
    "colId": "Complaint ID",
    "colEvidence": "Evidence",
    "colDamage": "Damage Type",
    "colLocation": "Location",
    "colPriority": "Priority Score",
    "colStatus": "Status",
    "colDate": "Date",
    "colActions": "Actions",
    "emptyReports": "No reports filed yet. Click '+ Report Road Damage' to file your first report.",
    "btnTrack": "Track"
  },
  "wizard": {
    "modalTitle": "Report Road Damage",
    "modalSubtitle": "Guided AI damage detection, current location, and explainable prioritization.",
    "step1": "1. Evidence",
    "step2": "2. Location",
    "step3": "3. Details & AI",
    "photoEvidence": "Photo Evidence (JPG/PNG)",
    "videoEvidence": "Dashcam Video (MP4/WebM)",
    "dropzoneText": "Click to browse or drag road damage file here",
    "dropzoneDesc": "JPEG, PNG or WEBP up to 10MB",
    "quickPresets": "⚡ Quick Preset Media (Instant SIH Demo):",
    "presetPothole": "Severe Indiranagar Pothole",
    "presetCrack": "Hosur Road Alligator Cracks",
    "presetVideo": "Dashcam Road Video (14s Sample)",
    "previewValid": "✓ Resolution Valid • Ready for YOLO11 Object Detection",
    "btnToStep2": "Next: Location Intelligence",
    "locationTitle": "Location & Geolocation Intelligence",
    "locationSubtitle": "Capture current GPS coordinates or use the verified smart city demo location.",
    "btnCurrentLocation": "Use Current Location",
    "btnDemoLocation": "Demo Location",
    "roadName": "Road / Street Name",
    "wardSector": "Ward / Municipal Sector",
    "landmark": "Prominent Landmark",
    "gpsCoordinates": "GPS Coordinates",
    "demoLocBadge": "Demo Location",
    "sensorsTitle": "Smartphone Sensors Telemetry",
    "sensorsSubtitle": "Hardware Web APIs",
    "btnEnableSensors": "Enable Motion Sensors",
    "accel": "Accelerometer",
    "gyro": "Gyroscope",
    "gps": "GPS",
    "checking": "Checking hardware support...",
    "available": "Available",
    "unavailable": "Unavailable on this device",
    "sensorHonestyDesc": "Live hardware telemetry. On desktop browsers without IMU sensors, status indicates 'Unavailable on this device' per SIH guidelines.",
    "btnBack": "Back",
    "btnToStep3": "Next: Road Context & AI Analysis",
    "hazardDesc": "Hazard Description (Optional)",
    "hazardPlaceholder": "e.g. Deep pothole right after traffic light, severe two-wheeler skidding risk...",
    "roadClassification": "Road Classification",
    "arterial": "Major Arterial (High-Traffic Corridor)",
    "highway": "State / National Highway Link",
    "collector": "Collector / Sub-Arterial Road",
    "local": "Local Residential Street",
    "trafficExposure": "Traffic Exposure",
    "trafficHigh": "High (Bus Route / Peak Transit)",
    "trafficMedium": "Moderate (Regular Local Traffic)",
    "trafficLow": "Low (Calm Residential)",
    "sensitiveInfra": "Nearby Sensitive Infrastructure (Select all that apply)",
    "schoolZone": "School / College Zone",
    "hospitalRoute": "Hospital Transit Route",
    "metroTransit": "Metro / Bus Interchange",
    "waterlogging": "Waterlogging Prone Zone",
    "btnRunScan": "Run YOLO11 AI Analysis & Prioritization",
    "scanningTitle": "Executing YOLO11 Neural Network Inference...",
    "scanningSubtitle": "Extracting bounding boxes, class labels, and spatial severity index",
    "priorityIndex": "Priority Index",
    "topQueue": "Top Maintenance Queue",
    "damageDetected": "Damage Detected",
    "confidence": "Confidence",
    "severity": "Severity",
    "model": "Model",
    "explainableModel": "Prototype Explainable Priority Model (Weights):",
    "weightSeverity": "1. Damage Severity (30%)",
    "weightExtent": "2. Damage Extent (20%)",
    "weightRoad": "3. Road Importance (20%)",
    "weightTraffic": "4. Traffic Exposure (10%)",
    "weightSensitive": "5. Sensitive Zone Risk (10%)",
    "weightCorroboration": "6. Corroborating Evidence (10%)",
    "btnSubmit": "Submit Official Road Damage Report"
  },
  "success": {
    "title": "Report Submitted Successfully!",
    "subtitle": "Your report has been prioritized and routed to the municipal road maintenance queue.",
    "trackingId": "Official Tracking ID",
    "btnTrack": "Track Complaint Progress",
    "btnBack": "Back to Dashboard"
  },
  "tracking": {
    "modalTitle": "Complaint Tracking Console",
    "liveSync": "Live State Sync",
    "timelineTitle": "Maintenance Progression Timeline",
    "assignedOfficer": "Assigned Officer",
    "resolutionLevel": "Resolution Level",
    "initialEvidence": "Initial Damage Evidence",
    "postRepairEvidence": "Post-Repair Surface Verification",
    "repairNotes": "Authority Repair Notes",
    "btnClose": "Close Tracker",
    "activeStage": "Active Stage",
    "closed": "Closed",
    "syncedConsole": "Synced with Municipal Dispatch Console"
  },
  "monitoring": {
    "cardTitle": "Post-Repair Quality Monitoring",
    "cycleProgress": "Observation Cycle Progress",
    "dayCount": "Day {current} of {total}",
    "daysRemaining": "({count} days remaining)",
    "currentResolution": "Current Resolution Level",
    "whyMonitoringTitle": "Why Post-Repair Monitoring?",
    "whyMonitoringText": "The repair has been completed on-site by the maintenance engineer. The road is now under a mandatory {days}-day observation period to ensure the patch holds under real-world traffic loads before the municipal authority grants 100% final resolution.",
    "whyReinspectionText": "Failure Flagged: Road damage was observed again during the post-repair monitoring period. The complaint has dropped to 50% resolution and returned to the queue for re-repair.",
    "noSensors": "Smartphone sensor observations: No sensor observations available yet.",
    "activeSensors": "Active Smartphone Telemetry: Accelerometer (|A|: {magnitude} m/s²) • Gyroscope Active",
    "badgeMonitoring": "Under Monitoring (90%)",
    "badgeConfirmation": "Confirmation Required",
    "badgePassed": "Passed & 100% Closed",
    "badgeFailed": "Failed — Reinspection Required",
    "btnConfirmFinal": "Confirm Final Resolution",
    "btnRequestReinspection": "Request Reinspection",
    "btnSimulate7": "+7 Days",
    "btnSimulateComplete": "Complete"
  },
  "authority": {
    "headerBadge": "AUTHORITY",
    "headerSubtitle": "AI-Assisted Road Maintenance Prioritization",
    "title": "What road damage requires attention first?",
    "subtitle": "Automated ranking powered by the MargDrishti explainable priority formula combining AI defect depth, road classification, transit traffic, and hospital/school risk.",
    "kpiTotal": "Total Reports",
    "kpiCritical": "Critical Priority (Score ≥80)",
    "kpiActive": "Active Work Orders",
    "kpiMonitoring": "Under Monitoring (90%)",
    "kpiResolved": "100% Fully Resolved",
    "repairsUnderMonitoring": "Repairs Under Post-Repair Monitoring",
    "monitoringSubtitle": "Repair Completed ≠ Fully Resolved: Roads undergo mandatory observation before final municipal closure to prevent premature patch degradation.",
    "monitoringConfigLabel": "POST_REPAIR_MONITORING_DAYS:",
    "daysDefault": "30 Days (Default)",
    "days45": "45 Days",
    "days60": "60 Days",
    "thComplaintLocation": "Complaint & Road Location",
    "thEngineer": "Responsible Engineer",
    "thRepairDate": "Repair Date",
    "thTimeline": "Monitoring Timeline",
    "thProgress": "Observation Progress",
    "thResolution": "Resolution Status",
    "thEvidence": "Road Condition & Sensor Evidence",
    "thActions": "Authority Action",
    "emptyMonitoring": "No repairs currently in post-repair monitoring. When an engineer marks 'Repair Completed', complaints enter the mandatory observation cycle here.",
    "queueTitle": "Priority Maintenance Queue (Ranked Highest First)",
    "tabAll": "All Reports",
    "tabCritical": "Critical (≥80)",
    "tabHigh": "High (60–79)",
    "tabAssigned": "Assigned",
    "tabResolved": "Resolved & Closed",
    "thRankScore": "Rank & Score",
    "thComplaintId": "Complaint ID",
    "thEvidenceType": "Evidence",
    "thDamageSeverity": "Damage & Severity",
    "thLocationWard": "Location & Ward",
    "thStatus": "Status",
    "thOfficer": "Assigned Officer",
    "btnInspect": "Inspect Report",
    "inspTitle": "Complaint Details & Vision AI Inspector",
    "inspEvidence": "1. Visual Evidence & Vision AI",
    "inspDiagnostics": "2. Defect Diagnostics",
    "inspPriority": "3. Explainable Priority Breakdown",
    "inspLocation": "4. Geolocation Context",
    "inspTimeline": "5. Maintenance Timeline",
    "btnVerify": "Verify Hazard Triage",
    "btnAssign": "Assign Engineer",
    "btnInProgress": "Mark In Progress",
    "btnRepairCompleted": "Mark Repair Completed (Enters Monitoring — 90%)",
    "btnConfirmFinal": "Confirm Final Resolution (100% Resolved)",
    "btnReinspect": "Request Reinspection (Damage Reappeared)",
    "modalAssignTitle": "Dispatch Maintenance Crew & Work Order",
    "modalResolveTitle": "Complete Road Repair & Upload Proof",
    "modalConfirmTitle": "Confirm Final Resolution (100% Closed)",
    "modalReinspectTitle": "Repair Failed — Request Reinspection",
    "btnCancel": "Cancel",
    "btnCloseModal": "Close Inspector"
  },
  "map": {
    "title": "Pothole Map & Pothole-Aware Navigation",
    "corridorBadge": "Bengaluru Corridor GIS",
    "tabExplore": "Explore Potholes",
    "tabRoute": "Find Best Route",
    "statActive": "ACTIVE",
    "statCritical": "CRITICAL",
    "statResolved": "RESOLVED",
    "visibleHazards": "{count} active hazards detected in visible area",
    "filterAll": "All",
    "filterActive": "Active",
    "filterCritical": "Critical",
    "filterHigh": "High",
    "filterMedium": "Medium",
    "filterResolved": "Resolved",
    "emptyHazards": "No road hazards match this filter.",
    "focusMap": "Focus On Map →",
    "routeTitle": "Find Safer, Smoother Route",
    "routeSubtitle": "Analyzes road defect density and severity along route alternatives to maximize safety score.",
    "demoCorridors": "Demo Route Corridors",
    "sourceLabel": "Origin / Start Location",
    "destLabel": "Destination Point",
    "modeSafest": "🛡️ Safest",
    "modeFastest": "⚡ Fastest",
    "modeBalanced": "⚖️ Balanced",
    "btnCalculate": "Calculate Pothole-Aware Routes",
    "safetyRating": "Safety: {score}/100",
    "routeSummary": "{distance} km • {mins} mins • {potholes} potholes",
    "legendTitle": "Road Damage Severity",
    "legendCritical": "Critical",
    "legendHigh": "High",
    "legendMedium": "Medium",
    "legendResolved": "Resolved",
    "popupPotholes": "Pothole Hazard",
    "popupView": "View Details"
  },
  "status": {
    "REPORTED": "Reported",
    "AI_ANALYZED": "AI Analyzed",
    "VERIFIED": "Verified",
    "ASSIGNED": "Assigned",
    "IN_PROGRESS": "In Progress",
    "REPAIR_COMPLETED": "Under Monitoring (90%)",
    "CONFIRMATION_REQUIRED": "Confirmation Required",
    "REINSPECTION_REQUIRED": "Reinspection Required",
    "RESOLVED": "100% Fully Resolved",
    "reported": "Reported",
    "analyzed": "AI Analyzed",
    "verified": "Verified",
    "assigned": "Assigned",
    "inProgress": "In Progress",
    "monitoring": "Under Monitoring (90%)",
    "confirmationRequired": "Confirmation Required",
    "reinspection": "Reinspection Required",
    "resolved": "100% Fully Resolved"
  },
  "priority": {
    "CRITICAL": "CRITICAL",
    "HIGH": "HIGH",
    "MEDIUM": "MEDIUM",
    "LOW": "LOW"
  },
  "severity": {
    "CRITICAL": "CRITICAL",
    "HIGH": "HIGH",
    "MEDIUM": "MEDIUM",
    "LOW": "LOW"
  },
  "damage": {
    "POTHOLE": "Pothole",
    "CRACK": "Road Crack"
  },
  "chatbot": {
    "launcherTitle": "AI Assistant",
    "headerTitle": "MargDrishti AI Assistant",
    "headerSubtitle": "Citizen Road Intelligence Support",
    "welcomeMessage": "Hello! I am the MargDrishti AI Assistant. I can help you report road damage, track complaints, understand AI priority scores, or explain post-repair monitoring.",
    "inputPlaceholder": "Ask your question in English, Hindi, or Marathi...",
    "send": "Send",
    "clear": "Clear",
    "chipReport": "How to report a pothole?",
    "chipTrack": "Where is my complaint?",
    "chipPriority": "Explain Priority Score",
    "chipMonitoring": "What does 90% Under Monitoring mean?",
    "chipMap": "How to use Pothole Map?",
    "btnOpenReport": "Open Report Road Damage",
    "btnOpenMap": "Open Pothole Map",
    "btnTrackComplaint": "Track Complaint"
  },
  "messages": {
    "toastLangChanged": "Language set to {lang}",
    "toastDemoReset": "Demo database reset to default seed records.",
    "toastReportSubmitted": "Report submitted with Complaint ID: {id}",
    "toastStatusUpdated": "Status updated to {status}",
    "toastVerified": "Complaint verified for maintenance triage.",
    "toastAssigned": "Work order assigned to {officer}.",
    "toastRepairCompleted": "Repair completed. Enters 30-day post-repair monitoring.",
    "toastConfirmed": "Final durability confirmed. 100% Fully Resolved.",
    "toastReinspection": "Reinspection requested. Sent back for re-repair.",
    "errorSelectImage": "Please select a photo or video evidence file.",
    "errorEnterLocation": "Please provide valid road location coordinates.",
    "errorNotFound": "Complaint {id} not found in the system.",
    "locAcquiredDevice": "Coordinates acquired via Device GPS.",
    "locAcquiredDemo": "Indiranagar demo coordinates applied."
  }
},
  hi: {
  "app": {
    "title": "मार्गदृष्टि",
    "tagline": "बेहतर सड़कें। सुरक्षित यात्रा।",
    "selectLanguage": "भाषा चुनें",
    "language": "भाषा",
    "home": "होम",
    "citizenDashboard": "नागरिक डैशबोर्ड",
    "authorityDashboard": "प्राधिकरण डैशबोर्ड",
    "potholeMap": "खड्डा मानचित्र एवं नेविगेशन",
    "resetDemoData": "डेमो डेटा रीसेट करें",
    "login": "लॉग इन",
    "signup": "साइन अप",
    "logout": "लॉग आउट",
    "aiVisionOnline": "एआई विज़न सक्रिय",
    "liveDemoTag": "एसआईएच 2026 लाइव डेमो",
    "trlTag": "टीआरएल 08 — सॉफ्टवेयर श्रेणी",
    "demoMode": "एआई विश्लेषण डेमो मोड",
    "authorityView": "प्राधिकरण दृश्य",
    "citizenView": "नागरिक दृश्य",
    "authorityRole": "नगर निगम अधिकारी",
    "citizenRole": "नागरिक खाता"
  },
  "nav": {
    "home": "होम",
    "citizenDashboard": "नागरिक डैशबोर्ड",
    "authorityDashboard": "प्राधिकरण डैशबोर्ड",
    "potholeMap": "खड्डा मानचित्र",
    "reportDamage": "+ सड़क क्षति रिपोर्ट करें",
    "searchComplaint": "ट्रैक करें",
    "searchPlaceholder": "शिकायत आईडी खोजें (उदा. MD-2026-0001)"
  },
  "hero": {
    "badge": "टीआरएल 08 — सॉफ्टवेयर श्रेणी",
    "demoBadge": "एआई विश्लेषण डेमो मोड",
    "titlePart1": "बेहतर सड़कें।",
    "titlePart2": "सुरक्षित यात्रा।",
    "subtitle": "तस्वीर या वीडियो के जरिए सड़क क्षति कैप्चर करें। एआई को खड्डों और दरारों का पता लगाने दें, स्थान पहचानें, प्राथमिकताओं का निर्धारण करें और सत्यापित समाधान तक मरम्मत को ट्रैक करें।",
    "ctaReport": "सड़क क्षति रिपोर्ट करें",
    "ctaAuthority": "प्राधिकरण डैशबोर्ड",
    "ctaMap": "खड्डा मानचित्र एवं मार्ग",
    "bullet1": "तस्वीर एवं डैशकैम वीडियो अनुमान",
    "bullet2": "व्याख्यात्मक प्राथमिकता स्कोर (0–100)",
    "bullet3": "वर्तमान जीपीएस एवं डेमो स्थान",
    "bullet4": "रीयल-टाइम मरम्मत ट्रैकिंग",
    "scanHint": "⚡ सड़क स्कैन शुरू करने के लिए क्लिक करें"
  },
  "process": {
    "capture": "कैप्चर",
    "detect": "पहचान",
    "locate": "स्थान",
    "prioritize": "प्राथमिकता",
    "track": "ट्रैक",
    "resolve": "समाधान"
  },
  "value": {
    "badge": "प्रमुख नवाचार",
    "title": "सिर्फ खड्डा डिटेक्टर से कहीं अधिक",
    "subtitle": "मार्गदृष्टि कंप्यूटर विज़न इंटेलिजेंस, पारदर्शी प्राथमिकता और प्रशासनिक कार्रवाई के बीच की दूरी समाप्त करती है।",
    "card1Title": "तस्वीर एवं वीडियो एआई डिटेक्शन",
    "card1Desc": "खड्डों और दरारों जैसे समर्थित नुकसान की सटीक पहचान के लिए सड़क की तस्वीरों या डैशकैम वीडियो का विश्लेषण करें।",
    "card2Title": "स्थान आसूचना (लोकेशन इंटेलिजेंस)",
    "card2Desc": "उच्च सटीकता के साथ उपयोगकर्ता का वर्तमान जीपीएस स्थान कैप्चर करें, प्रस्तुति के लिए विश्वसनीय डेमो स्थान के साथ।",
    "card3Title": "व्याख्यात्मक प्राथमिकता निर्धारण",
    "card3Desc": "एक पारदर्शी 6-कारक फॉर्मूला नुकसान की गंभीरता, सड़क के प्रकार, यातायात और नजदीकी संवेदनशील बुनियादी ढांचे का आकलन करता है।",
    "card4Title": "दो-चरणीय मरम्मत जवाबदेही",
    "card4Desc": "मरम्मत पूर्ण होने पर अनिवार्य निगरानी (९०%) शुरू होती है, जिसके बाद ही नगर निगम अंतिम १००% समाधान की पुष्टि करता है।"
  },
  "triage": {
    "badge": "लाइव ट्राइएज पूर्वावलोकन",
    "title": "उच्च-समवर्ती नगर निगम कतार",
    "subtitle": "वास्तविक सुरक्षा और यातायात जोखिमों के आधार पर मरम्मत को प्राथमिकता देने वाली प्रणाली।",
    "colId": "शिकायत आईडी",
    "colDamage": "नुकसान प्रकार",
    "colLocation": "स्थान",
    "colPriority": "प्राथमिकता",
    "colStatus": "स्थिति",
    "colDate": "दर्ज की गई"
  },
  "architecture": {
    "badge": "सिस्टम वास्तुकला",
    "title": "टीआरएल 08 उत्पादन पाइपलाइन",
    "subtitle": "मापनीय नगर निगम परिनियोजन के लिए डिज़ाइन की गई मॉड्यूलर एज-टू-क्लाउड वास्तुकला।",
    "step1Title": "1. एज डेटा अंतर्ग्रहण",
    "step1Desc": "नागरिकों की तस्वीरें, डैशकैम वीडियो और स्मार्टफोन सेंसर टेलीमेट्री।",
    "step2Title": "2. विज़न एवं सेंसर एकीकरण",
    "step2Desc": "एक्सेलेरोमीटर कंपन स्पाइक्स के साथ सहसंबद्ध YOLO11 न्यूरल डिटेक्शन।",
    "step3Title": "3. प्राथमिकता मैट्रिक्स",
    "step3Desc": "संरचनात्मक गहराई, यातायात की मात्रा और संवेदनशील क्षेत्रों को संतुलित करने वाली रैंकिंग।",
    "step4Title": "4. प्रेषण एवं दो-चरणीय सत्यापन",
    "step4Desc": "मरम्मत दल की तैनाती के बाद 30 दिनों का अनिवार्य निगरानी अवलोकन चक्र।"
  },
  "footer": {
    "title": "मार्गदृष्टि",
    "tagline": "बेहतर सड़कें। सुरक्षित यात्रा।",
    "hackathonTag": "स्मार्ट इंडिया हैकाथॉन प्रोटोटाइप",
    "demoDataMode": "डेमो डेटा मोड",
    "yoloModel": "YOLO11 मॉडल सिमुलेशन"
  },
  "auth": {
    "portalCitizen": "नागरिक पोर्टल",
    "portalAuthority": "नगर निगम प्रेषण कंसोल",
    "title": "अपने मार्गदृष्टि खाते में प्रवेश करें",
    "tabCitizen": "नागरिक",
    "tabAuthority": "नगर निगम प्राधिकरण",
    "loginTab": "लॉग इन",
    "signupTab": "खाता बनाएं",
    "fullName": "पूरा नाम",
    "email": "ईमेल पता",
    "password": "पासवर्ड",
    "confirmPassword": "पासवर्ड की पुष्टि करें",
    "department": "नगर निगम विभाग / प्रभाग",
    "designation": "पदनाम",
    "zone": "आवंटित नगर निगम क्षेत्र / ज़ोन",
    "roadType": "सड़क क्षेत्राधिकार वर्गीकरण",
    "respAuthority": "उत्तरदायी प्राधिकरण",
    "btnLogin": "खाते में लॉग इन करें",
    "btnSignup": "नागरिक खाता बनाएं",
    "btnSignupAuthority": "प्राधिकरण अधिकारी पंजीकृत करें",
    "noAccount": "खाता नहीं है?",
    "haveAccount": "पहले से खाता है?",
    "signupLink": "साइन अप करें",
    "loginLink": "लॉग इन करें"
  },
  "citizen": {
    "portalBadge": "नागरिक पोर्टल",
    "demoMode": "एआई विश्लेषण डेमो मोड",
    "heroTitle": "अपनी सड़कों को सुरक्षित बनाएं",
    "heroSubtitle": "तस्वीर या वीडियो के माध्यम से खड्डों या दरारों की रिपोर्ट करें और अपने समुदाय की सड़कों को बेहतर बनाने में मदद करें।",
    "totalReports": "कुल रिपोर्ट",
    "pendingTriage": "लंबित समीक्षा",
    "inProgress": "कार्य प्रगति पर",
    "resolvedVerified": "सत्यापित एवं समाधानित",
    "myReports": "मेरी सड़क क्षति रिपोर्ट",
    "subTitleReports": "स्थानीय डेटा संग्रहण",
    "subAcross": "इंदिरानगर एवं मेट्रो कॉरिडोर भर में",
    "subAwaiting": "प्राधिकरण प्रेषण की प्रतीक्षा में",
    "subSquads": "मरम्मत दल स्थल पर सक्रिय",
    "subConfirmed": "नगर निगम प्राधिकरण द्वारा पुष्ट",
    "btnReportDamage": "+ सड़क क्षति रिपोर्ट करें",
    "colId": "शिकायत आईडी",
    "colEvidence": "साक्ष्य",
    "colDamage": "नुकसान प्रकार",
    "colLocation": "स्थान",
    "colPriority": "प्राथमिकता स्कोर",
    "colStatus": "स्थिति",
    "colDate": "दिनांक",
    "colActions": "कार्रवाई",
    "emptyReports": "अभी तक कोई रिपोर्ट दर्ज नहीं की गई है। पहली रिपोर्ट दर्ज करने के लिए '+ सड़क क्षति रिपोर्ट करें' पर क्लिक करें।",
    "btnTrack": "ट्रैक करें"
  },
  "wizard": {
    "modalTitle": "सड़क क्षति की रिपोर्ट करें",
    "modalSubtitle": "मार्गदर्शित एआई क्षति पहचान, वर्तमान स्थान एवं व्याख्यात्मक प्राथमिकता।",
    "step1": "1. साक्ष्य",
    "step2": "2. स्थान",
    "step3": "3. विवरण एवं एआई",
    "photoEvidence": "फोटो साक्ष्य (JPG/PNG)",
    "videoEvidence": "डैशकैम वीडियो (MP4/WebM)",
    "dropzoneText": "फ़ाइल चुनने के लिए क्लिक करें या यहाँ खींचें",
    "dropzoneDesc": "JPEG, PNG या WEBP (अधिकतम 10MB)",
    "quickPresets": "⚡ त्वरित डेमो मीडिया (त्वरित एसआईएच डेमो):",
    "presetPothole": "गंभीर इंदिरानगर खड्डा",
    "presetCrack": "होसूर रोड दरारें",
    "presetVideo": "डैशकैम रोड वीडियो (14 सेकंड)",
    "previewValid": "✓ रिज़ॉल्यूशन मान्य • YOLO11 पहचान के लिए तैयार",
    "btnToStep2": "आगे: स्थान निर्धारण",
    "locationTitle": "स्थान एवं भौगोलिक आसूचना",
    "locationSubtitle": "वर्तमान जीपीएस निर्देशांक कैप्चर करें या सत्यापित स्मार्ट सिटी डेमो स्थान का उपयोग करें।",
    "btnCurrentLocation": "वर्तमान स्थान का उपयोग करें",
    "btnDemoLocation": "डेमो स्थान",
    "roadName": "सड़क / मार्ग का नाम",
    "wardSector": "वार्ड / नगर निगम सेक्टर",
    "landmark": "प्रमुख लैंडमार्क",
    "gpsCoordinates": "जीपीएस निर्देशांक",
    "demoLocBadge": "डेमो स्थान",
    "sensorsTitle": "स्मार्टफोन सेंसर टेलीमेट्री",
    "sensorsSubtitle": "हार्डवेयर वेब एपीआई",
    "btnEnableSensors": "मोशन सेंसर सक्रिय करें",
    "accel": "एक्सेलेरोमीटर",
    "gyro": "गायरोस्कोप",
    "gps": "जीपीएस",
    "checking": "हार्डवेयर समर्थन जांचा जा रहा है...",
    "available": "उपलब्ध",
    "unavailable": "इस डिवाइस पर अनुपलब्ध",
    "sensorHonestyDesc": "लाइव हार्डवेयर टेलीमेट्री। डेस्कटॉप ब्राउज़र पर सेंसर न होने की स्थिति में एसआईएच दिशानिर्देशों के अनुसार 'अनुपलब्ध' प्रदर्शित होता है।",
    "btnBack": "पीछे",
    "btnToStep3": "आगे: सड़क संदर्भ एवं एआई विश्लेषण",
    "hazardDesc": "क्षति विवरण (वैकल्पिक)",
    "hazardPlaceholder": "उदा. ट्रैफिक सिग्नल के तुरंत बाद गहरा खड्डा, दोपहिया वाहनों के फिसलने का अत्यधिक खतरा...",
    "roadClassification": "सड़क का वर्गीकरण",
    "arterial": "प्रमुख धमनी मार्ग (उच्च यातायात)",
    "highway": "राज्य / राष्ट्रीय राजमार्ग लिंक",
    "collector": "कलेक्टर / उप-धमनी मार्ग",
    "local": "स्थानीय आवासीय सड़क",
    "trafficExposure": "यातायात घनत्व",
    "trafficHigh": "उच्च (बस मार्ग / व्यस्त समय)",
    "trafficMedium": "मध्यम (सामान्य स्थानीय यातायात)",
    "trafficLow": "कम (शांत आवासीय क्षेत्र)",
    "sensitiveInfra": "नजदीकी संवेदनशील बुनियादी ढांचा (लागू होने वाले सभी चुनें)",
    "schoolZone": "स्कूल / कॉलेज क्षेत्र",
    "hospitalRoute": "अस्पताल आपातकालीन मार्ग",
    "metroTransit": "मेट्रो / बस इंटरचेंज",
    "waterlogging": "जलभराव संभावित क्षेत्र",
    "btnRunScan": "YOLO11 एआई विश्लेषण एवं प्राथमिकता प्रारंभ करें",
    "scanningTitle": "YOLO11 न्यूरल नेटवर्क विश्लेषण प्रगति पर है...",
    "scanningSubtitle": "बाउंडिंग बॉक्स, वर्ग लेबल और स्थानिक गंभीरता सूचकांक का निष्कर्षण",
    "priorityIndex": "प्राथमिकता सूचकांक",
    "topQueue": "शीर्ष रखरखाव कतार",
    "damageDetected": "पहचाना गया नुकसान",
    "confidence": "सटीकता / विश्वास",
    "severity": "गंभीरता",
    "model": "मॉडल",
    "explainableModel": "प्रोटोटाइप व्याख्यात्मक प्राथमिकता मॉडल (भार):",
    "weightSeverity": "1. क्षति गंभीरता (30%)",
    "weightExtent": "2. क्षति विस्तार (20%)",
    "weightRoad": "3. सड़क का महत्व (20%)",
    "weightTraffic": "4. यातायात जोखिम (10%)",
    "weightSensitive": "5. संवेदनशील क्षेत्र जोखिम (10%)",
    "weightCorroboration": "6. पुष्टिकारी साक्ष्य (10%)",
    "btnSubmit": "आधिकारिक सड़क क्षति रिपोर्ट जमा करें"
  },
  "success": {
    "title": "रिपोर्ट सफलतापूर्वक दर्ज की गई!",
    "subtitle": "आपकी रिपोर्ट को प्राथमिकता दी गई है और इसे नगर निगम रखरखाव कतार में जोड़ दिया गया है।",
    "trackingId": "आधिकारिक ट्रैकिंग आईडी",
    "btnTrack": "शिकायत की स्थिति ट्रैक करें",
    "btnBack": "डैशबोर्ड पर लौटें"
  },
  "tracking": {
    "modalTitle": "शिकायत ट्रैकिंग कंसोल",
    "liveSync": "लाइव स्थिति समन्वय",
    "timelineTitle": "रखरखाव प्रगति समयरेखा",
    "assignedOfficer": "आवंटित अधिकारी",
    "resolutionLevel": "समाधान स्तर",
    "initialEvidence": "प्रारंभिक क्षति साक्ष्य",
    "postRepairEvidence": "मरम्मत पश्चात सतह सत्यापन",
    "repairNotes": "प्राधिकरण मरम्मत टिप्पणियां",
    "btnClose": "ट्रैकर बंद करें",
    "activeStage": "सक्रिय चरण",
    "closed": "समाप्त",
    "syncedConsole": "नगर निगम प्रेषण कंसोल के साथ समन्वित"
  },
  "monitoring": {
    "cardTitle": "मरम्मत पश्चात गुणवत्ता निगरानी",
    "cycleProgress": "अवलोकन चक्र प्रगति",
    "dayCount": "दिन {current} / {total}",
    "daysRemaining": "({count} दिन शेष)",
    "currentResolution": "वर्तमान समाधान स्तर",
    "whyMonitoringTitle": "मरम्मत पश्चात निगरानी क्यों?",
    "whyMonitoringText": "अभियंता द्वारा मरम्मत पूरी कर ली गई है। वास्तविक यातायात में मरम्मत की मजबूती सुनिश्चित करने के लिए सड़क अब {days} दिनों के अनिवार्य अवलोकन के अधीन है, जिसके बाद ही अंतिम १००% पुष्टि होगी।",
    "whyReinspectionText": "विफलता दर्ज: निगरानी अवधि के दौरान सड़क क्षति फिर से देखी गई। शिकायत का समाधान ५०% पर आ गया है और इसे पुनः मरम्मत के लिए भेज दिया गया है।",
    "noSensors": "स्मार्टफोन सेंसर अवलोकन: अभी तक कोई सेंसर अवलोकन उपलब्ध नहीं है।",
    "activeSensors": "सक्रिय स्मार्टफोन टेलीमेट्री: एक्सेलेरोमीटर (|A|: {magnitude} m/s²) • गायरोस्कोप सक्रिय",
    "badgeMonitoring": "निगरानी में (९०%)",
    "badgeConfirmation": "पुष्टि आवश्यक",
    "badgePassed": "सफल एवं १००% समाप्त",
    "badgeFailed": "विफल — पुनरीक्षण आवश्यक",
    "btnConfirmFinal": "अंतिम समाधान की पुष्टि करें",
    "btnRequestReinspection": "पुनरीक्षण का अनुरोध करें",
    "btnSimulate7": "+7 दिन",
    "btnSimulateComplete": "अवधि पूर्ण"
  },
  "authority": {
    "headerBadge": "प्राधिकरण",
    "headerSubtitle": "एआई-सहायता प्राप्त सड़क रखरखाव प्राथमिकता",
    "title": "किस सड़क क्षति पर पहले ध्यान देने की आवश्यकता है?",
    "subtitle": "मार्गदृष्टि व्याख्यात्मक प्राथमिकता सूत्र द्वारा स्वचालित रैंकिंग, जो एआई दोष गहराई, सड़क प्रकार, यातायात और अस्पताल/स्कूल जोखिम को जोड़ती है।",
    "kpiTotal": "कुल रिपोर्ट",
    "kpiCritical": "अति गंभीर प्राथमिकता (स्कोर ≥80)",
    "kpiActive": "सक्रिय कार्य आदेश",
    "kpiMonitoring": "निगरानी में (९०%)",
    "kpiResolved": "१००% पूरी तरह हल किया गया",
    "repairsUnderMonitoring": "मरम्मत पश्चात गुणवत्ता निगरानी अधीन कार्य",
    "monitoringSubtitle": "मरम्मत पूर्ण ≠ अंतिम समाधान: समय से पहले मरम्मत खराब होने से रोकने के लिए सड़कों का अनिवार्य अवलोकन किया जाता है।",
    "monitoringConfigLabel": "निगरानी अवधि:",
    "daysDefault": "30 दिन (डिफ़ॉल्ट)",
    "days45": "45 दिन",
    "days60": "60 दिन",
    "thComplaintLocation": "शिकायत एवं सड़क का स्थान",
    "thEngineer": "उत्तरदायी अभियंता",
    "thRepairDate": "मरम्मत पूर्ण दिनांक",
    "thTimeline": "निगरानी समयरेखा",
    "thProgress": "अवलोकन प्रगति",
    "thResolution": "समाधान स्थिति",
    "thEvidence": "सड़क स्थिति एवं सेंसर साक्ष्य",
    "thActions": "प्राधिकरण कार्रवाई",
    "emptyMonitoring": "वर्तमान में निगरानी में कोई मरम्मत नहीं है। जब अभियंता 'मरम्मत पूर्ण' चिह्नित करते हैं, तो शिकायतें यहाँ निगरानी चक्र में प्रवेश करती हैं।",
    "queueTitle": "प्राथमिकता रखरखाव कतार (उच्चतम रैंक पहले)",
    "tabAll": "सभी रिपोर्ट",
    "tabCritical": "अति गंभीर (≥80)",
    "tabHigh": "उच्च (60–79)",
    "tabAssigned": "अधिकारी नियुक्त",
    "tabResolved": "समाधानित एवं बंद",
    "thRankScore": "रैंक एवं स्कोर",
    "thComplaintId": "शिकायत आईडी",
    "thEvidenceType": "साक्ष्य प्रकार",
    "thDamageSeverity": "नुकसान एवं गंभीरता",
    "thLocationWard": "स्थान एवं वार्ड",
    "thStatus": "स्थिति",
    "thOfficer": "नियुक्त अधिकारी",
    "btnInspect": "रिपोर्ट का निरीक्षण करें",
    "inspTitle": "शिकायत विवरण एवं विज़न एआई निरीक्षक",
    "inspEvidence": "1. दृश्य साक्ष्य एवं विज़न एआई",
    "inspDiagnostics": "2. दोष निदान",
    "inspPriority": "3. व्याख्यात्मक प्राथमिकता विवरण",
    "inspLocation": "4. भौगोलिक संदर्भ",
    "inspTimeline": "5. रखरखाव समयरेखा",
    "btnVerify": "क्षति ट्राइएज सत्यापित करें",
    "btnAssign": "अभियंता नियुक्त करें",
    "btnInProgress": "प्रगति में चिह्नित करें",
    "btnRepairCompleted": "मरम्मत पूर्ण चिह्नित करें (९०% निगरानी में)",
    "btnConfirmFinal": "अंतिम समाधान की पुष्टि करें (१००% हल)",
    "btnReinspect": "पुनरीक्षण का अनुरोध करें (नुकसान पुनः दिखा)",
    "modalAssignTitle": "मरम्मत दल एवं कार्य आदेश प्रेषित करें",
    "modalResolveTitle": "सड़क मरम्मत पूरी करें और साक्ष्य अपलोड करें",
    "modalConfirmTitle": "अंतिम समाधान की पुष्टि करें (१००% बंद)",
    "modalReinspectTitle": "मरम्मत विफल — पुनरीक्षण का अनुरोध करें",
    "btnCancel": "रद्द करें",
    "btnCloseModal": "निरीक्षक बंद करें"
  },
  "map": {
    "title": "खड्डा मानचित्र एवं नेविगेशन",
    "corridorBadge": "बेंगलुरु कॉरिडोर जीआईएस",
    "tabExplore": "खड्डे देखें",
    "tabRoute": "सुरक्षित मार्ग खोजें",
    "statActive": "सक्रिय",
    "statCritical": "अति गंभीर",
    "statResolved": "समाधानित",
    "visibleHazards": "दृश्य क्षेत्र में {count} सक्रिय खड्डे पाए गए",
    "filterAll": "सभी",
    "filterActive": "सक्रिय",
    "filterCritical": "अति गंभीर",
    "filterHigh": "उच्च",
    "filterMedium": "मध्यम",
    "filterResolved": "समाधानित",
    "emptyHazards": "इस फ़िल्टर से मेल खाता कोई सड़क जोखिम नहीं मिला।",
    "focusMap": "मानचित्र पर देखें →",
    "routeTitle": "सुरक्षित एवं सुगम मार्ग खोजें",
    "routeSubtitle": "सुरक्षा स्कोर अधिकतम करने के लिए विभिन्न मार्गों पर खड्डों के घनत्व और गंभीरता का विश्लेषण करता है।",
    "demoCorridors": "डेमो मार्ग कॉरिडोर",
    "sourceLabel": "प्रारंभिक स्थान",
    "destLabel": "गंतव्य स्थान",
    "modeSafest": "🛡️ सबसे सुरक्षित",
    "modeFastest": "⚡ सबसे तेज़",
    "modeBalanced": "⚖️ संतुलित",
    "btnCalculate": "खड्डा-जागरूक मार्गों की गणना करें",
    "safetyRating": "सुरक्षा स्कोर: {score}/100",
    "routeSummary": "{distance} किमी • {mins} मिनट • {potholes} खड्डे",
    "legendTitle": "सड़क क्षति गंभीरता",
    "legendCritical": "अति गंभीर",
    "legendHigh": "उच्च",
    "legendMedium": "मध्यम",
    "legendResolved": "समाधानित",
    "popupPotholes": "खड्डा जोखिम",
    "popupView": "विवरण देखें"
  },
  "status": {
    "REPORTED": "दर्ज की गई",
    "AI_ANALYZED": "एआई विश्लेषित",
    "VERIFIED": "सत्यापित",
    "ASSIGNED": "अधिकारी नियुक्त",
    "IN_PROGRESS": "कार्य प्रगति पर",
    "REPAIR_COMPLETED": "निगरानी में (९०%)",
    "CONFIRMATION_REQUIRED": "पुष्टि आवश्यक",
    "REINSPECTION_REQUIRED": "पुनरीक्षण आवश्यक",
    "RESOLVED": "१००% पूरी तरह हल किया गया",
    "reported": "दर्ज की गई",
    "analyzed": "एआई विश्लेषित",
    "verified": "सत्यापित",
    "assigned": "अधिकारी नियुक्त",
    "inProgress": "कार्य प्रगति पर",
    "monitoring": "निगरानी में (९०%)",
    "confirmationRequired": "पुष्टि आवश्यक",
    "reinspection": "पुनरीक्षण आवश्यक",
    "resolved": "१००% पूरी तरह हल किया गया"
  },
  "priority": {
    "CRITICAL": "अति गंभीर",
    "HIGH": "उच्च",
    "MEDIUM": "मध्यम",
    "LOW": "निम्न"
  },
  "severity": {
    "CRITICAL": "अति गंभीर",
    "HIGH": "उच्च",
    "MEDIUM": "मध्यम",
    "LOW": "निम्न"
  },
  "damage": {
    "POTHOLE": "खड्डा",
    "CRACK": "सड़क दरार"
  },
  "chatbot": {
    "launcherTitle": "एआई सहायक",
    "headerTitle": "मार्गदृष्टि एआई सहायक",
    "headerSubtitle": "नागरिक सड़क सहायता एवं मार्गदर्शन",
    "welcomeMessage": "नमस्ते! मैं मार्गदृष्टि एआई सहायक हूँ। आप मुझसे सड़क क्षति की रिपोर्ट करने, शिकायत ट्रैक करने, प्राथमिकता स्कोर समझने या सुरक्षित मार्ग खोजने में सहायता ले सकते हैं।",
    "inputPlaceholder": "हिंदी, English या मराठी में पूछें...",
    "send": "भेजें",
    "clear": "साफ़ करें",
    "chipReport": "खड्डे की शिकायत कैसे करें?",
    "chipTrack": "मेरी शिकायत कहाँ है?",
    "chipPriority": "प्राथमिकता स्कोर समझाएं",
    "chipMonitoring": "९०% निगरानी का क्या अर्थ है?",
    "chipMap": "खड्डा मानचित्र का उपयोग कैसे करें?",
    "btnOpenReport": "सड़क क्षति रिपोर्ट खोलें",
    "btnOpenMap": "खड्डा मानचित्र खोलें",
    "btnTrackComplaint": "शिकायत ट्रैक करें"
  },
  "messages": {
    "toastLangChanged": "भाषा बदलकर {lang} कर दी गई है",
    "toastDemoReset": "डेमो डेटाबेस डिफ़ॉल्ट स्थिति में रीसेट कर दिया गया है।",
    "toastReportSubmitted": "शिकायत आईडी {id} के साथ रिपोर्ट दर्ज की गई।",
    "toastStatusUpdated": "स्थिति बदलकर {status} कर दी गई है।",
    "toastVerified": "रखरखाव ट्राइएज के लिए शिकायत सत्यापित की गई।",
    "toastAssigned": "कार्य आदेश {officer} को सौंपा गया।",
    "toastRepairCompleted": "मरम्मत पूर्ण। 30-दिवसीय निगरानी अवधि शुरू।",
    "toastConfirmed": "स्थायित्व की पुष्टि। १००% पूरी तरह हल किया गया।",
    "toastReinspection": "पुनरीक्षण अनुरोधित। पुनः मरम्मत के लिए भेजा गया।",
    "errorSelectImage": "कृपया एक फोटो या वीडियो साक्ष्य फ़ाइल चुनें।",
    "errorEnterLocation": "कृपया मान्य सड़क स्थान निर्देशांक प्रदान करें।",
    "errorNotFound": "सिस्टम में शिकायत {id} नहीं मिली।",
    "locAcquiredDevice": "डिवाइस जीपीएस द्वारा निर्देशांक प्राप्त किए गए।",
    "locAcquiredDemo": "इंदिरानगर डेमो निर्देशांक लागू किए गए।"
  }
},
  mr: {
  "app": {
    "title": "मार्गदृष्टी",
    "tagline": "स्मार्ट रस्ते। सुरक्षित प्रवास।",
    "selectLanguage": "भाषा निवडा",
    "language": "भाषा",
    "home": "मुख्यपृष्ठ",
    "citizenDashboard": "नागरिक डॅशबोर्ड",
    "authorityDashboard": "प्राधिकरण डॅशबोर्ड",
    "potholeMap": "खड्डे नकाशा आणि नेव्हिगेशन",
    "resetDemoData": "डेमो डेटा रीसेट करा",
    "login": "लॉग इन",
    "signup": "नोंदणी करा",
    "logout": "लॉग आउट",
    "aiVisionOnline": "एआय व्हिजन सक्रिय",
    "liveDemoTag": "एसआयएच 2026 थेट डेमो",
    "trlTag": "टीआरएल 08 — सॉफ्टवेअर श्रेणी",
    "demoMode": "एआय विश्लेषण डेमो मोड",
    "authorityView": "प्राधिकरण दृश्य",
    "citizenView": "नागरिक दृश्य",
    "authorityRole": "महानगरपालिका अधिकारी",
    "citizenRole": "नागरिक खाते"
  },
  "nav": {
    "home": "मुख्यपृष्ठ",
    "citizenDashboard": "नागरिक डॅशबोर्ड",
    "authorityDashboard": "प्राधिकरण डॅशबोर्ड",
    "potholeMap": "खड्डे नकाशा",
    "reportDamage": "+ रस्त्यावरील नुकसान नोंदवा",
    "searchComplaint": "तक्रार ट्रॅक करा",
    "searchPlaceholder": "तक्रार आयडी शोधा (उदा. MD-2026-0001)"
  },
  "hero": {
    "badge": "टीआरएल 08 — सॉफ्टवेअर श्रेणी",
    "demoBadge": "एआय विश्लेषण डेमो मोड",
    "titlePart1": "स्मार्ट रस्ते।",
    "titlePart2": "सुरक्षित प्रवास।",
    "subtitle": "फोटो किंवा व्हिडिओद्वारे रस्त्यावरील नुकसान नोंदवा. एआय द्वारे खड्डे आणि भेगा ओळखा, अचूक स्थान मिळवा, प्राधान्यक्रम ठरवा आणि पडताळणीसह दुरुस्ती ट्रॅक करा.",
    "ctaReport": "रस्त्यावरील नुकसान नोंदवा",
    "ctaAuthority": "प्राधिकरण डॅशबोर्ड",
    "ctaMap": "खड्डे नकाशा आणि मार्ग",
    "bullet1": "फोटो व डॅशकॅम व्हिडिओ विश्लेषण",
    "bullet2": "पारदर्शक प्राधान्य गुण (0–100)",
    "bullet3": "थेट जीपीएस व अचूक स्थान",
    "bullet4": "रिअल-टाइम दुरुस्ती ट्रॅकिंग",
    "scanHint": "⚡ रस्ता स्कॅन करण्यासाठी क्लिक करा"
  },
  "process": {
    "capture": "कॅप्चर",
    "detect": "शोध",
    "locate": "स्थान",
    "prioritize": "प्राधान्य",
    "track": "ट्रॅक",
    "resolve": "निराकरण"
  },
  "value": {
    "badge": "प्रमुख नवोपक्रम",
    "title": "फक्त खड्डे शोधण्यापेक्षा बरेच काही",
    "subtitle": "मार्गदृष्टी संगणकीय दृष्टी, पारदर्शक प्राधान्य आणि प्रशासकीय कारवाई यांचा समन्वय साधते.",
    "card1Title": "फोटो व व्हिडिओ एआय तपासणी",
    "card1Desc": "खड्डे आणि भेगा अचूकपणे ओळखण्यासाठी रस्त्यांचे फोटो किंवा डॅशकॅम व्हिडिओंचे विश्लेषण करा.",
    "card2Title": "स्थान आसूचना (लोकेशन इंटेलिजन्स)",
    "card2Desc": "अचूक जीपीएस स्थान मिळवा आणि सादरीकरणासाठी विश्वसनीय डेमो स्थानाचा वापर करा.",
    "card3Title": "पारदर्शक प्राधान्यक्रम",
    "card3Desc": "खड्ड्याची खोली, रस्त्याचा प्रकार, वाहतूक आणि संवेदनशील परिसराचा विचार करणारा ६-घटक फॉर्म्युला.",
    "card4Title": "दोन-टप्प्यांची दुरुस्ती जबाबदारी",
    "card4Desc": "दुरुस्ती पूर्ण झाल्यावर अनिवार्य ३० दिवसांचे निरीक्षण (९०%) सुरू होते, त्यानंतरच १००% अंतिम मान्यता मिळते."
  },
  "triage": {
    "badge": "थेट ट्राइएज पूर्वावलोकन",
    "title": "महानगरपालिका दुरुस्ती रांग",
    "subtitle": "सुरक्षा आणि वाहतूक जोखमीवर आधारित दुरुस्ती कामांना प्राधान्य देणारी थेट प्रणाली.",
    "colId": "तक्रार आयडी",
    "colDamage": "नुकसान प्रकार",
    "colLocation": "स्थान",
    "colPriority": "प्राधान्य",
    "colStatus": "स्थिती",
    "colDate": "नोंदणी तारीख"
  },
  "architecture": {
    "badge": "प्रणाली रचना",
    "title": "टीआरएल 08 उत्पादन पाइपलाइन",
    "subtitle": "महानगरपालिकांच्या गरजेनुसार तयार केलेली मॉड्यूलर एज-टू-क्लाउड रचना.",
    "step1Title": "1. डेटा संकलन",
    "step1Desc": "नागरिकांचे फोटो, डॅशकॅम व्हिडिओ आणि स्मार्टफोन सेन्सर टेलिमेट्री.",
    "step2Title": "2. व्हिजन व सेन्सर एकत्रीकरण",
    "step2Desc": "अ‍ॅक्सलेरोमीटर कंपनांशी जोडलेली YOLO11 न्यूरल तपासणी.",
    "step3Title": "3. प्राधान्य मॅट्रिक्स",
    "step3Desc": "रस्त्याचे महत्त्व, वाहतूक आणि शाळा-रुग्णालय परिसराचा समतोल राखणारी क्रमवारी.",
    "step4Title": "4. दुरुस्ती व दोन-टप्प्यांची पडताळणी",
    "step4Desc": "अभियंत्यांची नियुक्ती आणि त्यानंतर ३० दिवसांचे अनिवार्य निरीक्षण."
  },
  "footer": {
    "title": "मार्गदृष्टी",
    "tagline": "स्मार्ट रस्ते। सुरक्षित प्रवास।",
    "hackathonTag": "स्मार्ट इंडिया हॅकाथॉन प्रोटोटाइप",
    "demoDataMode": "डेमो डेटा मोड",
    "yoloModel": "YOLO11 मॉडेल सिम्युलेशन"
  },
  "auth": {
    "portalCitizen": "नागरिक पोर्टल",
    "portalAuthority": "महानगरपालिका प्रेषण कन्सोल",
    "title": "आपल्या मार्गदृष्टी खात्यात प्रवेश करा",
    "tabCitizen": "नागरिक",
    "tabAuthority": "महानगरपालिका प्राधिकरण",
    "loginTab": "लॉग इन",
    "signupTab": "नोंदणी करा",
    "fullName": "पूर्ण नाव",
    "email": "ईमेल पत्ता",
    "password": "पासवर्ड",
    "confirmPassword": "पासवर्ड पुष्टी",
    "department": "महानगरपालिका विभाग / प्रभाग",
    "designation": "पदनाम",
    "zone": "नेमून दिलेला झोन / प्रभाग",
    "roadType": "रस्ता अधिकार क्षेत्र वर्गीकरण",
    "respAuthority": "जबाबदार प्राधिकरण",
    "btnLogin": "खात्यात लॉग इन करा",
    "btnSignup": "नागरिक खाते तयार करा",
    "btnSignupAuthority": "प्राधिकरण अधिकारी नोंदणी करा",
    "noAccount": "खाते नाही का?",
    "haveAccount": "आधीच खाते आहे?",
    "signupLink": "नोंदणी करा",
    "loginLink": "लॉग इन करा"
  },
  "citizen": {
    "portalBadge": "नागरिक पोर्टल",
    "demoMode": "एआय विश्लेषण डेमो मोड",
    "heroTitle": "आपले रस्ते अधिक सुरक्षित करा",
    "heroSubtitle": "फोटो किंवा व्हिडिओद्वारे खड्डे किंवा भेगांची तक्रार नोंदवा आणि परिसरातील रस्ते सुधारण्यास मदत करा.",
    "totalReports": "एकूण तक्रारी",
    "pendingTriage": "पडताळणी प्रलंबित",
    "inProgress": "काम प्रगतीपथावर",
    "resolvedVerified": "निराकरण व पडताळणी पूर्ण",
    "myReports": "माझ्या नोंदवलेल्या तक्रारी",
    "subTitleReports": "स्थानिक डेटा स्टोरेज",
    "subAcross": "इंदिरानगर आणि मेट्रो कॉरिडोअर परिसरात",
    "subAwaiting": "प्राधिकरणाच्या कारवाईची प्रतीक्षा",
    "subSquads": "दुरुस्ती पथक घटनास्थळी कार्यरत",
    "subConfirmed": "महानगरपालिकेने पुष्टी केली",
    "btnReportDamage": "+ रस्त्यावरील नुकसान नोंदवा",
    "colId": "तक्रार आयडी",
    "colEvidence": "पुरावा",
    "colDamage": "नुकसान प्रकार",
    "colLocation": "स्थान",
    "colPriority": "प्राधान्य गुण",
    "colStatus": "स्थिती",
    "colDate": "तारीख",
    "colActions": "कार्रवाई",
    "emptyReports": "अद्याप कोणतीही तक्रार नोंदवलेली नाही. पहिली तक्रार नोंदवण्यासाठी '+ रस्त्यावरील नुकसान नोंदवा' वर क्लिक करा.",
    "btnTrack": "ट्रॅक करा"
  },
  "wizard": {
    "modalTitle": "रस्त्यावरील नुकसानीची तक्रार नोंदवा",
    "modalSubtitle": "मार्गदर्शित एआय तपासणी, चालू स्थान आणि पारदर्शक प्राधान्यक्रम.",
    "step1": "1. पुरावा",
    "step2": "2. स्थान",
    "step3": "3. तपशील व एआय",
    "photoEvidence": "फोटो पुरावा (JPG/PNG)",
    "videoEvidence": "डॅशकॅम व्हिडिओ (MP4/WebM)",
    "dropzoneText": "फाइल निवडण्यासाठी क्लिक करा किंवा येथे ड्रॅग करा",
    "dropzoneDesc": "JPEG, PNG किंवा WEBP (कमाल 10MB)",
    "quickPresets": "⚡ त्वरित डेमो मीडिया (थेट एसआयएच डेमो):",
    "presetPothole": "इंदिरानगरमधील खोल खड्डा",
    "presetCrack": "होसूर रोडवरील भेगा",
    "presetVideo": "डॅशकॅम रस्ता व्हिडिओ (14 सेकंद)",
    "previewValid": "✓ रिझोल्यूशन वैध • YOLO11 तपासणीसाठी सज्ज",
    "btnToStep2": "पुढे: स्थान निश्चिती",
    "locationTitle": "स्थान व भौगोलिक आसूचना",
    "locationSubtitle": "चालू जीपीएस स्थान मिळवा किंवा सत्यापित डेमो स्थानाचा वापर करा.",
    "btnCurrentLocation": "चालू स्थान वापरा",
    "btnDemoLocation": "डेमो स्थान वापरा",
    "roadName": "रस्ता / गल्लीचे नाव",
    "wardSector": "प्रभाग / वॉर्ड क्रमांक",
    "landmark": "जवळची महत्त्वाची खूण",
    "gpsCoordinates": "जीपीएस अक्षांश-रेखांश",
    "demoLocBadge": "डेमो स्थान",
    "sensorsTitle": "स्मार्टफोन सेन्सर टेलिमेट्री",
    "sensorsSubtitle": "हार्डवेअर वेब एपीआय",
    "btnEnableSensors": "मोशन सेन्सर्स सुरू करा",
    "accel": "अ‍ॅक्सलेरोमीटर",
    "gyro": "जायरोस्कोप",
    "gps": "जीपीएस",
    "checking": "हार्डवेअर तपासत आहे...",
    "available": "उपलब्ध",
    "unavailable": "या उपकरणावर अनुपलब्ध",
    "sensorHonestyDesc": "थेट हार्डवेअर टेलिमेट्री. डेस्कटॉपवर सेन्सर्स नसल्यास नियमांनुसार 'अनुपलब्ध' दर्शवले जाते.",
    "btnBack": "मागे",
    "btnToStep3": "पुढे: रस्ता संदर्भ व एआय विश्लेषण",
    "hazardDesc": "तक्रारीचा तपशील (पर्यायी)",
    "hazardPlaceholder": "उदा. ट्रॅफिक सिग्नलजवळ मोठा खड्डा, दुचाकी घसरण्याचा तीव्र धोका...",
    "roadClassification": "रस्त्याचा प्रकार",
    "arterial": "प्रमुख धमनी रस्ता (अति रहदारी)",
    "highway": "राज्य / राष्ट्रीय महामार्ग जोड रस्ता",
    "collector": "उपनगरीय रस्ता",
    "local": "स्थानिक गल्ली / कॉलनी रस्ता",
    "trafficExposure": "वाहतुकीचा ताण",
    "trafficHigh": "जास्त (बस मार्ग / गर्दीची वेळ)",
    "trafficMedium": "मध्यम (नियमित स्थानिक रहदारी)",
    "trafficLow": "कमी (शांत कॉलनी रस्ता)",
    "sensitiveInfra": "परिसरातील संवेदनशील ठिकाणे (लागू असलेले सर्व निवडा)",
    "schoolZone": "शाळा / महाविद्यालय परिसर",
    "hospitalRoute": "रुग्णालय / रुग्णवाहिका मार्ग",
    "metroTransit": "मेट्रो स्टेशन / बस स्थानक",
    "waterlogging": "पाणी साचणारा भाग",
    "btnRunScan": "YOLO11 एआय विश्लेषण सुरू करा",
    "scanningTitle": "YOLO11 न्यूरल नेटवर्क तपासणी सुरू आहे...",
    "scanningSubtitle": "खड्ड्याची जागा, वर्गीकरण आणि तीव्रतेची अचूक मोजणी",
    "priorityIndex": "प्राधान्य निर्देशांक",
    "topQueue": "सर्वोच्च दुरुस्ती प्राधान्य",
    "damageDetected": "सापडलेले नुकसान",
    "confidence": "विश्वासार्हता / अचूकता",
    "severity": "तीव्रता",
    "model": "मॉडेल",
    "explainableModel": "पारदर्शक प्राधान्य मॉडेल (घटक भार):",
    "weightSeverity": "1. नुकसानाची तीव्रता (30%)",
    "weightExtent": "2. नुकसानीचा विस्तार (20%)",
    "weightRoad": "3. रस्त्याचे महत्त्व (20%)",
    "weightTraffic": "4. वाहतुकीचा धोका (10%)",
    "weightSensitive": "5. संवेदनशील परिसर धोका (10%)",
    "weightCorroboration": "6. पुष्टीकारक पुरावे (10%)",
    "btnSubmit": "अधिकृत तक्रार दाखल करा"
  },
  "success": {
    "title": "तक्रार यशस्वीरीत्या नोंदवली गेली!",
    "subtitle": "आपल्या तक्रारीस प्राधान्यक्रम देण्यात आला असून ती दुरुस्ती यादीत जोडली गेली आहे.",
    "trackingId": "अधिकृत तक्रार आयडी",
    "btnTrack": "तक्रारीची प्रगती तपासा",
    "btnBack": "डॅशबोर्डवर परत जा"
  },
  "tracking": {
    "modalTitle": "तक्रार ट्रॅकिंग कन्सोल",
    "liveSync": "थेट स्थिती समन्वय",
    "timelineTitle": "दुरुस्ती प्रगती कालरेषा",
    "assignedOfficer": "नेमलेले अभियंता",
    "resolutionLevel": "निराकरण पातळी",
    "initialEvidence": "सुरुवातीचा पुरावा",
    "postRepairEvidence": "दुरुस्तीनंतरची पडताळणी",
    "repairNotes": "प्राधिकरणाची दुरुस्ती नोंद",
    "btnClose": "ट्रॅकर बंद करा",
    "activeStage": "चालू टप्पा",
    "closed": "पूर्ण झाले",
    "syncedConsole": "महानगरपालिका प्रणालीशी थेट जोडलेले"
  },
  "monitoring": {
    "cardTitle": "दुरुस्तीनंतरची गुणवत्ता तपासणी",
    "cycleProgress": "निरीक्षण कालावधी प्रगती",
    "dayCount": "दिवस {current} / {total}",
    "daysRemaining": "({count} दिवस शिल्लक)",
    "currentResolution": "सध्याची निराकरण पातळी",
    "whyMonitoringTitle": "दुरुस्तीनंतरचे निरीक्षण का गरजेचे आहे?",
    "whyMonitoringText": "अभियंत्यांनी रस्त्याची दुरुस्ती पूर्ण केली आहे. प्रत्यक्ष रहदारीत डांबर टिकून राहते की नाही हे पाहण्यासाठी रस्ता {days} दिवस निरीक्षणाखाली ठेवला जातो. त्यानंतरच अंतिम १००% मंजुरी मिळते.",
    "whyReinspectionText": "दोष आढळला: निरीक्षण कालावधीत रस्त्याचे नुकसान पुन्हा दिसले. तक्रार ५०% वर आणली असून ती पुन्हा दुरुस्तीसाठी पाठवली आहे.",
    "noSensors": "स्मार्टफोन सेन्सर निरीक्षण: अद्याप कोणतीही सेन्सर निरीक्षणे उपलब्ध नाहीत.",
    "activeSensors": "सक्रिय स्मार्टफोन टेलिमेट्री: अ‍ॅक्सलेरोमीटर (|A|: {magnitude} m/s²) • जायरोस्कोप सक्रिय",
    "badgeMonitoring": "निरीक्षणाखाली (९०%)",
    "badgeConfirmation": "पुष्टी आवश्यक",
    "badgePassed": "यशस्वी व १००% पूर्ण",
    "badgeFailed": "अयशस्वी — पुनर्निरीक्षण आवश्यक",
    "btnConfirmFinal": "अंतिम निराकरणाची पुष्टी करा",
    "btnRequestReinspection": "पुनर्निरीक्षणाची विनंती करा",
    "btnSimulate7": "+7 दिवस",
    "btnSimulateComplete": "कालावधी पूर्ण"
  },
  "authority": {
    "headerBadge": "प्राधिकरण",
    "headerSubtitle": "एआय-सहाय्यित रस्ते दुरुस्ती प्राधान्यक्रम",
    "title": "कोणत्या नुकसानीवर प्रथम लक्ष देणे आवश्यक आहे?",
    "subtitle": "मार्गदृष्टी पारदर्शक सूत्रावर आधारित स्वयंचलित क्रमवारी, जी खड्ड्याची खोली, रस्त्याचा प्रकार, रहदारी आणि रुग्णालय/शाळा धोक्याचा समतोल साधते.",
    "kpiTotal": "एकूण तक्रारी",
    "kpiCritical": "अतिगंभीर प्राधान्य (गुण ≥80)",
    "kpiActive": "सक्रिय दुरुस्ती कामे",
    "kpiMonitoring": "निरीक्षणाखाली (९०%)",
    "kpiResolved": "१००% पूर्णपणे निराकरण झाले",
    "repairsUnderMonitoring": "गुणवत्ता निरीक्षणाखालील रस्ते दुरुस्ती",
    "monitoringSubtitle": "दुरुस्ती पूर्ण ≠ अंतिम निराकरण: निकृष्ट काम टाळण्यासाठी अंतिम मंजुरीपूर्वी रस्ता निरीक्षणाखाली ठेवला जातो.",
    "monitoringConfigLabel": "निरीक्षण कालावधी:",
    "daysDefault": "30 दिवस (डिफॉल्ट)",
    "days45": "45 दिवस",
    "days60": "60 दिवस",
    "thComplaintLocation": "तक्रार व रस्त्याचे स्थान",
    "thEngineer": "जबाबदार अभियंता",
    "thRepairDate": "दुरुस्ती तारीख",
    "thTimeline": "निरीक्षण कालरेषा",
    "thProgress": "निरीक्षण प्रगती",
    "thResolution": "निराकरण स्थिती",
    "thEvidence": "रस्त्याची स्थिती व सेन्सर पुरावे",
    "thActions": "कार्रवाई",
    "emptyMonitoring": "सध्या निरीक्षणाखाली कोणतीही दुरुस्ती नाही. अभियंत्याने 'दुरुस्ती पूर्ण' केल्यावर तक्रारी येथे निरीक्षण चक्रात दाखल होतात.",
    "queueTitle": "प्राधान्य दुरुस्ती यादी (उच्च प्राधान्य प्रथम)",
    "tabAll": "सर्व तक्रारी",
    "tabCritical": "अतिगंभीर (≥80)",
    "tabHigh": "उच्च (60–79)",
    "tabAssigned": "अभियंता नियुक्त",
    "tabResolved": "निराकरण पूर्ण",
    "thRankScore": "क्रमवारी व गुण",
    "thComplaintId": "तक्रार आयडी",
    "thEvidenceType": "पुरावा प्रकार",
    "thDamageSeverity": "नुकसान व तीव्रता",
    "thLocationWard": "स्थान व प्रभाग",
    "thStatus": "स्थिती",
    "thOfficer": "नेमलेले अधिकारी",
    "btnInspect": "तक्रार तपासा",
    "inspTitle": "तक्रार तपशील व व्हिजन एआय तपासणी",
    "inspEvidence": "1. दृश्य पुरावा व व्हिजन एआय",
    "inspDiagnostics": "2. दोष निदान",
    "inspPriority": "3. पारदर्शक प्राधान्य गुण विभागणी",
    "inspLocation": "4. भौगोलिक संदर्भ",
    "inspTimeline": "5. दुरुस्ती कालरेषा",
    "btnVerify": "दोष पडताळणी करा",
    "btnAssign": "अभियंता नेमा",
    "btnInProgress": "प्रगतीपथावर ठेवा",
    "btnRepairCompleted": "दुरुस्ती पूर्ण नोंदवा (९०% निरीक्षणात)",
    "btnConfirmFinal": "अंतिम मंजुरी द्या (१००% पूर्ण)",
    "btnReinspect": "पुनर्निरीक्षणाचा आदेश द्या (खड्डा परत दिसला)",
    "modalAssignTitle": "दुरुस्ती पथक आणि कामाचा आदेश पाठवा",
    "modalResolveTitle": "रस्ता दुरुस्ती पूर्ण करा व पुरावा जोडा",
    "modalConfirmTitle": "अंतिम निराकरणाची पुष्टी करा (१००% पूर्ण)",
    "modalReinspectTitle": "दुरुस्ती अयशस्वी — पुनर्निरीक्षणाचा आदेश द्या",
    "btnCancel": "रद्द करा",
    "btnCloseModal": "तपासणी कन्सोल बंद करा"
  },
  "map": {
    "title": "खड्डे नकाशा आणि नेव्हिगेशन",
    "corridorBadge": "बंगळुरू कॉरिडोअर जीआयएस",
    "tabExplore": "खड्डे शोधा",
    "tabRoute": "सुरक्षित मार्ग शोधा",
    "statActive": "सक्रिय",
    "statCritical": "अतिगंभीर",
    "statResolved": "निराकरण झालेले",
    "visibleHazards": "नकाशा क्षेत्रात {count} सक्रिय खड्डे आढळले",
    "filterAll": "सर्व",
    "filterActive": "सक्रिय",
    "filterCritical": "अतिगंभीर",
    "filterHigh": "उच्च",
    "filterMedium": "मध्यम",
    "filterResolved": "निराकरण झालेले",
    "emptyHazards": "या निकषात कोणताही रस्ता दोष आढळला नाही.",
    "focusMap": "नकाशावर पहा →",
    "routeTitle": "सुरक्षित आणि सुलभ मार्ग शोधा",
    "routeSubtitle": "सुरक्षा गुण जास्तीत जास्त ठेवण्यासाठी पर्यायी मार्गांवरील खड्ड्यांची तीव्रता तपासतो.",
    "demoCorridors": "डेमो मार्ग कॉरिडोअर",
    "sourceLabel": "सुरुवातीचे स्थान",
    "destLabel": "पोहोचण्याचे ठिकाण",
    "modeSafest": "🛡️ सर्वात सुरक्षित",
    "modeFastest": "⚡ सर्वात वेगवान",
    "modeBalanced": "⚖️ संतुलित",
    "btnCalculate": "खड्डे-मुक्त मार्गांची गणना करा",
    "safetyRating": "सुरक्षा गुण: {score}/100",
    "routeSummary": "{distance} किमी • {mins} मिनिटे • {potholes} खड्डे",
    "legendTitle": "रस्त्यावरील नुकसानीची तीव्रता",
    "legendCritical": "अतिगंभीर",
    "legendHigh": "उच्च",
    "legendMedium": "मध्यम",
    "legendResolved": "निराकरण झालेले",
    "popupPotholes": "खड्ड्याचा धोका",
    "popupView": "तपशील पहा"
  },
  "status": {
    "REPORTED": "नोंदवली",
    "AI_ANALYZED": "एआय विश्लेषित",
    "VERIFIED": "पडताळणी झाली",
    "ASSIGNED": "अभियंता नियुक्त",
    "IN_PROGRESS": "काम प्रगतीपथावर",
    "REPAIR_COMPLETED": "निरीक्षणाखाली (९०%)",
    "CONFIRMATION_REQUIRED": "पुष्टी आवश्यक",
    "REINSPECTION_REQUIRED": "पुनर्निरीक्षण आवश्यक",
    "RESOLVED": "१००% पूर्णपणे निराकरण झाले",
    "reported": "नोंदवली",
    "analyzed": "एआय विश्लेषित",
    "verified": "पडताळणी झाली",
    "assigned": "अभियंता नियुक्त",
    "inProgress": "काम प्रगतीपथावर",
    "monitoring": "निरीक्षणाखाली (९०%)",
    "confirmationRequired": "पुष्टी आवश्यक",
    "reinspection": "पुनर्निरीक्षण आवश्यक",
    "resolved": "१००% पूर्णपणे निराकरण झाले"
  },
  "priority": {
    "CRITICAL": "अतिगंभीर",
    "HIGH": "उच्च",
    "MEDIUM": "मध्यम",
    "LOW": "कमी"
  },
  "severity": {
    "CRITICAL": "अतिगंभीर",
    "HIGH": "उच्च",
    "MEDIUM": "मध्यम",
    "LOW": "कमी"
  },
  "damage": {
    "POTHOLE": "खड्डा",
    "CRACK": "रस्त्यावरील भेग"
  },
  "chatbot": {
    "launcherTitle": "एआय सहाय्यक",
    "headerTitle": "मार्गदृष्टी एआय सहाय्यक",
    "headerSubtitle": "नागरिक रस्ता सहाय्य व मार्गदर्शन",
    "welcomeMessage": "नमस्कार! मी मार्गदृष्टी एआय सहाय्यक आहे. आपण मला रस्त्यावरील नुकसान नोंदवणे, तक्रार ट्रॅक करणे, प्राधान्य गुण समजणे किंवा सुरक्षित मार्ग शोधणे याबद्दल विचारू शकता.",
    "inputPlaceholder": "मराठी, हिंदी किंवा English मध्ये विचारा...",
    "send": "पाठवा",
    "clear": "साफ करा",
    "chipReport": "खड्डा कसा नोंदवायचा?",
    "chipTrack": "माझी तक्रार कुठे आहे?",
    "chipPriority": "प्राधान्य गुण समजावून सांगा",
    "chipMonitoring": "९०% निरीक्षणाचा काय अर्थ आहे?",
    "chipMap": "खड्डे नकाशा कसा वापरायचा?",
    "btnOpenReport": "रस्त्यावरील नुकसान नोंदवा",
    "btnOpenMap": "खड्डे नकाशा उघडा",
    "btnTrackComplaint": "तक्रार ट्रॅक करा"
  },
  "messages": {
    "toastLangChanged": "भाषा {lang} वर सेट केली आहे",
    "toastDemoReset": "डेमो डेटाबेस मूळ स्थितीत रीसेट केला गेला आहे.",
    "toastReportSubmitted": "तक्रार आयडी {id} सह नोंदवली गेली आहे.",
    "toastStatusUpdated": "स्थिती बदलून {status} करण्यात आली.",
    "toastVerified": "दुरुस्तीसाठी तक्रारीची पडताळणी झाली.",
    "toastAssigned": "कामाचा आदेश {officer} यांना दिला.",
    "toastRepairCompleted": "दुरुस्ती पूर्ण झाली. ३० दिवसांचा निरीक्षण कालावधी सुरू.",
    "toastConfirmed": "दुरुस्तीची अंतिम पुष्टी झाली. १००% पूर्ण.",
    "toastReinspection": "पुनर्निरीक्षण आवश्यक. पुन्हा दुरुस्तीसाठी पाठवले.",
    "errorSelectImage": "कृपया फोटो किंवा व्हिडिओ पुरावा निवडा.",
    "errorEnterLocation": "कृपया रस्त्याचे योग्य स्थान निर्देशांक द्या.",
    "errorNotFound": "प्रणालीत तक्रार {id} आढळली नाही.",
    "locAcquiredDevice": "उपकरणाच्या जीपीएसने स्थान मिळवले.",
    "locAcquiredDemo": "इंदिरानगर डेमो स्थान लागू केले."
  }
}
};

class I18nManager {
  constructor() {
    this.currentLang = this.getSavedLanguage();
    this.translations = EMBEDDED_FALLBACK_TRANSLATIONS;
    this.init();

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.syncLanguageDropdowns();
          this.translatePage();
        });
      } else {
        this.syncLanguageDropdowns();
        this.translatePage();
      }

      window.addEventListener('load', () => {
        this.syncLanguageDropdowns();
        this.translatePage();
      });
    }
  }

  async init() {
    await this.loadDictionaries();
    this.syncLanguageDropdowns();
    this.translatePage();

    // Listen to cross-tab language changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === LANG_STORAGE_KEY && e.newValue) {
          this.currentLang = e.newValue;
          this.syncLanguageDropdowns();
          this.translatePage();
          window.dispatchEvent(new CustomEvent('margdrishti:lang_changed', { detail: { lang: this.currentLang } }));
        }
      });
    }
  }

  getSavedLanguage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
          return saved;
        }
      }
    } catch (e) {
      console.warn('Unable to access localStorage for i18n:', e);
    }
    return 'en';
  }

  async loadDictionaries() {
    // Attempt to fetch json files dynamically if hosted on HTTP/HTTPS
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      try {
        const [enRes, hiRes, mrRes] = await Promise.all([
          fetch('translations/en.json').then(r => r.json()),
          fetch('translations/hi.json').then(r => r.json()),
          fetch('translations/mr.json').then(r => r.json())
        ]);
        this.translations = { en: enRes, hi: hiRes, mr: mrRes };
      } catch (err) {
        // Fallback to embedded
        this.translations = EMBEDDED_FALLBACK_TRANSLATIONS;
      }
    } else {
      this.translations = EMBEDDED_FALLBACK_TRANSLATIONS;
    }
  }

  getCurrentLanguage() {
    return this.currentLang;
  }

  setLanguage(langCode) {
    if (!['en', 'hi', 'mr'].includes(langCode)) langCode = 'en';
    this.currentLang = langCode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANG_STORAGE_KEY, langCode);
      }
    } catch (e) {
      console.warn('Failed to save language in localStorage:', e);
    }
    this.syncLanguageDropdowns();
    this.translatePage();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('margdrishti:lang_changed', { detail: { lang: langCode } }));
    }
  }

  /**
   * Translates a dot-notated key path e.g. "citizen.heroTitle"
   * Supports parameter interpolation: I18n.t('monitoring.dayCount', { current: 18, total: 30 })
   */
  t(keyPath, params = {}, fallback = '') {
    if (!keyPath) return fallback;
    if (typeof params === 'string') {
      fallback = params;
      params = {};
    }

    const parts = keyPath.split('.');
    
    // 1. Check current language
    let val = this.translations[this.currentLang];
    for (const p of parts) {
      if (val && typeof val === 'object' && p in val) {
        val = val[p];
      } else {
        val = null;
        break;
      }
    }

    // 2. Fallback to English
    if (val === null || typeof val !== 'string') {
      val = this.translations['en'];
      for (const p of parts) {
        if (val && typeof val === 'object' && p in val) {
          val = val[p];
        } else {
          val = null;
          break;
        }
      }
    }

    if (val === null || typeof val !== 'string') {
      val = fallback || keyPath;
    }

    // 3. Parameter Interpolation {key} or {{key}}
    if (typeof val === 'string' && params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        val = val.replace(new RegExp(`\\{\\{?\\s*${k}\\s*\\}?\\}`, 'g'), v);
      }
    }

    return val;
  }

  getStatusLabel(statusKey) {
    if (!statusKey) return '';
    const key = String(statusKey).toUpperCase();
    return this.t(`status.${key}`, this.t(`status.${statusKey}`, statusKey));
  }

  getPriorityLabel(priorityKey) {
    if (!priorityKey) return '';
    const key = String(priorityKey).toUpperCase();
    return this.t(`priority.${key}`, priorityKey);
  }

  getSeverityLabel(severityKey) {
    if (!severityKey) return '';
    const key = String(severityKey).toUpperCase();
    return this.t(`severity.${key}`, severityKey);
  }

  getDamageTypeLabel(damageKey) {
    if (!damageKey) return '';
    const key = String(damageKey).toUpperCase();
    return this.t(`damage.${key}`, damageKey);
  }

  translatePage() {
    if (typeof document === 'undefined') return;

    if (document.documentElement) {
      document.documentElement.lang = this.currentLang;
    }

    // 1. Text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (text && text !== key) {
        // If element has icon children (like <i data-lucide="...">), find child span or update only text node
        const icon = el.querySelector('i, svg');
        const textSpan = el.querySelector('.i18n-text, span:not([class*="badge"]):not([class*="dot"])');
        if (icon && textSpan) {
          textSpan.textContent = text;
        } else if (icon) {
          let foundTextNode = false;
          el.childNodes.forEach(child => {
            if (child.nodeType === 3 && child.textContent.trim().length > 0) {
              child.textContent = ' ' + text;
              foundTextNode = true;
            }
          });
          if (!foundTextNode) {
            const span = document.createElement('span');
            span.textContent = text;
            el.appendChild(span);
          }
        } else {
          el.textContent = text;
        }
      }
    });

    // 2. HTML elements
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const text = this.t(key);
      if (text && text !== key) {
        el.innerHTML = text;
      }
    });

    // 3. Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = this.t(key);
      if (text && text !== key) {
        el.placeholder = text;
      }
    });

    // 4. Tooltips / Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const text = this.t(key);
      if (text && text !== key) {
        el.title = text;
      }
    });

    // 5. Aria Labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      const text = this.t(key);
      if (text && text !== key) {
        el.setAttribute('aria-label', text);
      }
    });

    // 6. Input submit/button values
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      const text = this.t(key);
      if (text && text !== key) {
        el.value = text;
      }
    });

    // Refresh Lucide icons if available
    if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  syncLanguageDropdowns() {
    if (typeof document === 'undefined') return;

    const selector = '.lang-select, .lang-select-dropdown, #langSelect, select[data-role="language-selector"], select[aria-label="Select Language"]';
    document.querySelectorAll(selector).forEach(select => {
      if (select.value !== this.currentLang) {
        select.value = this.currentLang;
      }
      if (!select.dataset.i18nBound) {
        select.dataset.i18nBound = 'true';
        select.addEventListener('change', (e) => {
          this.setLanguage(e.target.value);
        });
      }
    });
  }
}

export const I18n = new I18nManager();
if (typeof window !== 'undefined') {
  window.I18n = I18n;
}

/**
 * MargDrishti — Agentic AI Citizen Assistant Service
 * Multilingual (English, Hindi, Marathi) conversational agent.
 * Performs intent parsing, context reasoning, system guidance, complaint lookup,
 * and safe task-oriented actions without hallucinations.
 */

import { MargDrishtiStore } from './store.js';
import { AuthService } from './auth.js';
import { I18n } from './i18n.js';

class AiAssistantServiceManager {
  constructor() {
    this.externalEndpoint = null; // Configurable for real LLM backend connection
  }

  /**
   * Configure optional external LLM API endpoint
   */
  configureEndpoint(url, apiKey = null) {
    this.externalEndpoint = { url, apiKey };
  }

  /**
   * Process a user query in English, Hindi, or Marathi
   * @param {string} userQuery
   * @param {string} forcedLang - 'en' | 'hi' | 'mr' (optional override)
   */
  async processQuery(userQuery, forcedLang = null) {
    const rawText = (userQuery || '').trim();
    if (!rawText) return null;

    // Detect language or use app's active language
    const lang = forcedLang || this.detectLanguage(rawText) || I18n.getCurrentLanguage();

    // Check if query references a specific Complaint ID e.g. "MD-2026-0001"
    const idMatch = rawText.match(/MD-\d{4}-\d{4}/i);
    const specificComplaintId = idMatch ? idMatch[0].toUpperCase() : null;

    // Intent Classification
    const intent = this.classifyIntent(rawText);

    // Get current citizen context (strictly respecting privacy)
    const activeSession = AuthService.getCurrentUser();
    const isCitizen = activeSession && activeSession.role === 'citizen';
    const currentCitizenName = isCitizen ? activeSession.user.name : null;

    // Route to response generators
    return this.generateResponse(intent, {
      rawQuery: rawText,
      lang,
      specificComplaintId,
      activeSession,
      currentCitizenName
    });
  }

  detectLanguage(text) {
    // Check for Devanagari script (used by both Hindi and Marathi)
    const devanagariRegex = /[\u0900-\u097F]/;
    if (!devanagariRegex.test(text)) return 'en';

    // Simple Marathi markers vs Hindi markers
    const marathiWords = ['माझी', 'तक्रार', 'कशी', 'करावी', 'कुठे', 'आहे', 'रस्ता', 'खड्डा', 'सांगा', 'होईल', 'नाही', 'का'];
    const lower = text.toLowerCase();
    const hasMarathi = marathiWords.some(w => lower.includes(w));
    if (hasMarathi) return 'mr';

    const hindiWords = ['मेरी', 'शिकायत', 'कैसे', 'करें', 'कहाँ', 'है', 'सड़क', 'गड्ढा', 'बताएं', 'होगा', 'नहीं', 'क्या'];
    const hasHindi = hindiWords.some(w => lower.includes(w));
    if (hasHindi) return 'hi';

    return I18n.getCurrentLanguage();
  }

  classifyIntent(text) {
    const t = text.toLowerCase();

    // 1. Report Road Damage
    if (t.includes('report') || t.includes('upload') || t.includes('camera') || t.includes('दर्ज') || t.includes('रिपोर्ट') || t.includes('नोंदव') || t.includes('तक्रार कशी')) {
      return 'HOW_TO_REPORT';
    }

    // 2. Track Complaint
    if (t.includes('track') || t.includes('status') || t.includes('where is') || t.includes('शिकायत कहाँ') || t.includes('स्थिति') || t.includes('ट्रॅक') || t.includes('तक्रार कुठे') || t.includes('md-2026')) {
      return 'TRACK_COMPLAINT';
    }

    // 3. Priority Score & Explainability
    if (t.includes('priority') || t.includes('score') || t.includes('high priority') || t.includes('प्राथमिकता') || t.includes('स्कोर') || t.includes('प्राधान्य') || t.includes('गुण')) {
      return 'EXPLAIN_PRIORITY';
    }

    // 4. Monitoring / 90% Repair
    if (t.includes('90%') || t.includes('monitoring') || t.includes('reinspection') || t.includes('निगरानी') || t.includes('पुनरीक्षण') || t.includes('निरीक्षण') || t.includes('पुनर्निरीक्षण') || t.includes('resolved') || t.includes('समाधान')) {
      return 'EXPLAIN_MONITORING';
    }

    // 5. Location / GPS / Sensors
    if (t.includes('location') || t.includes('gps') || t.includes('sensor') || t.includes('स्थान') || t.includes('सेंसर') || t.includes('सेन्सर')) {
      return 'EXPLAIN_LOCATION_SENSORS';
    }

    // 6. Map & Navigation
    if (t.includes('map') || t.includes('route') || t.includes('navigation') || t.includes('नक्शा') || t.includes('मानचित्र') || t.includes('मार्ग') || t.includes('नकाशा')) {
      return 'EXPLAIN_MAP';
    }

    // 7. General AI Detection
    if (t.includes('yolo') || t.includes('ai') || t.includes('detection') || t.includes('एआई') || t.includes('एआय')) {
      return 'EXPLAIN_AI_DETECTION';
    }

    return 'GENERAL_HELP';
  }

  generateResponse(intent, ctx) {
    const { lang } = ctx;

    switch (intent) {
      case 'HOW_TO_REPORT':
        return this.responseHowToReport(lang);
      case 'TRACK_COMPLAINT':
        return this.responseTrackComplaint(ctx);
      case 'EXPLAIN_PRIORITY':
        return this.responseExplainPriority(lang);
      case 'EXPLAIN_MONITORING':
        return this.responseExplainMonitoring(lang);
      case 'EXPLAIN_LOCATION_SENSORS':
        return this.responseExplainSensors(lang);
      case 'EXPLAIN_MAP':
        return this.responseExplainMap(lang);
      case 'EXPLAIN_AI_DETECTION':
        return this.responseExplainAi(lang);
      default:
        return this.responseGeneralHelp(lang);
    }
  }

  responseHowToReport(lang) {
    if (lang === 'mr') {
      return {
        text: `**रस्त्यावरील नुकसान नोंदवण्याची सोपी पद्धत:**\n\n1. **पुरावा अपलोड करा:** कॅमेऱ्याने रस्त्याचा फोटो घ्या किंवा डॅशकॅम व्हिडिओ निवडा.\n2. **स्थान निश्चित करा:** तुमचा फोन थेट चालू GPS स्थान मिळवेल किंवा तुम्ही नकाशावर स्थान निवडू शकता.\n3. **एआय तपासणी:** YOLO11 मॉडेल खड्डा/भेगा ओळखून प्राधान्य गुण निश्चित करेल.\n4. **तक्रार सबमिट करा:** सबमिट बटणावर क्लिक करताच तक्रार महानगरपालिकेच्या दुरुस्ती रांगेत जाईल.`,
        actions: [
          { label: 'रस्त्यावरील नुकसान नोंदवा', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
          { label: 'खड्डे नकाशा पहा', action: 'NAVIGATE_MAP', icon: 'map' }
        ]
      };
    }
    if (lang === 'hi') {
      return {
        text: `**सड़क क्षति दर्ज करने की आसान प्रक्रिया:**\n\n1. **साक्ष्य अपलोड करें:** कैमरे से सड़क का फोटो लें या डैशकैम वीडियो चुनें।\n2. **स्थान की पुष्टि:** आपका फोन वर्तमान जीपीएस निर्देशांक प्राप्त करेगा या आप मानचित्र पर स्थान चुन सकते हैं।\n3. **एआई स्कैन:** YOLO11 मॉडल खड्डे/दरार की पहचान करेगा और प्राथमिकता स्कोर की गणना करेगा।\n4. **रिपोर्ट जमा करें:** सबमिट करते ही आपकी शिकायत सीधे नगर निगम की मरम्मत कतार में दर्ज हो जाएगी।`,
        actions: [
          { label: 'सड़क क्षति रिपोर्ट खोलें', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
          { label: 'खड्डा मानचित्र देखें', action: 'NAVIGATE_MAP', icon: 'map' }
        ]
      };
    }
    return {
      text: `**How to Report Road Damage in MargDrishti:**\n\n1. **Upload Evidence:** Take a clear road defect photo or select a dashcam video.\n2. **Location Capture:** The app automatically acquires device GPS coordinates or allows pinpointing on the map.\n3. **AI Scan:** YOLO11 Computer Vision classifies the defect and computes an explainable 0–100 priority score.\n4. **Submit:** Click submit to route the work order to the municipal maintenance triage queue.`,
      actions: [
        { label: 'Open Report Road Damage', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
        { label: 'Open Pothole Map', action: 'NAVIGATE_MAP', icon: 'map' }
      ]
    };
  }

  responseTrackComplaint(ctx) {
    const { lang, specificComplaintId, activeSession, currentCitizenName } = ctx;
    const all = MargDrishtiStore.getAllComplaints();

    // 1. If specific ID provided
    if (specificComplaintId) {
      const found = all.find(c => c.complaintId.toUpperCase() === specificComplaintId);
      if (!found) {
        const notFoundText = lang === 'mr' 
          ? `तक्रार क्रमांक **${specificComplaintId}** प्रणालीत आढळली नाही. कृपया आयडी तपासा.`
          : lang === 'hi'
          ? `शिकायत आईडी **${specificComplaintId}** सिस्टम में नहीं मिली। कृपया आईडी की जांच करें।`
          : `Complaint ID **${specificComplaintId}** was not found in the system. Please verify the ID.`;
        return { text: notFoundText, actions: [] };
      }

      return this.formatComplaintCard(found, lang);
    }

    // 2. Look up logged in citizen's complaints safely
    if (activeSession && currentCitizenName) {
      const userComplaints = all.filter(c => c.citizenName.toLowerCase().includes(currentCitizenName.toLowerCase()));
      if (userComplaints.length > 0) {
        const latest = userComplaints[0];
        const intro = lang === 'mr'
          ? `मला तुमच्या खात्याशी संबंधित **${userComplaints.length}** तक्रारी सापडल्या. तुमची सर्वात अलिकडची तक्रार खालीलप्रमाणे आहे:`
          : lang === 'hi'
          ? `मुझे आपके खाते से जुड़ी **${userComplaints.length}** शिकायतें मिलीं। आपकी नवीनतम शिकायत का विवरण नीचे दिया गया है:`
          : `Found **${userComplaints.length}** complaint(s) linked to your account. Here is your most recent active report:`;
        
        const card = this.formatComplaintCard(latest, lang);
        card.text = `${intro}\n\n${card.text}`;
        return card;
      }
    }

    // 3. Fallback: prompt to search ID or login
    if (lang === 'mr') {
      return {
        text: `आपली तक्रार ट्रॅक करण्यासाठी कृपया तुमचा **तक्रार आयडी** विचारा (उदा. *MD-2026-0001*), किंवा Citizen Dashboard वरील **"Track"** पर्यायाचा वापर करा.`,
        actions: [{ label: 'ट्रॅकिंग शोधा', action: 'FOCUS_TRACK_SEARCH', icon: 'search' }]
      };
    }
    if (lang === 'hi') {
      return {
        text: `अपनी शिकायत ट्रैक करने के लिए कृपया अपनी **शिकायत आईडी** दर्ज करें (उदा. *MD-2026-0001*), या Citizen Dashboard पर **"Track"** विकल्प का उपयोग करें।`,
        actions: [{ label: 'ट्रैकिंग खोजें', action: 'FOCUS_TRACK_SEARCH', icon: 'search' }]
      };
    }
    return {
      text: `To track your complaint, please provide your **Complaint ID** (e.g. *MD-2026-0001*), or use the search bar on your Citizen Dashboard.`,
      actions: [{ label: 'Focus Search Bar', action: 'FOCUS_TRACK_SEARCH', icon: 'search' }]
    };
  }

  formatComplaintCard(c, lang) {
    const statusLabel = I18n.getStatusLabel(c.status);
    const daysMonitoring = c.monitoring ? `Day ${c.monitoring.daysCompleted} / ${c.monitoring.daysTotal}` : null;
    const resolution = c.resolution !== undefined ? `${c.resolution}%` : (c.status === 'RESOLVED' ? '100%' : '50%');

    let summaryText = '';
    if (lang === 'mr') {
      summaryText = `📋 **तक्रार आयडी:** \`${c.complaintId}\`\n📍 **स्थान:** ${c.location.roadName} (${c.location.ward || 'महानगरपालिका'})\n⚙️ **नुकसान प्रकार:** ${c.damageType} (${c.severity})\n📊 **सद्यस्थिती:** **${statusLabel}** (प्रगती: ${resolution})${daysMonitoring ? `\n⏳ **निरीक्षण:** ${daysMonitoring}` : ''}\n👤 **नियुक्त अधिकारी:** ${c.assignedOfficer ? c.assignedOfficer.name : 'प्रलंबित'}`;
    } else if (lang === 'hi') {
      summaryText = `📋 **शिकायत आईडी:** \`${c.complaintId}\`\n📍 **स्थान:** ${c.location.roadName} (${c.location.ward || 'नगर निगम'})\n⚙️ **क्षति प्रकार:** ${c.damageType} (${c.severity})\n📊 **वर्तमान स्थिति:** **${statusLabel}** (समाधान: ${resolution})${daysMonitoring ? `\n⏳ **निगरानी चक्र:** ${daysMonitoring}` : ''}\n👤 **नियुक्त अधिकारी:** ${c.assignedOfficer ? c.assignedOfficer.name : 'लंबित'}`;
    } else {
      summaryText = `📋 **Complaint ID:** \`${c.complaintId}\`\n📍 **Location:** ${c.location.roadName} (${c.location.ward || 'Municipal Ward'})\n⚙️ **Damage Type:** ${c.damageType} (${c.severity})\n📊 **Current Status:** **${statusLabel}** (${resolution})${daysMonitoring ? `\n⏳ **Monitoring:** ${daysMonitoring}` : ''}\n👤 **Officer:** ${c.assignedOfficer ? c.assignedOfficer.name : 'Unassigned'}`;
    }

    return {
      text: summaryText,
      actions: [
        { label: lang === 'mr' ? 'तक्रारीची कालरेषा उघडा' : lang === 'hi' ? 'समयरेखा खोलें' : 'Open Complaint Tracker', action: 'OPEN_TRACKING_MODAL', param: c.complaintId, icon: 'crosshair' }
      ]
    };
  }

  responseExplainPriority(lang) {
    if (lang === 'mr') {
      return {
        text: `**मार्गदृष्टी पारदर्शक प्राधान्य सूत्र (0–100 गुण):**\n\nप्राधान्य हे केवळ खड्ड्याच्या आकारावर नाही, तर नागरिकांच्या सुरक्षिततेवर आधारित ६ घटकांनुसार ठरते:\n\n• **नुकसानाची तीव्रता (३०%):** खोल खड्डा किंवा तीव्र भेगा.\n• **नुकसानाचा विस्तार (२०%):** एकाच भागात अनेक खड्डे.\n• **रस्त्याचे महत्त्व (२०%):** राष्ट्रीय महामार्ग किंवा मुख्य रस्ता.\n• **वाहतूक जोखीम (१०%):** बस मार्ग किंवा गर्दीची वेळ.\n• **संवेदनशील क्षेत्र जोखीम (१०%):** शाळा, कॉलेज किंवा रुग्णालय परिसर.\n• **पुष्टीकारक पुरावे (१०%):** नागरिकांनी नोंदवलेल्या इतर तक्रारी.`,
        actions: [{ label: 'नुकसान नोंदवा', action: 'OPEN_REPORT_MODAL', icon: 'plus-circle' }]
      };
    }
    if (lang === 'hi') {
      return {
        text: `**मार्गदृष्टि पारदर्शी प्राथमिकता सूत्र (0–100 स्कोर):**\n\nप्राथमिकता केवल खड्डे के आकार पर नहीं, बल्कि जनसुरक्षा से जुड़े ६ वैज्ञानिक कारकों पर निर्भर करती है:\n\n• **क्षति की गंभीरता (३०%):** गहरे खड्डे या गंभीर सड़क दरारें।\n• **क्षति का विस्तार (२०%):** एक ही क्षेत्र में बार-बार क्षति।\n• **सड़क का महत्व (२०%):** राष्ट्रीय राजमार्ग या प्रमुख आर्टेरियल मार्ग।\n• **यातायात जोखिम (१०%):** सार्वजनिक बस मार्ग व व्यस्त यातायात।\n• **संवेदनशील क्षेत्र जोखिम (१०%):** स्कूल, कॉलेज व अस्पताल का निकट होना।\n• **पुष्टिकारक साक्ष्य (१०%):** नागरिकों द्वारा दर्ज अतिरिक्त साक्ष्य।`,
        actions: [{ label: 'क्षति रिपोर्ट करें', action: 'OPEN_REPORT_MODAL', icon: 'plus-circle' }]
      };
    }
    return {
      text: `**MargDrishti Explainable Priority Formula (0–100 Score):**\n\nPriority ranking is calculated transparently using 6 civic safety factors:\n\n• **Damage Severity (30%):** Deep crater depth and immediate skidding risk.\n• **Damage Extent (20%):** Spatial area and multi-frame video detections.\n• **Road Importance (20%):** Arterial corridors or highway links.\n• **Traffic Exposure (10%):** Transit bus routes and peak vehicle density.\n• **Sensitive Location Risk (10%):** Proximity to schools and hospital routes.\n• **Corroborating Evidence (10%):** Multiple citizen reports in the same cluster.`,
      actions: [{ label: 'File a Report', action: 'OPEN_REPORT_MODAL', icon: 'plus-circle' }]
    };
  }

  responseExplainMonitoring(lang) {
    if (lang === 'mr') {
      return {
        text: `**दुरुस्तीनंतरचे निरीक्षण (Post-Repair Monitoring) म्हणजे काय?**\n\nमार्गदृष्टीमध्ये **दुरुस्ती पूर्ण ≠ १००% निराकरण!**\n\nकंत्राटदार किंवा अभियंत्याने खड्डा भरल्यास तात्पुरती किंवा निकृष्ट दर्जाची दुरुस्ती केली जाण्याची शक्यता असते. त्यामुळे:\n1. दुरुस्ती पूर्ण झाल्यावर स्थिती **९०% (निरीक्षणाखाली)** होते.\n2. रस्त्यावर ३० दिवसांचा **निरीक्षण कालावधी** सुरू होतो.\n3. सेन्सर किंवा प्रत्यक्ष पाहणीद्वारे रस्ता टिकल्याची खात्री होते.\n4. ३० दिवसांनंतर प्राधिकरणाची पुष्टी झाल्यावरच तक्रार **१००% पूर्ण निराकरण** म्हणून बंद होते.\n5. रस्ता पुन्हा उखडल्यास **पुनर्निरीक्षण** घोषित करून पुन्हा दुरुस्ती केली जाते.`,
        actions: [{ label: 'डॅशबोर्ड पहा', action: 'NAVIGATE_DASHBOARD', icon: 'layout-dashboard' }]
      };
    }
    if (lang === 'hi') {
      return {
        text: `**मरम्मत पश्चात निगरानी (Post-Repair Monitoring) क्या है?**\n\nमार्गदृष्टि में **मरम्मत पूर्ण ≠ १००% समाधान!**\n\nसड़क मरम्मत के बाद कई बार घटिया सामग्री के कारण सड़क फिर से टूट जाती है। इस जवाबदेही के लिए:\n1. इंजीनियर द्वारा मरम्मत करने पर स्थिति **९०% (निगरानी में)** होती है।\n2. सड़क को ३० दिनों की **अनिवार्य निगरानी अवधि** में रखा जाता है।\n3. सेंसर एवं क्षेत्रीय निरीक्षण द्वारा सड़क की मजबूती जांची जाती है।\n4. निगरानी सफल होने पर प्राधिकरण की अंतिम पुष्टि के बाद ही शिकायत **१००% पूरी तरह हल** मानी जाती है।\n5. यदि क्षति पुनः दिखाई दे, तो **पुनरीक्षण** के तहत दोबारा मरम्मत कराई जाती है।`,
        actions: [{ label: 'डैशबोर्ड देखें', action: 'NAVIGATE_DASHBOARD', icon: 'layout-dashboard' }]
      };
    }
    return {
      text: `**What is Post-Repair Monitoring?**\n\nIn MargDrishti, **Repair Completed does NOT mean 100% Resolved!**\n\nTo prevent low-quality or temporary asphalt patching:\n1. When the engineer marks the repair complete, resolution is set to **90% (Under Monitoring)**.\n2. The road enters a mandatory **30-day post-repair monitoring period**.\n3. Available smartphone sensor telemetry and road condition observations are tracked.\n4. Only after the monitoring cycle ends and the authority performs **Final Confirmation** does it become **100% Fully Resolved**.\n5. If damage reappears, the authority requests **Reinspection**, reopening the repair cycle.`,
      actions: [{ label: 'View Dashboard', action: 'NAVIGATE_DASHBOARD', icon: 'layout-dashboard' }]
    };
  }

  responseExplainSensors(lang) {
    if (lang === 'mr') {
      return {
        text: `**स्मार्टफोन सेन्सर्स आणि स्थान सुविधा:**\n\n• **जीपीएस (GPS):** खड्ड्याचे अचूक अक्षांश व रेखांश स्वयंचलितपणे नोंदवते.\n• **अ‍ॅक्सिलेरोमीटर (Accelerometer):** रस्त्यावरील हादरे आणि खड्ड्यांमुळे होणारे झटके मोजते.\n• **जायरोस्कोप (Gyroscope):** वाहनाचा कल आणि रस्त्याचा पृष्ठभाग तपासते.\n\n*टीप: जर उपकरणावर हार्डवेअर सेन्सर उपलब्ध नसतील, तर प्रणाली प्रामाणिकपणे "अद्याप सेन्सर निरीक्षण उपलब्ध नाही" असे दर्शवते.*`,
        actions: []
      };
    }
    if (lang === 'hi') {
      return {
        text: `**स्मार्टफोन सेंसर और स्थान बुद्धिमत्ता:**\n\n• **जीपीएस (GPS):** क्षति के सटीक अक्षांश और देशांतर निर्देशांक रिकॉर्ड करता है।\n• **एक्सेलेरोमीटर:** सड़क के झटकों और खड्डों के प्रभाव को मापता है।\n• **जायरोस्कोप:** वाहन के झुकाव और सड़क की स्थिरता को रिकॉर्ड करता है।\n\n*नोट: यदि डिवाइस पर हार्डवेयर सेंसर उपलब्ध नहीं हैं, तो सिस्टम ईमानदारी से "अभी तक कोई सेंसर अवलोकन उपलब्ध नहीं है" प्रदर्शित करता है।*`,
        actions: []
      };
    }
    return {
      text: `**Smartphone Sensors & Location Intelligence:**\n\n• **GPS:** Accurately captures latitude and longitude coordinates of the road defect.\n• **Accelerometer:** Measures vertical impact spikes and road roughness.\n• **Gyroscope:** Detects vehicle tilt and road degradation.\n\n*Note: If smartphone IMU hardware is not streaming, MargDrishti honestly displays: "No sensor observations available yet."*`,
      actions: []
    };
  }

  responseExplainMap(lang) {
    if (lang === 'mr') {
      return {
        text: `**मार्गदृष्टी खड्डे नकाशा आणि नेव्हिगेशन:**\n\n• **खड्डे नकाशा:** शहरातील नोंदवलेले सर्व खड्डे आणि त्यांचे गांभीर्य दर्शवतो (लाल = अतिगंभीर, पिवळा = मध्यम, हिरवा = दुरुस्त).\n• **स्मार्ट रूट प्लॅनर:** दोन ठिकाणांमधील खड्डे तपासून सर्वात सुरक्षित (Safest) आणि खड्डेमुक्त रस्ता सुचवतो.`,
        actions: [{ label: 'खड्डे नकाशा उघडा', action: 'NAVIGATE_MAP', icon: 'map' }]
      };
    }
    if (lang === 'hi') {
      return {
        text: `**मार्गदृष्टि खड्डा मानचित्र एवं नेविगेशन:**\n\n• **खड्डा मानचित्र:** शहर के सभी दर्ज खड्डों को उनकी गंभीरता के रंग कोड में दिखाता है (लाल = अति गंभीर, पीला = मध्यम, हरा = समाधानित)।\n• **स्मार्ट रूट प्लानर:** गंतव्य के लिए खड्डों से बचते हुए सबसे सुरक्षित (Safest) मार्ग सुझाता है।`,
        actions: [{ label: 'खड्डा मानचित्र खोलें', action: 'NAVIGATE_MAP', icon: 'map' }]
      };
    }
    return {
      text: `**MargDrishti Pothole Map & Navigation:**\n\n• **GIS Pothole Map:** Displays all registered road hazards color-coded by severity (Red = Critical, Orange = High, Yellow = Medium, Green = Resolved).\n• **Pothole-Aware Navigation:** Evaluates alternative travel routes and calculates a safety index to guide you around severe road damage.`,
      actions: [{ label: 'Open Pothole Map', action: 'NAVIGATE_MAP', icon: 'map' }]
    };
  }

  responseExplainAi(lang) {
    if (lang === 'mr') {
      return {
        text: `**YOLO11 एआय तंत्रज्ञान कसे कार्य करते?**\n\n• तुम्ही फोटो किंवा व्हिडिओ अपलोड करताच YOLO11 न्यूरल नेटवर्क रस्त्यावरील खड्डे किंवा भेगा ओळखते.\n• ते नुकसानाभोवती बाउंडिंग बॉक्स (Bounding Box) तयार करते आणि विश्वासार्हता (उदा. ९४%) दर्शवते.\n• या माहितीचा वापर करून नुकसान गंभीर आहे की मध्यम हे निश्चित केले जाते.`,
        actions: [{ label: 'चाचणी अहवाल नोंदवा', action: 'OPEN_REPORT_MODAL', icon: 'camera' }]
      };
    }
    if (lang === 'hi') {
      return {
        text: `**YOLO11 एआई तकनीक कैसे काम करती है?**\n\n• जैसे ही आप फोटो या वीडियो अपलोड करते हैं, YOLO11 न्यूरल नेटवर्क सड़क पर खड्डों और दरारों को पहचानता है।\n• यह क्षति के चारों ओर बाउंडिंग बॉक्स खींचता है और विश्वसनीयता स्कोर (उदा. ९४%) प्रदर्शित करता है।\n• इसका उपयोग करके क्षति की गंभीरता और प्राथमिकता तय की जाती है।`,
        actions: [{ label: 'परीक्षण रिपोर्ट दर्ज करें', action: 'OPEN_REPORT_MODAL', icon: 'camera' }]
      };
    }
    return {
      text: `**How YOLO11 Computer Vision Works:**\n\n• Upon uploading photo or video evidence, the YOLO11 model identifies road distress classes (potholes, structural cracks).\n• It draws localized bounding boxes on the canvas and measures classification confidence (e.g. 94%).\n• The detection output feeds into the 6-factor explainable priority engine for instant municipal triage.`,
      actions: [{ label: 'Try AI Detection', action: 'OPEN_REPORT_MODAL', icon: 'camera' }]
    };
  }

  responseGeneralHelp(lang) {
    if (lang === 'mr') {
      return {
        text: `मी तुम्हाला खालील विषयांवर मदत करू शकतो:\n• **खड्ड्याची तक्रार कशी करावी?**\n• **माझी तक्रार कशी ट्रॅक करावी?**\n• **प्राधान्य गुण (Priority Score) कसा ठरतो?**\n• **९०% दुरुस्ती आणि निरीक्षण म्हणजे काय?**\n• **खड्डे नकाशा कसा वापरावा?**\n\nकृपया आपला प्रश्न टाइप करा किंवा खालील पर्यायांवर क्लिक करा.`,
        actions: [
          { label: 'नुकसान नोंदवा', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
          { label: 'खड्डे नकाशा', action: 'NAVIGATE_MAP', icon: 'map' }
        ]
      };
    }
    if (lang === 'hi') {
      return {
        text: `मैं आपकी इन विषयों में सहायता कर सकता हूँ:\n• **सड़क खड्डे की रिपोर्ट कैसे करें?**\n• **शिकायत कैसे ट्रैक करें?**\n• **प्राथमिकता स्कोर का क्या अर्थ है?**\n• **९०% मरम्मत और निगरानी अवधि क्या है?**\n• **खड्डा मानचित्र कैसे देखें?**\n\nकृपया अपना प्रश्न टाइप करें या नीचे दिए गए विकल्पों में से चुनें।`,
        actions: [
          { label: 'क्षति रिपोर्ट करें', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
          { label: 'खड्डा मानचित्र', action: 'NAVIGATE_MAP', icon: 'map' }
        ]
      };
    }
    return {
      text: `I can assist you with:\n• **How to report a pothole or road crack**\n• **Tracking your complaint status**\n• **Explaining AI detection & priority scoring**\n• **Understanding 90% repair & 30-day post-repair monitoring**\n• **Using the Pothole Map & safe route navigation**\n\nFeel free to ask a question or tap one of the suggested actions below!`,
      actions: [
        { label: 'Report Road Damage', action: 'OPEN_REPORT_MODAL', icon: 'camera' },
        { label: 'Pothole Map', action: 'NAVIGATE_MAP', icon: 'map' }
      ]
    };
  }
}

export const AiAssistantService = new AiAssistantServiceManager();

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const pool = require("./db");
const cors = require("cors");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { PriorityEngine } = require("./priorityEngine");
const { runMigration } = require("./migrate");

// Ensure database schema migrations and seed demo engineers are present
runMigration().catch((err) => console.error("[Startup Migration Warning]:", err.message));

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve frontend static files
const frontendDir = path.join(__dirname, "../Prototye_MardDrishti");
app.use(express.static(frontendDir));
app.use(express.static(path.join(__dirname, "../frontend")));

// Helper to generate IDs within 30 characters
function generateComplaintId() {
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  const time = Date.now().toString().slice(-6);
  return `MD-${time}-${rand}`; // e.g. MD-123456-A1B2C3D4 (total 18 chars, well within 30)
}

// -------------------------------------------------------------
// Authentication, Session Token & RBAC Authorization
// -------------------------------------------------------------
const AUTH_SECRET = process.env.SESSION_SECRET || "margdrishti_auth_secret_key_2026_sih";

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  try {
    const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (req.headers["x-auth-token"]) {
    return String(req.headers["x-auth-token"]).trim();
  }
  if (req.query && req.query.token) {
    return String(req.query.token).trim();
  }
  return null;
}

function authenticateUser(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.user_id) {
    return res.status(401).json({ message: "Invalid or expired session token. Please log in again." });
  }

  req.user = payload;
  next();
}

// -------------------------------------------------------------
// Helper: Persistent In-App Notification Dispatcher
// -------------------------------------------------------------
async function createNotification(dbClient, { recipient_id, complaint_id, title, message, event_type, metadata = {} }) {
  if (!recipient_id) return null;
  try {
    const res = await dbClient.query(
      `INSERT INTO road.notifications (recipient_id, complaint_id, title, message, event_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [recipient_id, complaint_id || null, title, message, event_type, JSON.stringify(metadata)]
    );
    return res.rows[0];
  } catch (err) {
    console.error("[Notification Error]:", err.message);
    return null;
  }
}

// -------------------------------------------------------------
// YOLO11 Python Inference Service Management
// -------------------------------------------------------------
const YOLO_SERVICE_PORT = process.env.YOLO_PORT || 5001;
const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || `http://127.0.0.1:${YOLO_SERVICE_PORT}`;
let yoloChildProcess = null;

function ensureYoloService() {
  fetch(`${YOLO_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1500) })
    .then((res) => {
      if (res.ok) {
        console.log(`[YOLO11 Service] Connected to existing service at ${YOLO_SERVICE_URL}`);
      }
    })
    .catch(() => {
      console.log(`[YOLO11 Service] Spawning Python inference service on port ${YOLO_SERVICE_PORT}...`);
      const pyScript = path.join(__dirname, "yolo_service.py");
      const pyExe = process.env.PYTHON_PATH || "python";
      yoloChildProcess = spawn(pyExe, [pyScript], {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        detached: false
      });
      yoloChildProcess.on("error", (err) => {
        console.error("[YOLO11 Service] Failed to spawn Python process:", err.message);
      });
      yoloChildProcess.on("exit", (code, signal) => {
        console.log(`[YOLO11 Service] Process exited (code: ${code}, signal: ${signal})`);
        yoloChildProcess = null;
      });
    });
}

// Start YOLO inference service alongside backend
ensureYoloService();

process.on("exit", () => {
  if (yoloChildProcess) {
    try { yoloChildProcess.kill(); } catch (_) {}
  }
});
process.on("SIGINT", () => {
  if (yoloChildProcess) {
    try { yoloChildProcess.kill(); } catch (_) {}
  }
  process.exit();
});

// -------------------------------------------------------------
// Root & Health Checks
// -------------------------------------------------------------
app.get("/api", (req, res) => {
  res.json({ message: "MargDrishti backend is running" });
});

app.get("/api/ai/health", async (req, res) => {
  try {
    const response = await fetch(`${YOLO_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(503).json({
      status: "unavailable",
      error: "YOLO11 Python inference service is offline or initializing.",
      details: err.message
    });
  }
});

app.post("/api/ai/analyze", async (req, res) => {
  const { image, mediaType, options } = req.body;
  if (!image) {
    return res.status(400).json({ success: false, error: "Image is required for AI analysis." });
  }

  // Handle video evidence: preserve video sampler demo behavior
  if (mediaType === "video") {
    return res.json({
      success: true,
      mediaType: "video",
      damageType: options?.damageType || "POTHOLE",
      severity: "HIGH",
      confidence: 0.91,
      videoDetails: {
        duration: options?.duration || "00:14",
        framesAnalyzed: 12,
        framesWithDetections: 4,
        highestConfidence: 0.91,
        evidenceTimestamp: "00:08"
      },
      detections: [
        { className: options?.damageType === "CRACK" ? "crack" : "pothole", confidence: 0.91, bbox: [0.24, 0.36, 0.45, 0.38] }
      ],
      inferenceTimeMs: 480,
      modelVersion: "YOLO11-RDD2022-VideoSampler",
      modelLabel: "Video Analysis Demo (Sampled Frame Aggregation)",
      inferenceSource: "VIDEO_SAMPLER_DEMO"
    });
  }

  // Handle photo evidence: execute real inference on trained checkpoint
  try {
    const yoloRes = await fetch(`${YOLO_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image,
        conf: options?.conf || 0.25,
        iou: options?.iou || 0.45
      }),
      signal: AbortSignal.timeout(30000)
    });

    const result = await yoloRes.json();
    if (!yoloRes.ok) {
      return res.status(yoloRes.status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("[AI Analyze Route Error]:", err.message);
    return res.status(503).json({
      success: false,
      error: "Trained YOLO11 inference service is currently unavailable. Ensure the Python YOLO service is running.",
      details: err.message,
      status: "SERVICE_UNAVAILABLE"
    });
  }
});

app.get("/api/health/db", async (req, res) => {
  const configStatus = typeof pool.getConfigurationStatus === "function"
    ? pool.getConfigurationStatus()
    : { configured: true };

  if (!configStatus.configured) {
    return res.status(503).json({
      message: "Database configuration is incomplete",
      error: `Set DATABASE_URL or provide the missing database variables: ${configStatus.missingVariables.join(", ")}.`,
      configuration: configStatus,
    });
  }

  try {
    const result = await pool.query(`
      SELECT current_database() AS database,
             current_user AS username,
             current_schema() AS schema
    `);

    // Check the schema/table required by login, not just whether PostgreSQL is reachable.
    const usersTable = await pool.query(
      "SELECT to_regclass('road.users') AS users_table"
    );

    res.json({
      message: "Database connection successful",
      ...result.rows[0],
      requiredLoginTableExists: Boolean(usersTable.rows[0]?.users_table),
      ...(usersTable.rows[0]?.users_table
        ? {}
        : { schemaWarning: "The road.users table is missing. The base database schema must be created before login can work." }),
    });
  } catch (error) {
    const errorCode = error?.code || "UNKNOWN";
    const errorMessage = error?.message || "No error message was provided by the PostgreSQL driver.";
    console.error("[Database health check failed]", {
      code: errorCode,
      message: errorMessage,
      detail: error?.detail,
      hint: error?.hint,
    });
    res.status(503).json({
      message: "Database connection failed",
      error: errorMessage,
      code: errorCode,
      configuration: configStatus,
    });
  }
});

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  console.log("LOGIN ROUTE HIT:", req.body?.role, req.body?.identifier);
  const { role, identifier, email, password } = req.body;
  const loginRole = (role || "CITIZEN").toUpperCase();
  const loginIdent = (identifier || email || "").trim();
  const loginPass = (password || "").trim();

  if (!loginIdent) {
    return res.status(400).json({ message: "Email or User ID is required." });
  }

  if (!loginPass) {
    return res.status(400).json({ message: "Password is required." });
  }

  try {
    // Look up user by user_id, email, or phone matching role (or matching engineer/authority dual-role)
    const result = await pool.query(
      `SELECT user_id, name, email, password_hash, phone, role, created_at
       FROM road.users
       WHERE (role = $1 OR ($1 = 'ENGINEER' AND user_id = 'AUTHUSER-0001')) AND (
         LOWER(email) = LOWER($2) OR
         LOWER(user_id) = LOWER($2) OR
         phone = $2
       )
       LIMIT 1`,
      [loginRole, loginIdent]
    );

    let user = result.rows[0];

    // Support explicit demo aliases only
    if (!user) {
      if (loginRole === "CITIZEN" && loginIdent.toLowerCase() === "citizen@margdrishti.demo") {
        const fallback = await pool.query(`SELECT * FROM road.users WHERE user_id = 'CIT-0001' AND role = 'CITIZEN'`);
        user = fallback.rows[0];
      } else if (loginRole === "AUTHORITY" && loginIdent.toLowerCase() === "authority@margdrishti.demo") {
        const fallback = await pool.query(`SELECT * FROM road.users WHERE user_id = 'AUTHUSER-0001' AND role = 'AUTHORITY'`);
        user = fallback.rows[0];
      } else if (loginRole === "ENGINEER" && (loginIdent.toLowerCase() === "engineer@margdrishti.demo" || loginIdent.toLowerCase() === "rajesh.engineer@margdrishti.demo")) {
        const fallback = await pool.query(`SELECT * FROM road.users WHERE user_id = 'ENG-0001' AND role = 'ENGINEER'`);
        user = fallback.rows[0];
      }
    }

    if (!user) {
      return res.status(404).json({
        message: loginRole === "AUTHORITY"
          ? "Authority account not found. Please contact administration."
          : loginRole === "ENGINEER"
          ? "Engineer account not found. Please log in with a registered engineer ID or demo account."
          : "Citizen account not found. Please sign up for a citizen account."
      });
    }

    // Verify password: check stored password_hash or standard registered demo passwords
    const isValidPass =
      user.password_hash === loginPass ||
      (user.user_id === "CIT-0001" && loginPass === "Citizen@123") ||
      (user.user_id === "AUTHUSER-0001" && loginPass === "Authority@123") ||
      (user.user_id === "ENG-0001" && (loginPass === "Engineer@123" || loginPass === "Authority@123"));

    if (!isValidPass) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    const token = signToken({
      user_id: user.user_id,
      role: user.role,
      name: user.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    // Return safe user object with authenticated session token
    res.json({
      success: true,
      token,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        citizenId: user.role === "CITIZEN" ? user.user_id : null,
        authorityId: user.role === "AUTHORITY" ? user.user_id : null,
        engineerId: (user.role === "ENGINEER" || user.user_id === "AUTHUSER-0001") ? user.user_id : null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.toLowerCase(),
        role_raw: user.role
      }
    });
  } catch (error) {
    console.error("[Login] Database/query failure:", {
      code: error?.code || "UNKNOWN",
      message: error?.message || "No error message was provided by the PostgreSQL driver.",
      detail: error?.detail,
      hint: error?.hint,
    });
    res.status(500).json({
      message: "Login failed because the database query could not be completed.",
      code: error?.code || "UNKNOWN",
    });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { role, name, email, phone, mobile, password } = req.body;
  const signupRole = (role || "CITIZEN").toUpperCase();
  const userName = (name || "").trim();
  const userEmail = (email || "").trim().toLowerCase();
  const userPhone = (phone || mobile || "").trim();
  const userPass = (password || "demo_hash_123").trim();

  if (!userName || !userEmail) {
    return res.status(400).json({ message: "Name and email are required." });
  }

  if (signupRole !== "CITIZEN" && signupRole !== "AUTHORITY" && signupRole !== "ENGINEER") {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if email already exists
    const existing = await client.query(
      `SELECT user_id, role FROM road.users WHERE LOWER(email) = LOWER($1)`,
      [userEmail]
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    
    // Generate the next user_id safely
    const prefix =
      signupRole === "CITIZEN" ? "CIT-" :
      signupRole === "ENGINEER" ? "ENG-" :
      "AUTHUSER-";

    // Lock the role-specific ID generation process so concurrent
    // signups for the same role do not generate the same ID.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`margdrishti-user-id-${signupRole}`]
    );

    const maxRes = await client.query(
      `SELECT COALESCE(
         MAX(SUBSTRING(user_id FROM '[0-9]+$')::BIGINT),
         0
       ) AS max_num
       FROM road.users
       WHERE role = $1
         AND user_id LIKE $2
         AND user_id ~ $3`,
      [
        signupRole,
        `${prefix}%`,
        signupRole === "CITIZEN"
          ? "^CIT-[0-9]+$"
          : signupRole === "ENGINEER"
            ? "^ENG-[0-9]+$"
            : "^AUTHUSER-[0-9]+$"
      ]
    );

    const nextNum = Number(maxRes.rows[0].max_num) + 1;
    const newUserId = `${prefix}${String(nextNum).padStart(4, "0")}`;


    const insertResult = await client.query(
      `INSERT INTO road.users (user_id, name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone, role, created_at`,
      [newUserId, userName, userEmail, userPass, userPhone || null, signupRole]
    );

    await client.query("COMMIT");

    const created = insertResult.rows[0];
    const token = signToken({
      user_id: created.user_id,
      role: created.role,
      name: created.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      token,
      message: "Account created successfully.",
      user: {
        id: created.user_id,
        user_id: created.user_id,
        citizenId: created.role === "CITIZEN" ? created.user_id : null,
        authorityId: created.role === "AUTHORITY" ? created.user_id : null,
        name: created.name,
        email: created.email,
        phone: created.phone,
        role: created.role.toLowerCase(),
        role_raw: created.role
      }
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Signup error:", error);
    res.status(500).json({ message: "Failed to create account.", error: error.message });
  } finally {
    client.release();
  }
});

app.get("/api/users", async (req, res) => {
  const { role } = req.query;
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, phone, role, created_at
       FROM road.users
       WHERE ($1::varchar IS NULL OR role = UPPER($1))
       ORDER BY user_id ASC`,
      [role || null]
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Unable to retrieve users.", error: error.message });
  }
});

app.get("/api/authorities", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, ar.area_name, ar.city, ar.district, ar.state
      FROM road.authorities a
      LEFT JOIN road.authority_areas ar ON ar.authority_id = a.authority_id
      ORDER BY a.authority_id ASC
    `);
    res.json({ authorities: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Unable to retrieve authorities.", error: error.message });
  }
});

// -------------------------------------------------------------
// Complaint Submission (Atomic 4-Table Transaction)
// -------------------------------------------------------------
app.post("/api/complaints", authenticateUser, async (req, res) => {
  const {
    citizen_id,
    damage_type,
    description,
    image_path,
    severity,
    priority_score,
    latitude,
    longitude,
    address,
    city,
    district,
    state,
    location_source,
    ai_analysis
  } = req.body;

  // Identity and authorization verification
  if (req.user.role === "CITIZEN" && citizen_id && citizen_id !== req.user.user_id) {
    return res.status(403).json({ message: "Forbidden: You cannot file complaints on behalf of another citizen." });
  }
  const effectiveCitizenId = req.user.role === "CITIZEN" ? req.user.user_id : (citizen_id || req.user.user_id);

  // Validate required fields
  if (
    typeof effectiveCitizenId !== "string" ||
    !effectiveCitizenId.trim() ||
    typeof damage_type !== "string" ||
    !damage_type.trim() ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      message: "Provide a valid damage_type, latitude, and longitude.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find the authenticated user in road.users
    const userResult = await client.query(
      `SELECT user_id, name, role
       FROM road.users
       WHERE user_id = $1`,
      [effectiveCitizenId]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: `Citizen account '${effectiveCitizenId}' not found. Please log in with a valid account.`,
      });
    }

    const verifiedCitizenId = userResult.rows[0].user_id;

    // Resolve authority_id from city or fallback to existing authority AUTH-0001
    const authLookup = await client.query(
      `SELECT authority_id FROM road.authority_areas WHERE LOWER(city) = LOWER($1) LIMIT 1`,
      [(city || "Kolhapur").trim()]
    );
    let resolvedAuthId = authLookup.rows[0]?.authority_id;
    if (!resolvedAuthId) {
      const defaultAuth = await client.query(`SELECT authority_id FROM road.authorities LIMIT 1`);
      resolvedAuthId = defaultAuth.rows[0]?.authority_id || "AUTH-0001";
    }

    // Generate unique complaint ID (<= 30 characters)
    const idResult = await client.query(`
  SELECT 'MD-' || LPAD(
    nextval('road.complaint_id_seq')::TEXT,
    6,
    '0'
  ) AS complaint_id
`);

const complaintId = idResult.rows[0].complaint_id;
    const initialStatus = "REPORTED";
    const now = new Date();

    // Calculate or preserve dynamic explainable priority breakdown
    const reqBreakdown = req.body.priority_breakdown || req.body.priority?.breakdown;
    let finalPriorityScore = priority_score != null ? Number(priority_score) : null;
    let finalBreakdown = reqBreakdown;

    if (!finalBreakdown || finalPriorityScore == null) {
      const calcP = PriorityEngine.calculatePriority({
        damageType: damage_type,
        severity,
        confidence: ai_analysis?.confidence != null ? (Number(ai_analysis.confidence) > 1 ? Number(ai_analysis.confidence) / 100 : Number(ai_analysis.confidence)) : 0.92,
        roadType: req.body.road_type || "ARTERIAL",
        trafficExposure: req.body.traffic_exposure || "HIGH",
        sensitiveZones: req.body.sensitive_zones || ["SCHOOL", "TRANSIT"],
        corroboratingCount: req.body.corroborating_count || 1
      });
      if (finalPriorityScore == null) finalPriorityScore = calcP.score;
      if (!finalBreakdown) finalBreakdown = calcP.breakdown;
    }

    // 1. Save Complaint
    const complaintResult = await client.query(
      `INSERT INTO road.complaints (
        complaint_id,
        citizen_id,
        authority_id,
        damage_type,
        description,
        image_path,
        severity,
        priority_score,
        priority_breakdown,
        status,
        complaint_date,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING *`,
      [
        complaintId,
        verifiedCitizenId,
        resolvedAuthId,
        damage_type.trim(),
        description ?? null,
        image_path ?? null,
        String(severity ?? "HIGH").trim().toUpperCase().slice(0, 20),
        finalPriorityScore,
        JSON.stringify(finalBreakdown),
        initialStatus,
        now,
      ]
    );

    console.log("Complaint values being saved:", {
      severity,
      severityLength: String(severity ?? "").length,
      location_source,
      locationSourceLength: String(location_source ?? "").length,
      priority_score: finalPriorityScore
    });
    // 2. Save Location
    const locationResult = await client.query(
      `INSERT INTO road.complaint_locations (
        complaint_id,
        latitude,
        longitude,
        address,
        city,
        district,
        state,
        location_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        complaintId,
        latitude,
        longitude,
        address ?? null,
        city ?? "Kolhapur",
        district ?? "Kolhapur",
        state ?? "Maharashtra",
        ["GPS", "MANUAL", "MAP_SELECTED"].includes(
          String(location_source ?? "").trim().toUpperCase()
        )
          ? String(location_source).trim().toUpperCase()
          : "GPS",
      ]
    );

    // 3. Save AI Analysis
    const aiConfidence = ai_analysis?.confidence != null
      ? Number(ai_analysis.confidence)
      : 92.50;
    const aiModel = ai_analysis?.model_name || "YOLO11";
    const aiSeverity = String(
      ai_analysis?.severity || severity || "HIGH"
    ).trim().toUpperCase().slice(0, 20);
    const aiDamageType = ai_analysis?.damage_type || damage_type.trim();
    const aiAuthenticity = ai_analysis?.image_authenticity_status || "ORIGINAL";

    const aiResult = await client.query(
      `INSERT INTO road.ai_analysis (
        complaint_id,
        model_name,
        damage_type,
        confidence,
        severity,
        image_authenticity_status,
        analyzed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        complaintId,
        aiModel,
        aiDamageType,
        aiConfidence,
        aiSeverity,
        aiAuthenticity,
        now,
      ]
    );

    // 4. Record Initial Status History
    const historyResult = await client.query(
      `INSERT INTO road.complaint_status_history (
        complaint_id,
        status,
        changed_by,
        remarks,
        changed_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        complaintId,
        initialStatus,
        verifiedCitizenId,
        "Complaint submitted by citizen via MargDrishti portal.",
        now,
      ]
    );

    // Dispatch Connected In-App Notifications
    await createNotification(client, {
      recipient_id: verifiedCitizenId,
      complaint_id: complaintId,
      title: "Complaint Received Successfully",
      message: `Your complaint ${complaintId} has been received and recorded by the system.`,
      event_type: "COMPLAINT_SUBMITTED",
      metadata: { priority_score: finalPriorityScore, damage_type: damage_type.trim() }
    });

    await createNotification(client, {
      recipient_id: "AUTHUSER-0001",
      complaint_id: complaintId,
      title: "New Road Hazard Complaint",
      message: `New complaint ${complaintId} reported at ${address || city || "Kolhapur"}. Priority: ${finalPriorityScore}/100.`,
      event_type: "NEW_COMPLAINT_REPORTED",
      metadata: { priority_score: finalPriorityScore, damage_type: damage_type.trim() }
    });

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully.",
      complaint: complaintResult.rows[0],
      location: locationResult.rows[0],
      ai_analysis: aiResult.rows[0],
      history: historyResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Complaint submission error:", error);
    return res.status(500).json({
      message: "Unable to submit complaint.",
      error: error.message,
      code: error.code,
    });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Get Complaints (List with Joined Details & Access Control)
// -------------------------------------------------------------
app.get("/api/complaints", authenticateUser, async (req, res) => {
  const { citizen_id, status } = req.query;

  let effectiveCitizenId = citizen_id || null;

  // Role-based data isolation
  if (req.user.role === "CITIZEN") {
    // Prevent a citizen from querying another citizen's records
    if (citizen_id && citizen_id !== req.user.user_id) {
      return res.status(403).json({ message: "Forbidden: You cannot access complaints belonging to other citizens." });
    }
    // Always restrict citizen to their own complaints
    effectiveCitizenId = req.user.user_id;
  }

  try {
    const result = await pool.query(
      `SELECT
          c.complaint_id,
          c.citizen_id,
          u.name AS citizen_name,
          u.phone AS citizen_phone,
          c.authority_id,
          auth.authority_name,
          c.damage_type,
          c.description,
          c.image_path,
          c.severity,
          c.priority_score,
          c.priority_breakdown,
          c.status,
          c.complaint_date,
          c.created_at,
          c.updated_at,
          l.location_id,
          l.latitude,
          l.longitude,
          l.address,
          l.city,
          l.district,
          l.state,
          l.location_source,
          ai.analysis_id,
          ai.model_name AS ai_model,
          ai.confidence AS ai_confidence,
          ai.severity AS ai_severity,
          ai.image_authenticity_status AS ai_authenticity,
          asn.assignment_id,
          asn.assigned_to,
          asn_u.name AS assigned_to_name,
          asn_u.phone AS assigned_to_phone,
          asn.assigned_at,
          asn.expected_completion_date,
          asn.status AS assignment_status,
          asn.acknowledged_at,
          asn.remarks AS assignment_remarks,
          rep.repair_id,
          rep.engineer_id,
          rep.repair_started_at,
          rep.repair_completed_at,
          rep.repair_status,
          rep.progress_pct,
          rep.repair_notes,
          rep.completion_image_path,
          rep.repair_description,
          rm.monitoring_id,
          rm.start_date AS monitoring_start_date,
          rm.end_date AS monitoring_end_date,
          rm.monitoring_status,
          rm.stability_score,
          rm.observations_count,
          rm.result AS monitoring_result,
          rm.authority_confirmation
       FROM road.complaints c
       LEFT JOIN road.users u ON u.user_id = c.citizen_id
       LEFT JOIN road.authorities auth ON auth.authority_id = c.authority_id
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       LEFT JOIN LATERAL (
         SELECT * FROM road.ai_analysis
         WHERE complaint_id = c.complaint_id
         ORDER BY analyzed_at DESC LIMIT 1
       ) ai ON true
       LEFT JOIN LATERAL (
         SELECT * FROM road.assignments
         WHERE complaint_id = c.complaint_id AND status != 'SUPERSEDED'
         ORDER BY assigned_at DESC LIMIT 1
       ) asn ON true
       LEFT JOIN road.users asn_u ON asn_u.user_id = asn.assigned_to
       LEFT JOIN LATERAL (
         SELECT * FROM road.repairs
         WHERE complaint_id = c.complaint_id
         ORDER BY repair_id DESC LIMIT 1
       ) rep ON true
       LEFT JOIN LATERAL (
         SELECT * FROM road.repair_monitoring
         WHERE repair_id = rep.repair_id
         ORDER BY monitoring_id DESC LIMIT 1
       ) rm ON true
       WHERE ($1::varchar IS NULL OR c.citizen_id = $1)
         AND ($2::varchar IS NULL OR c.status = $2)
       ORDER BY c.created_at DESC`,
      [effectiveCitizenId, status || null]
    );

    const complaints = result.rows.map((row) => {
      if (!row.priority_breakdown) {
        const confNum = row.ai_confidence ? (Number(row.ai_confidence) > 1 ? Number(row.ai_confidence) / 100 : Number(row.ai_confidence)) : 0.92;
        const calculated = PriorityEngine.calculatePriority({
          damageType: row.damage_type,
          severity: row.severity || row.ai_severity,
          confidence: confNum,
          detectionCount: 1,
          surfaceDamageAreaPct: 0,
          roadType: "ARTERIAL",
          trafficExposure: "HIGH",
          sensitiveZones: ["SCHOOL", "TRANSIT"],
          corroboratingCount: 1
        });
        row.priority_breakdown = calculated.breakdown;
        if (!row.priority_score) row.priority_score = calculated.score;
      }
      return row;
    });

    res.json({
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    console.error("Fetch complaints error:", error.message);
    res.status(500).json({ message: "Unable to retrieve complaints.", error: error.message });
  }
});

// -------------------------------------------------------------
// Public Map Hazards Endpoint (Sanitized GIS Data for map.html)
// -------------------------------------------------------------
app.get("/api/complaints/public-map", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          c.complaint_id,
          c.damage_type,
          c.description,
          c.image_path,
          c.severity,
          c.priority_score,
          c.status,
          c.created_at,
          l.latitude,
          l.longitude,
          l.address,
          l.city,
          l.district,
          l.state
       FROM road.complaints c
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       ORDER BY c.created_at DESC`
    );

    res.json({
      count: result.rowCount,
      complaints: result.rows
    });
  } catch (error) {
    console.error("Fetch public map hazards error:", error.message);
    res.status(500).json({ message: "Unable to retrieve public map hazards.", error: error.message });
  }
});

// -------------------------------------------------------------
// Get Single Complaint (Complete Timeline & Telemetry with Authorization)
// -------------------------------------------------------------
app.get("/api/complaints/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;

  try {
    const complaintRes = await pool.query(
      `SELECT
          c.*,
          u.name AS citizen_name,
          u.phone AS citizen_phone,
          auth.authority_name,
          l.location_id,
          l.latitude,
          l.longitude,
          l.address,
          l.city,
          l.district,
          l.state,
          l.location_source,
          ai.analysis_id,
          ai.model_name AS ai_model,
          ai.confidence AS ai_confidence,
          ai.severity AS ai_severity,
          ai.image_authenticity_status AS ai_authenticity,
          asn.assignment_id,
          asn.assigned_to,
          asn_u.name AS assigned_to_name,
          asn_u.phone AS assigned_to_phone,
          asn.assigned_at,
          asn.expected_completion_date,
          asn.status AS assignment_status,
          asn.acknowledged_at,
          asn.remarks AS assignment_remarks,
          rep.repair_id,
          rep.engineer_id,
          rep.repair_started_at,
          rep.repair_completed_at,
          rep.repair_status,
          rep.progress_pct,
          rep.repair_notes,
          rep.completion_image_path,
          rep.repair_description,
          rm.monitoring_id,
          rm.start_date AS monitoring_start_date,
          rm.end_date AS monitoring_end_date,
          rm.monitoring_status,
          rm.stability_score,
          rm.observations_count,
          rm.result AS monitoring_result,
          rm.authority_confirmation
       FROM road.complaints c
       LEFT JOIN road.users u ON u.user_id = c.citizen_id
       LEFT JOIN road.authorities auth ON auth.authority_id = c.authority_id
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       LEFT JOIN LATERAL (
         SELECT * FROM road.ai_analysis
         WHERE complaint_id = c.complaint_id
         ORDER BY analyzed_at DESC LIMIT 1
       ) ai ON true
       LEFT JOIN LATERAL (
         SELECT * FROM road.assignments
         WHERE complaint_id = c.complaint_id AND status != 'SUPERSEDED'
         ORDER BY assigned_at DESC LIMIT 1
       ) asn ON true
       LEFT JOIN road.users asn_u ON asn_u.user_id = asn.assigned_to
       LEFT JOIN LATERAL (
         SELECT * FROM road.repairs
         WHERE complaint_id = c.complaint_id
         ORDER BY repair_id DESC LIMIT 1
       ) rep ON true
       LEFT JOIN LATERAL (
         SELECT * FROM road.repair_monitoring
         WHERE repair_id = rep.repair_id
         ORDER BY monitoring_id DESC LIMIT 1
       ) rm ON true
       WHERE c.complaint_id = $1`,
      [id]
    );

    if (complaintRes.rowCount === 0) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    const complaint = complaintRes.rows[0];

    // Citizen authorization check: cannot view other citizens' complaints
    if (req.user.role === "CITIZEN" && complaint.citizen_id !== req.user.user_id) {
      return res.status(403).json({ message: "Access denied. You do not have permission to view another citizen's complaint." });
    }

    // Ensure dynamic explainable priority breakdown is present
    if (!complaint.priority_breakdown) {
      const confNum = complaint.ai_confidence ? (Number(complaint.ai_confidence) > 1 ? Number(complaint.ai_confidence) / 100 : Number(complaint.ai_confidence)) : 0.92;
      const calculated = PriorityEngine.calculatePriority({
        damageType: complaint.damage_type,
        severity: complaint.severity || complaint.ai_severity,
        confidence: confNum,
        detectionCount: 1,
        surfaceDamageAreaPct: 0,
        roadType: "ARTERIAL",
        trafficExposure: "HIGH",
        sensitiveZones: ["SCHOOL", "TRANSIT"],
        corroboratingCount: 1
      });
      complaint.priority_breakdown = calculated.breakdown;
      if (!complaint.priority_score) complaint.priority_score = calculated.score;
    }

    // Fetch complete status history timeline
    const historyRes = await pool.query(
      `SELECT
          h.history_id,
          h.complaint_id,
          h.status,
          h.changed_by,
          u.name AS changed_by_name,
          u.role AS changed_by_role,
          h.remarks,
          h.changed_at
       FROM road.complaint_status_history h
       LEFT JOIN road.users u ON u.user_id = h.changed_by
       WHERE h.complaint_id = $1
       ORDER BY h.changed_at ASC`,
      [id]
    );

    // Fetch sensor observations if monitoring exists
    const sensorRes = await pool.query(
      `SELECT
          so.observation_id,
          so.monitoring_id,
          so.latitude,
          so.longitude,
          so.speed,
          so.acceleration_magnitude,
          so.peak_acceleration,
          so.jerk,
          so.gyroscope_change,
          so.confidence,
          so.observation_time
       FROM road.sensor_observations so
       JOIN road.repair_monitoring rm ON rm.monitoring_id = so.monitoring_id
       JOIN road.repairs r ON r.repair_id = rm.repair_id
       WHERE r.complaint_id = $1
       ORDER BY so.observation_time DESC`,
      [id]
    );

    res.json({
      complaint,
      timeline: historyRes.rows,
      sensor_observations: sensorRes.rows,
    });
  } catch (error) {
    console.error("Fetch complaint details error:", error);
    res.status(500).json({ message: "Unable to retrieve complaint details.", error: error.message });
  }
});

// -------------------------------------------------------------
// Authority Workflow: Status Update (Generic)
// -------------------------------------------------------------
app.patch("/api/complaints/:id/status", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot modify complaint status." });
  }

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorId = req.user.user_id;

    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = $1, updated_at = NOW()
       WHERE complaint_id = $2
       RETURNING *`,
      [status, id]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (
        complaint_id,
        status,
        changed_by,
        remarks,
        changed_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *`,
      [id, status, actorId, remarks || `Status changed to ${status}.`]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: updateRes.rows[0],
      history: histRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Update status error:", error);
    res.status(500).json({ message: "Failed to update complaint status.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Authority Workflow: Verify Complaint
// -------------------------------------------------------------
app.post("/api/complaints/:id/verify", authenticateUser, async (req, res) => {
  if (req.user.role !== "AUTHORITY") {
    return res.status(403).json({ message: "Forbidden: Only authorized municipal officials can verify complaints." });
  }

  const { id } = req.params;
  const { remarks } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorId = req.user.user_id;

    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = 'VERIFIED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'VERIFIED', $2, $3, NOW())
       RETURNING *`,
      [id, actorId, remarks || "Complaint verified by authority control room and confirmed for maintenance triage."]
    );

    await client.query("COMMIT");
    res.json({ success: true, complaint: updateRes.rows[0], history: histRes.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to verify complaint.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Available Engineers Endpoint (Authority Assignment)
// -------------------------------------------------------------
app.get("/api/engineers", authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        CASE 
          WHEN u.user_id = 'ENG-0001' THEN 'Assistant Executive Engineer'
          WHEN u.user_id = 'ENG-0002' THEN 'Junior Engineer (Civil)'
          WHEN u.user_id = 'ENG-0003' THEN 'Senior PWD Field Engineer'
          WHEN u.user_id = 'AUTHUSER-0001' THEN 'Municipal Engineer'
          ELSE 'Zonal Road Engineer'
        END AS designation,
        CASE 
          WHEN u.user_id = 'ENG-0001' THEN 'East Zone & Central Corridor'
          WHEN u.user_id = 'ENG-0002' THEN 'South Zone & Residential Wards'
          WHEN u.user_id = 'ENG-0003' THEN 'North Zone & Highway Link'
          ELSE 'Kolhapur City Central'
        END AS zone,
        COUNT(c.complaint_id) FILTER (WHERE c.status IN ('ASSIGNED', 'IN_PROGRESS'))::int AS active_tasks,
        TRUE AS is_demo_account
      FROM road.users u
      LEFT JOIN road.assignments asn ON asn.assigned_to = u.user_id AND asn.status != 'SUPERSEDED'
      LEFT JOIN road.complaints c ON c.complaint_id = asn.complaint_id AND c.status IN ('ASSIGNED', 'IN_PROGRESS')
      WHERE u.role IN ('ENGINEER', 'AUTHORITY')
      GROUP BY u.user_id, u.name, u.email, u.phone, u.role
      ORDER BY active_tasks ASC, u.name ASC
    `);

    res.json({ count: result.rowCount, engineers: result.rows });
  } catch (error) {
    console.error("Fetch engineers error:", error.message);
    res.status(500).json({ message: "Failed to fetch engineers.", error: error.message });
  }
});

// -------------------------------------------------------------
// Connected In-App Notification Endpoints
// -------------------------------------------------------------
app.get("/api/notifications", authenticateUser, async (req, res) => {
  const queryRecipient = req.query.recipient_id;
  let effectiveRecipient = req.user.user_id;

  if (req.user.role === "CITIZEN" || req.user.role === "ENGINEER") {
    if (queryRecipient && queryRecipient !== req.user.user_id) {
      return res.status(403).json({ message: "Forbidden: You cannot access notifications for other users." });
    }
    effectiveRecipient = req.user.user_id;
  } else if (req.user.role === "AUTHORITY") {
    effectiveRecipient = queryRecipient || req.user.user_id;
  }

  try {
    const result = await pool.query(
      `SELECT notification_id, recipient_id, complaint_id, title, message, event_type, is_read, metadata, created_at
       FROM road.notifications
       WHERE recipient_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [effectiveRecipient]
    );

    const unreadCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM road.notifications WHERE recipient_id = $1 AND is_read = false`,
      [effectiveRecipient]
    );

    res.json({
      count: result.rowCount,
      unread_count: unreadCount.rows[0].count,
      notifications: result.rows
    });
  } catch (error) {
    console.error("Fetch notifications error:", error.message);
    res.status(500).json({ message: "Failed to fetch notifications.", error: error.message });
  }
});

app.patch("/api/notifications/:id/read", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const effectiveRecipient = req.user.user_id;

  try {
    const result = await pool.query(
      `UPDATE road.notifications
       SET is_read = true
       WHERE notification_id = $1 AND ($2::varchar IS NULL OR recipient_id = $2)
       RETURNING *`,
      [id, effectiveRecipient]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification.", error: error.message });
  }
});

app.patch("/api/notifications/read-all", authenticateUser, async (req, res) => {
  const queryRecipient = req.body.recipient_id;
  const effectiveRecipient = (req.user.role === "AUTHORITY" && queryRecipient) ? queryRecipient : req.user.user_id;

  try {
    await pool.query(
      `UPDATE road.notifications
       SET is_read = true
       WHERE recipient_id = $1 AND is_read = false`,
      [effectiveRecipient]
    );

    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications read.", error: error.message });
  }
});

app.get("/api/notifications/unread-count", authenticateUser, async (req, res) => {
  const queryRecipient = req.query.recipient_id;
  const effectiveRecipient = (req.user.role === "AUTHORITY" && queryRecipient) ? queryRecipient : req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM road.notifications WHERE recipient_id = $1 AND is_read = false`,
      [effectiveRecipient]
    );
    res.json({ unread_count: result.rows[0].count });
  } catch (error) {
    res.status(500).json({ message: "Failed to count unread notifications.", error: error.message });
  }
});

// -------------------------------------------------------------
// Authority Workflow: Assign Engineer (Realistic Connected Workflow)
// -------------------------------------------------------------
app.post("/api/complaints/:id/assign", authenticateUser, async (req, res) => {
  if (req.user.role !== "AUTHORITY") {
    return res.status(403).json({ message: "Forbidden: Only authorized municipal officials can assign complaints." });
  }

  const { id } = req.params;
  const { assigned_to, remarks, expected_completion_date } = req.body;
  const assigned_by = req.user.user_id;

  if (!assigned_to) {
    return res.status(400).json({ message: "Engineering personnel selection is required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lock complaint row to prevent race conditions & duplicate clicks
    const cRes = await client.query(
      `SELECT c.complaint_id, c.citizen_id, c.damage_type, c.severity, c.priority_score, c.status,
              l.address, l.city, l.latitude, l.longitude
       FROM road.complaints c
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       WHERE c.complaint_id = $1
       FOR UPDATE OF c`,
      [id]
    );

    if (cRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: `Complaint '${id}' not found.` });
    }
    const complaint = cRes.rows[0];

    // 2. Validate assigned_to engineer in road.users
    const engCheck = await client.query(
      `SELECT user_id, name, email, phone, role FROM road.users WHERE user_id = $1 AND role IN ('ENGINEER', 'AUTHORITY')`,
      [assigned_to.trim()]
    );
    if (engCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Selected engineer '${assigned_to}' is not a valid registered engineer.` });
    }
    const engineer = engCheck.rows[0];

    // 3. Validate assigning authority
    let byUser = (assigned_by || "AUTHUSER-0001").trim();
    const byCheck = await client.query(`SELECT user_id, name FROM road.users WHERE user_id = $1`, [byUser]);
    if (byCheck.rowCount === 0) byUser = "AUTHUSER-0001";

    // 4. Check for previous active assignment on this complaint
    const prevAssignRes = await client.query(
      `SELECT assignment_id, assigned_to FROM road.assignments WHERE complaint_id = $1 AND status != 'SUPERSEDED' ORDER BY assigned_at DESC LIMIT 1`,
      [id]
    );
    const isReassignment = prevAssignRes.rowCount > 0 && prevAssignRes.rows[0].assigned_to !== engineer.user_id;
    const prevEngineerId = prevAssignRes.rows[0]?.assigned_to;

    // Prevent accidental duplicate clicks if already assigned to this exact engineer
    if (prevAssignRes.rowCount > 0 && prevAssignRes.rows[0].assigned_to === engineer.user_id && complaint.status === 'ASSIGNED') {
      await client.query("COMMIT");
      return res.json({
        success: true,
        message: `Complaint ${id} is already assigned to ${engineer.name}.`,
        complaint,
        assignment: prevAssignRes.rows[0],
        duplicate_prevented: true
      });
    }

    if (prevAssignRes.rowCount > 0) {
      // Mark previous assignment as superseded to preserve assignment history
      await client.query(
        `UPDATE road.assignments SET status = 'SUPERSEDED' WHERE complaint_id = $1`,
        [id]
      );
    }

    // 5. Insert new assignment record
    const assignRes = await client.query(
      `INSERT INTO road.assignments (complaint_id, assigned_to, assigned_by, assigned_at, expected_completion_date, remarks, status)
       VALUES ($1, $2, $3, NOW(), $4, $5, 'ASSIGNED')
       RETURNING *`,
      [
        id,
        engineer.user_id,
        byUser,
        expected_completion_date || null,
        remarks || `Work order dispatched to ${engineer.name} for road repair.`
      ]
    );

    // 6. Update complaint status consistently
    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = 'ASSIGNED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    // 7. Record status history
    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'ASSIGNED', $2, $3, NOW())
       RETURNING *`,
      [
        id,
        byUser,
        isReassignment
          ? `Work order reassigned from ${prevEngineerId} to ${engineer.name} (${engineer.user_id}).`
          : `Work order assigned to ${engineer.name} (${engineer.user_id}). Minimum 15-day assignment period initiated.`
      ]
    );

    // 8. Notifications
    const locStr = complaint.address || complaint.city || "Indiranagar Corridor";
    const prioScore = complaint.priority_score ? Number(complaint.priority_score) : 75;
    const prioLevel = prioScore >= 80 ? "Critical" : prioScore >= 60 ? "High" : "Medium";

    // Engineer notification
    await createNotification(client, {
      recipient_id: engineer.user_id,
      complaint_id: id,
      title: "New Repair Task Assigned",
      message: `You have been assigned complaint ${id} for road damage repair at ${locStr}. Priority: ${prioLevel}. Open the task to view the evidence and location.`,
      event_type: "ENGINEER_ASSIGNED",
      metadata: { priority_score: prioScore, damage_type: complaint.damage_type, location: locStr }
    });

    // Citizen notification
    if (complaint.citizen_id) {
      await createNotification(client, {
        recipient_id: complaint.citizen_id,
        complaint_id: id,
        title: "Engineer Assigned to Your Complaint",
        message: `Engineer ${engineer.name} has been assigned to your complaint ${id} for road inspection and repair at ${locStr}.`,
        event_type: "ENGINEER_ASSIGNED",
        metadata: { engineer_id: engineer.user_id, engineer_name: engineer.name }
      });
    }

    // If reassigned, notify previous engineer
    if (isReassignment && prevEngineerId) {
      await createNotification(client, {
        recipient_id: prevEngineerId,
        complaint_id: id,
        title: "Assignment Transferred",
        message: `Complaint ${id} assignment has been transferred to ${engineer.name}.`,
        event_type: "ASSIGNMENT_REASSIGNED",
        metadata: { reassigned_to: engineer.user_id }
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Complaint ${id} assigned to ${engineer.name}.`,
      complaint: updateRes.rows[0],
      assignment: assignRes.rows[0],
      history: histRes.rows[0],
      engineer: {
        id: engineer.user_id,
        name: engineer.name,
        email: engineer.email,
        phone: engineer.phone
      }
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Assign error:", error);
    res.status(500).json({ message: "Failed to assign complaint.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Engineer Workspace Tasks & Lifecycle Actions
// -------------------------------------------------------------
app.get("/api/engineer/tasks", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot access engineer task queues." });
  }

  const queryEngineerId = req.query.engineer_id;
  if (req.user.role === "ENGINEER" && queryEngineerId && queryEngineerId !== req.user.user_id) {
    return res.status(403).json({ message: "Forbidden: You cannot access tasks assigned to other engineers." });
  }

  const engineerId = req.user.role === "ENGINEER" ? req.user.user_id : (queryEngineerId || req.user.user_id);

  try {
    const result = await pool.query(
      `SELECT 
          c.complaint_id,
          c.citizen_id,
          u.name AS citizen_name,
          u.phone AS citizen_phone,
          c.damage_type,
          c.description,
          c.image_path,
          c.severity,
          c.priority_score,
          c.priority_breakdown,
          c.status,
          c.complaint_date,
          c.created_at,
          c.updated_at,
          l.location_id,
          l.latitude,
          l.longitude,
          l.address,
          l.city,
          l.district,
          l.state,
          l.location_source,
          ai.model_name AS ai_model,
          ai.confidence AS ai_confidence,
          ai.severity AS ai_severity,
          ai.image_authenticity_status AS ai_authenticity,
          asn.assignment_id,
          asn.assigned_to,
          asn.assigned_by,
          asn.assigned_at,
          asn.expected_completion_date,
          asn.status AS assignment_status,
          asn.acknowledged_at,
          asn.remarks AS assignment_remarks,
          rep.repair_id,
          rep.repair_started_at,
          rep.repair_completed_at,
          rep.repair_status,
          rep.progress_pct,
          rep.repair_notes,
          rep.completion_image_path,
          rep.repair_description
       FROM road.complaints c
       JOIN road.assignments asn ON asn.complaint_id = c.complaint_id AND asn.status != 'SUPERSEDED'
       LEFT JOIN road.users u ON u.user_id = c.citizen_id
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       LEFT JOIN LATERAL (
         SELECT * FROM road.ai_analysis WHERE complaint_id = c.complaint_id ORDER BY analyzed_at DESC LIMIT 1
       ) ai ON true
       LEFT JOIN LATERAL (
         SELECT * FROM road.repairs WHERE complaint_id = c.complaint_id ORDER BY repair_id DESC LIMIT 1
       ) rep ON true
       WHERE asn.assigned_to = $1
       ORDER BY 
         CASE WHEN c.status = 'ASSIGNED' THEN 1 WHEN c.status = 'IN_PROGRESS' THEN 2 ELSE 3 END,
         c.priority_score DESC NULLS LAST,
         c.created_at DESC`,
      [engineerId]
    );

    const tasks = result.rows.map((row) => {
      if (!row.priority_breakdown) {
        const confNum = row.ai_confidence ? (Number(row.ai_confidence) > 1 ? Number(row.ai_confidence) / 100 : Number(row.ai_confidence)) : 0.92;
        const calculated = PriorityEngine.calculatePriority({
          damageType: row.damage_type,
          severity: row.severity || row.ai_severity,
          confidence: confNum,
          detectionCount: 1,
          surfaceDamageAreaPct: 0,
          roadType: "ARTERIAL",
          trafficExposure: "HIGH",
          sensitiveZones: ["SCHOOL", "TRANSIT"],
          corroboratingCount: 1
        });
        row.priority_breakdown = calculated.breakdown;
        if (!row.priority_score) row.priority_score = calculated.score;
      }
      return row;
    });

    res.json({ count: tasks.length, tasks });
  } catch (err) {
    console.error("Fetch engineer tasks error:", err);
    res.status(500).json({ message: "Failed to fetch engineer tasks.", error: err.message });
  }
});

app.post("/api/engineer/tasks/:id/acknowledge", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot acknowledge engineer tasks." });
  }

  const { id } = req.params;
  const engineerId = req.user.role === "ENGINEER" ? req.user.user_id : (req.body.engineer_id || req.user.user_id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify task assignment
    const asnCheck = await client.query(
      `SELECT asn.*, u.name AS engineer_name
       FROM road.assignments asn
       JOIN road.users u ON u.user_id = asn.assigned_to
       WHERE asn.complaint_id = $1 AND asn.assigned_to = $2 AND asn.status != 'SUPERSEDED'
       LIMIT 1`,
      [id, engineerId]
    );

    if (asnCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You are not authorized to acknowledge this complaint or it is not assigned to you." });
    }

    const asnRow = asnCheck.rows[0];

    const uAsn = await client.query(
      `UPDATE road.assignments
       SET acknowledged_at = NOW(), status = 'ACKNOWLEDGED'
       WHERE assignment_id = $1
       RETURNING *`,
      [asnRow.assignment_id]
    );

    await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'ASSIGNED', $2, $3, NOW())`,
      [id, engineerId, `Task acknowledged and accepted by Engineer ${asnRow.engineer_name}. Preparing deployment.`]
    );

    // Notify authority
    await createNotification(client, {
      recipient_id: "AUTHUSER-0001",
      complaint_id: id,
      title: "Task Acknowledged by Engineer",
      message: `Engineer ${asnRow.engineer_name} has acknowledged assignment for complaint ${id}.`,
      event_type: "TASK_ACKNOWLEDGED",
      metadata: { engineer_id: engineerId }
    });

    await client.query("COMMIT");

    res.json({ success: true, message: "Task acknowledged successfully.", assignment: uAsn.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to acknowledge task.", error: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/engineer/tasks/:id/start-repair", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot start repair operations." });
  }

  const { id } = req.params;
  const { description } = req.body;
  const engineerId = req.user.role === "ENGINEER" ? req.user.user_id : (req.body.engineer_id || req.user.user_id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify assignment
    const asnCheck = await client.query(
      `SELECT asn.*, u.name AS engineer_name
       FROM road.assignments asn
       JOIN road.users u ON u.user_id = asn.assigned_to
       WHERE asn.complaint_id = $1 AND asn.assigned_to = $2 AND asn.status != 'SUPERSEDED'
       LIMIT 1`,
      [id, engineerId]
    );

    if (asnCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You are not authorized to start repair on this complaint." });
    }

    const engineerName = asnCheck.rows[0].engineer_name;

    // Upsert repair record
    const repCheck = await client.query(`SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`, [id]);
    let repairRow;

    if (repCheck.rowCount > 0) {
      const uRep = await client.query(
        `UPDATE road.repairs
         SET repair_started_at = COALESCE(repair_started_at, NOW()),
             repair_status = 'IN_PROGRESS',
             progress_pct = GREATEST(progress_pct, 10),
             repair_description = COALESCE($1, repair_description)
         WHERE repair_id = $2
         RETURNING *`,
        [description || "Field repair crew mobilized on site.", repCheck.rows[0].repair_id]
      );
      repairRow = uRep.rows[0];
    } else {
      const iRep = await client.query(
        `INSERT INTO road.repairs (complaint_id, engineer_id, repair_started_at, repair_status, progress_pct, repair_description)
         VALUES ($1, $2, NOW(), 'IN_PROGRESS', 10, $3)
         RETURNING *`,
        [id, engineerId, description || "Field repair crew mobilized on site."]
      );
      repairRow = iRep.rows[0];
    }

    // Update complaint status
    const uC = await client.query(
      `UPDATE road.complaints SET status = 'IN_PROGRESS', updated_at = NOW() WHERE complaint_id = $1 RETURNING *`,
      [id]
    );

    // Record status history
    await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'IN_PROGRESS', $2, $3, NOW())`,
      [id, engineerId, description || `Repair operations commenced on site by Engineer ${engineerName}.`]
    );

    // Notifications
    const locMeta = await client.query(`SELECT address, city FROM road.complaint_locations WHERE complaint_id = $1`, [id]);
    const locStr = locMeta.rows[0]?.address || locMeta.rows[0]?.city || "the reported road";
    const citizenId = uC.rows[0].citizen_id;

    if (citizenId) {
      await createNotification(client, {
        recipient_id: citizenId,
        complaint_id: id,
        title: "Repair Work Started",
        message: `Repair work has started at ${locStr} for your complaint ${id}.`,
        event_type: "REPAIR_STARTED",
        metadata: { engineer_name: engineerName }
      });
    }

    await createNotification(client, {
      recipient_id: "AUTHUSER-0001",
      complaint_id: id,
      title: "Repair Work Started by Engineer",
      message: `Engineer ${engineerName} has commenced repair work for complaint ${id} at ${locStr}.`,
      event_type: "REPAIR_STARTED",
      metadata: { engineer_id: engineerId }
    });

    await client.query("COMMIT");

    res.json({ success: true, message: "Repair work marked in progress.", complaint: uC.rows[0], repair: repairRow });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to start repair.", error: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/engineer/tasks/:id/update-progress", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot update repair progress." });
  }

  const { id } = req.params;
  const { progress_pct, notes } = req.body;
  const engineerId = req.user.role === "ENGINEER" ? req.user.user_id : (req.body.engineer_id || req.user.user_id);
  const progressNum = Math.min(100, Math.max(0, parseInt(progress_pct, 10) || 50));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify assignment
    const asnCheck = await client.query(
      `SELECT asn.*, u.name AS engineer_name
       FROM road.assignments asn
       JOIN road.users u ON u.user_id = asn.assigned_to
       WHERE asn.complaint_id = $1 AND asn.assigned_to = $2 AND asn.status != 'SUPERSEDED'
       LIMIT 1`,
      [id, engineerId]
    );

    if (asnCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You are not authorized to update progress on this complaint." });
    }

    const engineerName = asnCheck.rows[0].engineer_name;

    // Update repair record
    const repCheck = await client.query(`SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`, [id]);
    let repairRow;

    if (repCheck.rowCount > 0) {
      const uRep = await client.query(
        `UPDATE road.repairs
         SET progress_pct = $1,
             repair_notes = COALESCE($2, repair_notes)
         WHERE repair_id = $3
         RETURNING *`,
        [progressNum, notes || `Progress updated to ${progressNum}% by field engineer.`, repCheck.rows[0].repair_id]
      );
      repairRow = uRep.rows[0];
    } else {
      const iRep = await client.query(
        `INSERT INTO road.repairs (complaint_id, engineer_id, repair_started_at, repair_status, progress_pct, repair_notes)
         VALUES ($1, $2, NOW(), 'IN_PROGRESS', $3, $4)
         RETURNING *`,
        [id, engineerId, progressNum, notes || `Progress updated to ${progressNum}% by field engineer.`]
      );
      repairRow = iRep.rows[0];
    }

    // Record status history update
    await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'IN_PROGRESS', $2, $3, NOW())`,
      [id, engineerId, `Repair progress updated to ${progressNum}% by Engineer ${engineerName}. Note: ${notes || 'Work advancing on site.'}`]
    );

    // If progress reaches 90%, dispatch specific 90% notifications
    const cMeta = await client.query(`SELECT citizen_id FROM road.complaints WHERE complaint_id = $1`, [id]);
    const citizenId = cMeta.rows[0]?.citizen_id;

    if (progressNum === 90) {
      if (citizenId) {
        await createNotification(client, {
          recipient_id: citizenId,
          complaint_id: id,
          title: "Repair Progress: 90% Completed",
          message: `Repair progress is reported as 90% for complaint ${id}.`,
          event_type: "REPAIR_PROGRESS_90",
          metadata: { progress_pct: 90, notes }
        });
      }

      await createNotification(client, {
        recipient_id: "AUTHUSER-0001",
        complaint_id: id,
        title: "Engineer Reported 90% Progress",
        message: `Engineer ${engineerName} has updated repair progress to 90% for complaint ${id}.`,
        event_type: "REPAIR_PROGRESS_90",
        metadata: { progress_pct: 90, engineer_id: engineerId }
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Progress updated to ${progressNum}%.`,
      repair: repairRow,
      progress_pct: progressNum
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to update repair progress.", error: err.message });
  } finally {
    client.release();
  }
});

app.post("/api/engineer/tasks/:id/submit-completion", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot submit repair completion evidence." });
  }

  const { id } = req.params;
  const { completion_image_path, notes, materials_used, monitoring_days } = req.body;
  const engineerId = req.user.role === "ENGINEER" ? req.user.user_id : (req.body.engineer_id || req.user.user_id);
  const days = Number(monitoring_days) || 60;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify assignment
    const asnCheck = await client.query(
      `SELECT asn.*, u.name AS engineer_name
       FROM road.assignments asn
       JOIN road.users u ON u.user_id = asn.assigned_to
       WHERE asn.complaint_id = $1 AND asn.assigned_to = $2 AND asn.status != 'SUPERSEDED'
       LIMIT 1`,
      [id, engineerId]
    );

    if (asnCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You are not authorized to submit completion for this complaint." });
    }

    if (!completion_image_path || !String(completion_image_path).trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Repair-completion photo evidence is required." });
    }

    const engineerName = asnCheck.rows[0].engineer_name;

    // 1. Update repairs table
    const repCheck = await client.query(`SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`, [id]);
    let repairId;
    let repairRow;

    const fullDesc = `Repaired road surface: ${notes || 'Bitumen asphalt mix compacted & leveled.'}${materials_used ? ` (Materials: ${materials_used})` : ''}`;

    if (repCheck.rowCount > 0) {
      repairId = repCheck.rows[0].repair_id;
      const uRep = await client.query(
        `UPDATE road.repairs
         SET repair_completed_at = NOW(),
             repair_status = 'COMPLETED',
             progress_pct = 100,
             completion_image_path = COALESCE($1, completion_image_path),
             repair_description = $2,
             repair_notes = COALESCE($3, repair_notes)
         WHERE repair_id = $4
         RETURNING *`,
        [completion_image_path || null, fullDesc, notes || "Physical road repair completed on site.", repairId]
      );
      repairRow = uRep.rows[0];
    } else {
      const iRep = await client.query(
        `INSERT INTO road.repairs (
           complaint_id, engineer_id, repair_started_at, repair_completed_at, repair_status, progress_pct,
           completion_image_path, repair_description, repair_notes
         )
         VALUES ($1, $2, NOW() - INTERVAL '1 day', NOW(), 'COMPLETED', 100, $3, $4, $5)
         RETURNING *`,
        [id, engineerId, completion_image_path || null, fullDesc, notes || "Physical road repair completed on site."]
      );
      repairId = iRep.rows[0].repair_id;
      repairRow = iRep.rows[0];
    }

    // 2. Initialize or update post-repair monitoring (60 days)
    const monCheck = await client.query(`SELECT monitoring_id FROM road.repair_monitoring WHERE repair_id = $1 LIMIT 1`, [repairId]);
    if (monCheck.rowCount > 0) {
      await client.query(
        `UPDATE road.repair_monitoring
         SET start_date = CURRENT_DATE,
             end_date = CURRENT_DATE + ($1 || ' days')::interval,
             monitoring_status = 'IN_PROGRESS',
             authority_confirmation = false
         WHERE monitoring_id = $2`,
        [days, monCheck.rows[0].monitoring_id]
      );
    } else {
      await client.query(
        `INSERT INTO road.repair_monitoring (repair_id, start_date, end_date, monitoring_status, observations_count, authority_confirmation)
         VALUES ($1, CURRENT_DATE, CURRENT_DATE + ($2 || ' days')::interval, 'IN_PROGRESS', 0, false)`,
        [repairId, days]
      );
    }

    // 3. Update complaint status to REPAIR_COMPLETED (Resolution: 90%)
    const uC = await client.query(
      `UPDATE road.complaints SET status = 'REPAIR_COMPLETED', updated_at = NOW() WHERE complaint_id = $1 RETURNING *`,
      [id]
    );

    // 4. Record status history
    await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'REPAIR_COMPLETED', $2, $3, NOW())`,
      [id, engineerId, `Repair completed by Engineer ${engineerName}. Evidence submitted for authority verification. Entered post-repair monitoring (Resolution: 90%).`]
    );

    // 5. Notifications
    // Authority Notification (required per specification)
    await createNotification(client, {
      recipient_id: "AUTHUSER-0001",
      complaint_id: id,
      title: "Repair-Completion Evidence Submitted",
      message: `Engineer ${engineerName} has submitted repair-completion evidence for complaint ${id}. Please inspect the evidence and verify the resolution.`,
      event_type: "REPAIR_COMPLETED",
      metadata: { engineer_id: engineerId, completion_image_path }
    });

    // Citizen Notification
    const citizenId = uC.rows[0].citizen_id;
    if (citizenId) {
      await createNotification(client, {
        recipient_id: citizenId,
        complaint_id: id,
        title: "Repair Completed — Under Monitoring",
        message: `Physical road repair completed on site for complaint ${id}. Entered mandatory ${days}-day post-repair monitoring period (Resolution: 90%).`,
        event_type: "REPAIR_COMPLETED",
        metadata: { engineer_name: engineerName, resolution_pct: 90 }
      });
    }

    await client.query("COMMIT");

    // Fetch original location details to return with complaint
    const locRes = await client.query(
      `SELECT location_id, latitude, longitude, address, city, district, state
       FROM road.complaint_locations
       WHERE complaint_id = $1 LIMIT 1`,
      [id]
    );

    res.json({
      success: true,
      message: "Repair-completion evidence submitted successfully. Entered post-repair monitoring.",
      complaint: {
        ...uC.rows[0],
        location: locRes.rows[0] || null
      },
      repair: repairRow
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to submit repair completion evidence.", error: err.message });
  } finally {
    client.release();
  }
});

// Fast-forward assignment date by 15 days for live testing of repair start
app.post("/api/complaints/:id/fast-forward-assignment", authenticateUser, async (req, res) => {
  if (req.user.role !== "AUTHORITY") {
    return res.status(403).json({ message: "Forbidden: Only authorized municipal officials can fast-forward assignments." });
  }

  const { id } = req.params;
  const days = Number(req.body.days) || 15;

  try {
    const result = await pool.query(
      `UPDATE road.assignments
       SET assigned_at = assigned_at - ($1 || ' days')::interval
       WHERE complaint_id = $2
       RETURNING *`,
      [days, id]
    );

    res.json({ success: true, assignment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Failed to fast-forward assignment.", error: error.message });
  }
});

// -------------------------------------------------------------
// Authority Workflow: Mark In Progress (Start Repair)
// -------------------------------------------------------------
app.post("/api/complaints/:id/in-progress", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot mark repair in progress." });
  }

  const { id } = req.params;
  const { engineer_id, changed_by, description } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let engId = req.user.role === "ENGINEER" ? req.user.user_id : (engineer_id || changed_by || req.user.user_id).trim();
    const engCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [engId]);
    if (engCheck.rowCount === 0) engId = req.user.user_id;

    // Upsert repair record
    const existingRepair = await client.query(
      `SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`,
      [id]
    );

    let repairRow;
    if (existingRepair.rowCount > 0) {
      const uRep = await client.query(
        `UPDATE road.repairs
         SET repair_started_at = COALESCE(repair_started_at, NOW()),
             repair_status = 'IN_PROGRESS',
             repair_description = COALESCE($1, repair_description)
         WHERE repair_id = $2
         RETURNING *`,
        [description || "Zonal asphalt repair squad deployed to coordinates.", existingRepair.rows[0].repair_id]
      );
      repairRow = uRep.rows[0];
    } else {
      const iRep = await client.query(
        `INSERT INTO road.repairs (complaint_id, engineer_id, repair_started_at, repair_status, repair_description)
         VALUES ($1, $2, NOW(), 'IN_PROGRESS', $3)
         RETURNING *`,
        [id, engId, description || "Zonal asphalt repair squad deployed to coordinates."]
      );
      repairRow = iRep.rows[0];
    }

    // Update complaint status
    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = 'IN_PROGRESS', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'IN_PROGRESS', $2, $3, NOW())
       RETURNING *`,
      [id, engId, description || "Repair operations commenced on site."]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: updateRes.rows[0],
      repair: repairRow,
      history: histRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("In progress error:", error);
    res.status(500).json({ message: "Failed to mark repair in progress.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Authority Workflow: Mark Repair Completed -> Enters Monitoring (90%)
// -------------------------------------------------------------
app.post("/api/complaints/:id/repair-completed", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot mark repairs as completed." });
  }

  const { id } = req.params;
  const { engineer_id, changed_by, notes, monitoring_days } = req.body;
  const days = Number(monitoring_days) || 60;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let engId = req.user.role === "ENGINEER" ? req.user.user_id : (engineer_id || changed_by || req.user.user_id).trim();
    const engCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [engId]);
    if (engCheck.rowCount === 0) engId = req.user.user_id;

    // 1. Update or create repair record
    const existingRepair = await client.query(
      `SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`,
      [id]
    );

    let repairId;
    let repairRow;
    if (existingRepair.rowCount > 0) {
      repairId = existingRepair.rows[0].repair_id;
      const uRep = await client.query(
        `UPDATE road.repairs
         SET repair_completed_at = NOW(),
             repair_status = 'COMPLETED',
             repair_description = COALESCE($1, repair_description)
         WHERE repair_id = $2
         RETURNING *`,
        [notes || "Physical road repair completed on site. Marked for post-repair monitoring.", repairId]
      );
      repairRow = uRep.rows[0];
    } else {
      const iRep = await client.query(
        `INSERT INTO road.repairs (complaint_id, engineer_id, repair_started_at, repair_completed_at, repair_status, repair_description)
         VALUES ($1, $2, NOW() - INTERVAL '1 day', NOW(), 'COMPLETED', $3)
         RETURNING *`,
        [id, engId, notes || "Physical road repair completed on site. Marked for post-repair monitoring."]
      );
      repairId = iRep.rows[0].repair_id;
      repairRow = iRep.rows[0];
    }

    // 2. Insert or update repair_monitoring
    const existingMon = await client.query(
      `SELECT monitoring_id FROM road.repair_monitoring WHERE repair_id = $1 LIMIT 1`,
      [repairId]
    );

    let monRow;
    if (existingMon.rowCount > 0) {
      const uMon = await client.query(
        `UPDATE road.repair_monitoring
         SET start_date = CURRENT_DATE,
             end_date = CURRENT_DATE + ($1 || ' days')::interval,
             monitoring_status = 'IN_PROGRESS',
             authority_confirmation = false
         WHERE monitoring_id = $2
         RETURNING *`,
        [days, existingMon.rows[0].monitoring_id]
      );
      monRow = uMon.rows[0];
    } else {
      const iMon = await client.query(
        `INSERT INTO road.repair_monitoring (
           repair_id, start_date, end_date, monitoring_status, observations_count, authority_confirmation
         )
         VALUES ($1, CURRENT_DATE, CURRENT_DATE + ($2 || ' days')::interval, 'IN_PROGRESS', 0, false)
         RETURNING *`,
        [repairId, days]
      );
      monRow = iMon.rows[0];
    }

    // 3. Update complaint status
    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = 'REPAIR_COMPLETED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    // 4. Record history
    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'REPAIR_COMPLETED', $2, $3, NOW())
       RETURNING *`,
      [id, engId, `Physical road repair completed. Entered mandatory ${days}-day post-repair monitoring period (Resolution: 90%).`]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: updateRes.rows[0],
      repair: repairRow,
      monitoring: monRow,
      history: histRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Repair completed error:", error);
    res.status(500).json({ message: "Failed to mark repair completed.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Sensor Observations: Log / Simulate Vehicle Telemetry
// -------------------------------------------------------------
app.post("/api/complaints/:id/sensor", authenticateUser, async (req, res) => {
  if (req.user.role === "CITIZEN") {
    return res.status(403).json({ message: "Forbidden: Citizen accounts cannot log repair sensor telemetry." });
  }

  const { id } = req.params;
  const {
    is_abnormal = false,
    speed,
    acceleration_magnitude,
    peak_acceleration,
    jerk,
    gyroscope_change,
    confidence
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Retrieve complaint location and monitoring row
    const cRes = await client.query(
      `SELECT c.complaint_id, l.latitude, l.longitude
       FROM road.complaints c
       LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
       WHERE c.complaint_id = $1`,
      [id]
    );

    if (cRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    const cLoc = cRes.rows[0];

    // Find repair & monitoring
    let repRes = await client.query(
      `SELECT repair_id FROM road.repairs WHERE complaint_id = $1 LIMIT 1`,
      [id]
    );
    let repairId;
    if (repRes.rowCount === 0) {
      const iRep = await client.query(
        `INSERT INTO road.repairs (complaint_id, engineer_id, repair_started_at, repair_completed_at, repair_status)
         VALUES ($1, 'AUTHUSER-0001', NOW() - INTERVAL '1 day', NOW(), 'COMPLETED')
         RETURNING repair_id`,
        [id]
      );
      repairId = iRep.rows[0].repair_id;
    } else {
      repairId = repRes.rows[0].repair_id;
    }

    let monRes = await client.query(
      `SELECT monitoring_id FROM road.repair_monitoring WHERE repair_id = $1 LIMIT 1`,
      [repairId]
    );
    let monitoringId;
    if (monRes.rowCount === 0) {
      const iMon = await client.query(
        `INSERT INTO road.repair_monitoring (repair_id, start_date, end_date, monitoring_status, observations_count)
         VALUES ($1, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 'IN_PROGRESS', 0)
         RETURNING monitoring_id`,
        [repairId]
      );
      monitoringId = iMon.rows[0].monitoring_id;
    } else {
      monitoringId = monRes.rows[0].monitoring_id;
    }

    // Telemetry values
    const obsSpeed = speed != null ? Number(speed) : 32.50;
    const obsAccel = acceleration_magnitude != null
      ? Number(acceleration_magnitude)
      : (is_abnormal ? 18.70 : 9.81);
    const obsPeak = peak_acceleration != null
      ? Number(peak_acceleration)
      : (is_abnormal ? 22.40 : 10.10);
    const obsJerk = jerk != null ? Number(jerk) : (is_abnormal ? 4.80 : 0.65);
    const obsGyro = gyroscope_change != null ? Number(gyroscope_change) : (is_abnormal ? 14.20 : 0.84);
    const obsConf = confidence != null ? Number(confidence) : 92.50;
    const lat = cLoc.latitude != null ? Number(cLoc.latitude) : 16.7050;
    const lng = cLoc.longitude != null ? Number(cLoc.longitude) : 74.2433;

    // 1. Insert sensor observation
    const obsResult = await client.query(
      `INSERT INTO road.sensor_observations (
        monitoring_id,
        latitude,
        longitude,
        speed,
        acceleration_magnitude,
        peak_acceleration,
        jerk,
        gyroscope_change,
        confidence,
        observation_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [monitoringId, lat, lng, obsSpeed, obsAccel, obsPeak, obsJerk, obsGyro, obsConf]
    );

    // 2. Update monitoring summary
    const newStatus = is_abnormal ? "FAILED" : "IN_PROGRESS";
    const newResult = is_abnormal ? "ANOMALY_DETECTED" : "STABLE";
    const newStability = is_abnormal ? 45.0 : 96.5;

    const uMon = await client.query(
      `UPDATE road.repair_monitoring
       SET observations_count = COALESCE(observations_count, 0) + 1,
           stability_score = $1,
           monitoring_status = $2,
           result = $3
       WHERE monitoring_id = $4
       RETURNING *`,
      [newStability, newStatus, newResult, monitoringId]
    );

    // 3. If abnormal, record status history warning
    if (is_abnormal) {
      await client.query(
        `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
         VALUES ($1, 'REINSPECTION_REQUIRED', 'AUTHUSER-0001', 'Sensor Telemetry: High amplitude vibration shock (|A| > 18 m/s²) recorded. Deterioration alert active.', NOW())`
      );
      await client.query(
        `UPDATE road.complaints SET status = 'REINSPECTION_REQUIRED', updated_at = NOW() WHERE complaint_id = $1`,
        [id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      observation: obsResult.rows[0],
      monitoring: uMon.rows[0],
      is_abnormal: !!is_abnormal
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Sensor observation error:", error);
    res.status(500).json({ message: "Failed to record sensor observation.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Simulate Monitoring Days Fast-Forward
// -------------------------------------------------------------
app.post("/api/complaints/:id/simulate-monitoring", async (req, res) => {
  const { id } = req.params;
  const daysToAdd = Number(req.body.days) || 30;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const mRes = await client.query(
      `SELECT rm.*, r.complaint_id
       FROM road.repair_monitoring rm
       JOIN road.repairs r ON r.repair_id = rm.repair_id
       WHERE r.complaint_id = $1
       ORDER BY rm.monitoring_id DESC LIMIT 1`,
      [id]
    );

    if (mRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No active monitoring found for this complaint." });
    }

    const mRow = mRes.rows[0];
    const newCount = (mRow.observations_count || 0) + daysToAdd;

    // Transition to CONFIRMATION_REQUIRED if monitoring period satisfied
    let newStatus = mRow.monitoring_status;
    let complaintStatus = null;

    if (newCount >= 60 || daysToAdd >= 60) {
      newStatus = "CONFIRMATION_REQUIRED";
      complaintStatus = "CONFIRMATION_REQUIRED";
    }

    const uMon = await client.query(
      `UPDATE road.repair_monitoring
       SET observations_count = $1,
           monitoring_status = $2
       WHERE monitoring_id = $3
       RETURNING *`,
      [newCount, newStatus, mRow.monitoring_id]
    );

    let updatedComplaint = null;
    if (complaintStatus) {
      const uC = await client.query(
        `UPDATE road.complaints
         SET status = $1, updated_at = NOW()
         WHERE complaint_id = $2
         RETURNING *`,
        [complaintStatus, id]
      );
      updatedComplaint = uC.rows[0];

      await client.query(
        `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
         VALUES ($1, 'CONFIRMATION_REQUIRED', 'AUTHUSER-0001', 'Monitoring observation period fulfilled. Awaiting authority final confirmation.', NOW())`,
        [id]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      monitoring: uMon.rows[0],
      complaint: updatedComplaint,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to simulate monitoring.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Authority Final Confirmation (Option 1: 100% Fully Resolved)
// -------------------------------------------------------------
app.post("/api/complaints/:id/confirm-final", authenticateUser, async (req, res) => {
  if (req.user.role !== "AUTHORITY") {
    return res.status(403).json({ message: "Forbidden: Only authorized municipal officials can confirm final resolution." });
  }

  const { id } = req.params;
  const { notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorId = req.user.user_id;

    // 1. Update repair_monitoring
    await client.query(
      `UPDATE road.repair_monitoring rm
       SET monitoring_status = 'PASSED',
           authority_confirmation = true,
           result = 'CONFIRMED'
       FROM road.repairs r
       WHERE r.repair_id = rm.repair_id AND r.complaint_id = $1`,
      [id]
    );

    // 2. Update complaint
    const uC = await client.query(
      `UPDATE road.complaints
       SET status = 'RESOLVED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (uC.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    // 3. Record history
    const hist = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'RESOLVED', $2, $3, NOW())
       RETURNING *`,
      [id, actorId, notes || "Repair successfully verified after post-repair observation period. 100% officially resolved."]
    );

    // Connected Notifications for Final Resolution (100% Resolved)
    if (uC.rows[0].citizen_id) {
      await createNotification(client, {
        recipient_id: uC.rows[0].citizen_id,
        complaint_id: id,
        title: "Complaint Resolved Successfully",
        message: `Your complaint ${id} has been marked as resolved.`,
        event_type: "COMPLAINT_RESOLVED",
        metadata: { resolved_by: actorId }
      });
    }

    const asnCheck = await client.query(
      `SELECT assigned_to FROM road.assignments WHERE complaint_id = $1 AND status != 'SUPERSEDED' ORDER BY assigned_at DESC LIMIT 1`,
      [id]
    );
    if (asnCheck.rowCount > 0 && asnCheck.rows[0].assigned_to) {
      await createNotification(client, {
        recipient_id: asnCheck.rows[0].assigned_to,
        complaint_id: id,
        title: "Repair Resolution Verified",
        message: `Authority verified and confirmed 100% resolution for complaint ${id}.`,
        event_type: "COMPLAINT_RESOLVED",
        metadata: { resolved_by: actorId }
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: uC.rows[0],
      history: hist.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Confirm final error:", error);
    res.status(500).json({ message: "Failed to confirm final resolution.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Authority Final Confirmation (Option 2: Reinspection Required)
// -------------------------------------------------------------
app.post("/api/complaints/:id/reinspect", authenticateUser, async (req, res) => {
  if (req.user.role !== "AUTHORITY") {
    return res.status(403).json({ message: "Forbidden: Only authorized municipal officials can order reinspection." });
  }

  const { id } = req.params;
  const { reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actorId = req.user.user_id;

    // 1. Update repair_monitoring
    await client.query(
      `UPDATE road.repair_monitoring rm
       SET monitoring_status = 'FAILED',
           result = 'REINSPECTION_REQUIRED'
       FROM road.repairs r
       WHERE r.repair_id = rm.repair_id AND r.complaint_id = $1`,
      [id]
    );

    // 2. Update complaint
    const uC = await client.query(
      `UPDATE road.complaints
       SET status = 'REINSPECTION_REQUIRED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (uC.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    // 3. Record history
    const hist = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'REINSPECTION_REQUIRED', $2, $3, NOW())
       RETURNING *`,
      [id, actorId, reason || "Road damage re-appeared during post-repair monitoring. Immediate re-inspection ordered."]
    );

    // Connected Notifications for Re-inspection
    if (uC.rows[0].citizen_id) {
      await createNotification(client, {
        recipient_id: uC.rows[0].citizen_id,
        complaint_id: id,
        title: "Re-inspection Scheduled",
        message: `Complaint ${id} has been scheduled for re-inspection following monitoring telemetry review.`,
        event_type: "REINSPECTION_REQUESTED",
        metadata: { reason }
      });
    }

    const asnCheckRe = await client.query(
      `SELECT assigned_to FROM road.assignments WHERE complaint_id = $1 AND status != 'SUPERSEDED' ORDER BY assigned_at DESC LIMIT 1`,
      [id]
    );
    if (asnCheckRe.rowCount > 0 && asnCheckRe.rows[0].assigned_to) {
      await createNotification(client, {
        recipient_id: asnCheckRe.rows[0].assigned_to,
        complaint_id: id,
        title: "Reinspection Ordered",
        message: `Authority requested re-inspection for complaint ${id}: ${reason || "Deterioration detected."}`,
        event_type: "REINSPECTION_REQUESTED",
        metadata: { reason }
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: uC.rows[0],
      history: hist.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ message: "Failed to request reinspection.", error: error.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// Live Monitoring List (All active/completed monitorings)
// -------------------------------------------------------------
app.get("/api/monitoring", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rm.monitoring_id,
        rm.repair_id,
        rm.start_date,
        rm.end_date,
        rm.monitoring_status,
        rm.stability_score,
        rm.observations_count,
        rm.result AS monitoring_result,
        rm.authority_confirmation,
        r.complaint_id,
        r.repair_started_at,
        r.repair_completed_at,
        r.repair_status,
        c.damage_type,
        c.severity,
        c.priority_score,
        c.status AS complaint_status,
        l.address,
        l.city,
        l.latitude,
        l.longitude,
        u.name AS citizen_name,
        eng.name AS engineer_name
      FROM road.repair_monitoring rm
      JOIN road.repairs r ON r.repair_id = rm.repair_id
      JOIN road.complaints c ON c.complaint_id = r.complaint_id
      LEFT JOIN road.complaint_locations l ON l.complaint_id = c.complaint_id
      LEFT JOIN road.users u ON u.user_id = c.citizen_id
      LEFT JOIN road.users eng ON eng.user_id = r.engineer_id
      ORDER BY rm.monitoring_id DESC
    `);
    res.json({ count: result.rowCount, monitoring: result.rows });
  } catch (error) {
    res.status(500).json({ message: "Unable to retrieve monitoring data.", error: error.message });
  }
});

// -------------------------------------------------------------
// KPI Metrics (Aggregated Live Counts)
// -------------------------------------------------------------
app.get("/api/kpis", async (req, res) => {
  const { citizen_id } = req.query;

  try {
    const counts = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('REPORTED', 'AI_ANALYZED', 'VERIFIED', 'ASSIGNED'))::int AS pending,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
         COUNT(*) FILTER (WHERE status IN ('REPAIR_COMPLETED', 'CONFIRMATION_REQUIRED', 'UNDER_MONITORING'))::int AS monitoring,
         COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
         COUNT(*) FILTER (WHERE priority_score >= 80 OR severity = 'CRITICAL')::int AS critical
       FROM road.complaints
       WHERE ($1::varchar IS NULL OR citizen_id = $1)`,
      [citizen_id || null]
    );

    res.json(counts.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Unable to retrieve KPIs.", error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`MargDrishti backend running on port ${PORT}`);
});
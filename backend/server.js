require("dotenv").config();

const express = require("express");
const pool = require("./db");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const path = require("path");

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve frontend static files
const frontendDir = path.join(__dirname, "../Prototye_MardDrishti");
app.use(express.static(frontendDir));

// Helper to generate IDs within 30 characters
function generateComplaintId() {
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  const time = Date.now().toString().slice(-6);
  return `MD-${time}-${rand}`; // e.g. MD-123456-A1B2C3D4 (total 18 chars, well within 30)
}

// -------------------------------------------------------------
// Root & Health Checks
// -------------------------------------------------------------
app.get("/api", (req, res) => {
  res.json({ message: "MargDrishti backend is running" });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT current_database() AS database,
             current_user AS username,
             current_schema() AS schema
    `);

    res.json({
      message: "Database connection successful",
      ...result.rows[0],
    });
  } catch (error) {
    console.error("Database error:", error.message);
    res.status(500).json({ message: "Database connection failed", error: error.message });
  }
});

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { role, identifier, email, password } = req.body;
  const loginRole = (role || "CITIZEN").toUpperCase();
  const loginIdent = (identifier || email || "").trim();
  const loginPass = (password || "").trim();

  if (!loginIdent) {
    return res.status(400).json({ message: "Email or User ID is required." });
  }

  try {
    // Look up user by user_id, email, or phone matching role
    const result = await pool.query(
      `SELECT user_id, name, email, password_hash, phone, role, created_at
       FROM road.users
       WHERE role = $1 AND (
         LOWER(email) = LOWER($2) OR
         LOWER(user_id) = LOWER($2) OR
         phone = $2
       )
       LIMIT 1`,
      [loginRole, loginIdent]
    );

    let user = result.rows[0];

    // Support demo aliases if database holds CIT-0001 or AUTHUSER-0001
    if (!user) {
      if (loginRole === "CITIZEN" && (loginIdent.toLowerCase() === "citizen@margdrishti.demo" || loginIdent.toUpperCase().startsWith("CIT-"))) {
        const fallback = await pool.query(`SELECT * FROM road.users WHERE user_id = 'CIT-0001' AND role = 'CITIZEN'`);
        user = fallback.rows[0];
      } else if (loginRole === "AUTHORITY" && (loginIdent.toLowerCase() === "authority@margdrishti.demo" || loginIdent.toUpperCase().startsWith("AUT"))) {
        const fallback = await pool.query(`SELECT * FROM road.users WHERE user_id = 'AUTHUSER-0001' AND role = 'AUTHORITY'`);
        user = fallback.rows[0];
      }
    }

    if (!user) {
      return res.status(404).json({
        message: loginRole === "AUTHORITY"
          ? "Authority account not found. Please contact administration."
          : "Citizen account not found. Please sign up for a citizen account."
      });
    }

    // Verify password: allow stored password_hash or standard demo passwords
    const isValidPass =
      !loginPass ||
      user.password_hash === loginPass ||
      user.password_hash === "demo_hash_123" ||
      user.password_hash === "demo_hash_456" ||
      (loginRole === "CITIZEN" && loginPass === "Citizen@123") ||
      (loginRole === "AUTHORITY" && loginPass === "Authority@123");

    if (!isValidPass) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    // Return safe user object
    res.json({
      success: true,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        citizenId: user.role === "CITIZEN" ? user.user_id : null,
        authorityId: user.role === "AUTHORITY" ? user.user_id : null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.toLowerCase(),
        role_raw: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed.", error: error.message });
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

  if (signupRole !== "CITIZEN" && signupRole !== "AUTHORITY") {
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

    // Generate next user_id
    
    // Generate the next user ID
    const prefix = signupRole === "CITIZEN" ? "CIT-" : "AUTHUSER-";

    const maxRes = await client.query(
      `SELECT user_id
       FROM road.users
       WHERE role = $1
         AND user_id LIKE $2
       ORDER BY
         CASE
           WHEN user_id ~ $3
           THEN substring(user_id FROM $4)::BIGINT
           ELSE 0
         END DESC
       LIMIT 1`,
      [
        signupRole,
        `${prefix}%`,
        signupRole === "CITIZEN" ? "^CIT-[0-9]+$" : "^AUTHUSER-[0-9]+$",
        signupRole === "CITIZEN" ? 5 : 10
      ]
    );

    let nextNum = 1;

    if (maxRes.rowCount > 0) {
      const match = maxRes.rows[0].user_id.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    const newUserId = `${prefix}${String(nextNum).padStart(4, "0")}`;

    const insertResult = await client.query(
      `INSERT INTO road.users (user_id, name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone, role, created_at`,
      [newUserId, userName, userEmail, userPass, userPhone || null, signupRole]
    );

    await client.query("COMMIT");

    const created = insertResult.rows[0];
    res.status(201).json({
      success: true,
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
app.post("/api/complaints", async (req, res) => {
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

  // Validate required fields
  if (
    typeof citizen_id !== "string" ||
    !citizen_id.trim() ||
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
      message: "Provide a valid citizen_id, damage_type, latitude, and longitude.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find the citizen in road.users
    const targetCitizenId = citizen_id.trim();
    let userResult = await client.query(
      `SELECT user_id, name, role
       FROM road.users
       WHERE user_id = $1 AND role = 'CITIZEN'`,
      [targetCitizenId]
    );

    // If an outdated frontend ID was supplied, map to CIT-0001
    if (userResult.rowCount === 0) {
      if (targetCitizenId.startsWith("CIT-2026-") || targetCitizenId.toLowerCase() === "citizen") {
        userResult = await client.query(
          `SELECT user_id, name, role FROM road.users WHERE user_id = 'CIT-0001' AND role = 'CITIZEN'`
        );
      }
    }

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: `Citizen account '${targetCitizenId}' not found. Please log in with a valid citizen account.`,
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
        status,
        complaint_date,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10)
      RETURNING *`,
      [
        complaintId,
        verifiedCitizenId,
        resolvedAuthId,
        damage_type.trim(),
        description ?? null,
        image_path ?? null,
        String(severity ?? "HIGH").trim().toUpperCase().slice(0, 20),
        priority_score != null ? Number(priority_score) : null,
        initialStatus,
        now,
      ]
    );

    console.log("Complaint values being saved:", {
  severity,
  severityLength: String(severity ?? "").length,
  location_source,
  locationSourceLength: String(location_source ?? "").length
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
// Get Complaints (List with Joined Details)
// -------------------------------------------------------------
app.get("/api/complaints", async (req, res) => {
  const { citizen_id, status } = req.query;

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
          asn.assigned_at,
          asn.remarks AS assignment_remarks,
          rep.repair_id,
          rep.engineer_id,
          rep.repair_started_at,
          rep.repair_completed_at,
          rep.repair_status,
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
         WHERE complaint_id = c.complaint_id
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
      [citizen_id || null, status || null]
    );

    res.json({
      count: result.rowCount,
      complaints: result.rows,
    });
  } catch (error) {
    console.error("Fetch complaints error:", error.message);
    res.status(500).json({ message: "Unable to retrieve complaints.", error: error.message });
  }
});

// -------------------------------------------------------------
// Get Single Complaint (Complete Timeline & Telemetry)
// -------------------------------------------------------------
app.get("/api/complaints/:id", async (req, res) => {
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
          asn.assigned_at,
          asn.remarks AS assignment_remarks,
          rep.repair_id,
          rep.engineer_id,
          rep.repair_started_at,
          rep.repair_completed_at,
          rep.repair_status,
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
         WHERE complaint_id = c.complaint_id
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
app.patch("/api/complaints/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, changed_by, remarks } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure actor user exists or use AUTHUSER-0001
    let actorId = (changed_by || "").trim();
    const actorCheck = await client.query(
      `SELECT user_id FROM road.users WHERE user_id = $1`,
      [actorId]
    );
    if (actorCheck.rowCount === 0) {
      actorId = "AUTHUSER-0001";
    }

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
app.post("/api/complaints/:id/verify", async (req, res) => {
  const { id } = req.params;
  const { changed_by, remarks } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let actorId = (changed_by || "").trim();
    const actorCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [actorId]);
    if (actorCheck.rowCount === 0) actorId = "AUTHUSER-0001";

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
// Authority Workflow: Assign Engineer / Authority
// -------------------------------------------------------------
app.post("/api/complaints/:id/assign", async (req, res) => {
  const { id } = req.params;
  const { assigned_to, assigned_by, remarks } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolve assigned_to to a valid authority user in road.users
    let toUser = (assigned_to || "").trim();
    let toCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [toUser]);
    if (toCheck.rowCount === 0) {
      // Default to existing authority engineer
      toUser = "AUTHUSER-0001";
    }

    let byUser = (assigned_by || "").trim();
    let byCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [byUser]);
    if (byCheck.rowCount === 0) {
      byUser = "AUTHUSER-0001";
    }

    // Insert assignment
    const assignRes = await client.query(
      `INSERT INTO road.assignments (complaint_id, assigned_to, assigned_by, assigned_at, remarks)
       VALUES ($1, $2, $3, NOW(), $4)
       RETURNING *`,
      [id, toUser, byUser, remarks || "Assigned for road inspection and repair."]
    );

    // Update complaint status
    const updateRes = await client.query(
      `UPDATE road.complaints
       SET status = 'ASSIGNED', updated_at = NOW()
       WHERE complaint_id = $1
       RETURNING *`,
      [id]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Complaint not found." });
    }

    // Record history
    const histRes = await client.query(
      `INSERT INTO road.complaint_status_history (complaint_id, status, changed_by, remarks, changed_at)
       VALUES ($1, 'ASSIGNED', $2, $3, NOW())
       RETURNING *`,
      [id, byUser, remarks || `Work order assigned to ${toUser}. Minimum 15-day assignment period initiated.`]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      complaint: updateRes.rows[0],
      assignment: assignRes.rows[0],
      history: histRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Assign error:", error);
    res.status(500).json({ message: "Failed to assign complaint.", error: error.message });
  } finally {
    client.release();
  }
});

// Fast-forward assignment date by 15 days for live testing of repair start
app.post("/api/complaints/:id/fast-forward-assignment", async (req, res) => {
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
app.post("/api/complaints/:id/in-progress", async (req, res) => {
  const { id } = req.params;
  const { engineer_id, changed_by, description } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let engId = (engineer_id || changed_by || "AUTHUSER-0001").trim();
    const engCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [engId]);
    if (engCheck.rowCount === 0) engId = "AUTHUSER-0001";

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
app.post("/api/complaints/:id/repair-completed", async (req, res) => {
  const { id } = req.params;
  const { engineer_id, changed_by, notes, monitoring_days } = req.body;
  const days = Number(monitoring_days) || 60;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let engId = (engineer_id || changed_by || "AUTHUSER-0001").trim();
    const engCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [engId]);
    if (engCheck.rowCount === 0) engId = "AUTHUSER-0001";

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
app.post("/api/complaints/:id/sensor", async (req, res) => {
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
app.post("/api/complaints/:id/confirm-final", async (req, res) => {
  const { id } = req.params;
  const { changed_by, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let actorId = (changed_by || "AUTHUSER-0001").trim();
    const actorCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [actorId]);
    if (actorCheck.rowCount === 0) actorId = "AUTHUSER-0001";

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
app.post("/api/complaints/:id/reinspect", async (req, res) => {
  const { id } = req.params;
  const { changed_by, reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let actorId = (changed_by || "AUTHUSER-0001").trim();
    const actorCheck = await client.query(`SELECT user_id FROM road.users WHERE user_id = $1`, [actorId]);
    if (actorCheck.rowCount === 0) actorId = "AUTHUSER-0001";

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
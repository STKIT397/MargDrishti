const pool = require("./db");

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("[Migration] Starting database migration for MargDrishti...");
    await client.query("BEGIN");

    // 0. Ensure road schema exists
    console.log("[Migration] 0. Ensuring road schema exists...");
    await client.query("CREATE SCHEMA IF NOT EXISTS road");

    // 1. Create base tables if they do not exist
    console.log("[Migration] 1. Creating base tables if not existing...");

    // 1a. Authorities
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.authorities (
        authority_id VARCHAR(30) PRIMARY KEY,
        authority_name VARCHAR(150) NOT NULL,
        authority_type VARCHAR(50),
        contact_email VARCHAR(100),
        contact_phone VARCHAR(20),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1b. Authority Areas
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.authority_areas (
        area_id SERIAL PRIMARY KEY,
        authority_id VARCHAR(30) REFERENCES road.authorities(authority_id) ON DELETE CASCADE,
        area_name VARCHAR(100) NOT NULL,
        city VARCHAR(100),
        district VARCHAR(100),
        state VARCHAR(100)
      )
    `);

    // 1c. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.users (
        user_id VARCHAR(30) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure role check constraint includes ENGINEER
    await client.query("ALTER TABLE road.users DROP CONSTRAINT IF EXISTS chk_user_role");
    await client.query("ALTER TABLE road.users ADD CONSTRAINT chk_user_role CHECK (role IN ('CITIZEN', 'AUTHORITY', 'ENGINEER'))");

    // 1d. Complaints
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.complaints (
        complaint_id VARCHAR(30) PRIMARY KEY,
        citizen_id VARCHAR(30) REFERENCES road.users(user_id),
        authority_id VARCHAR(30) REFERENCES road.authorities(authority_id),
        damage_type VARCHAR(50) NOT NULL,
        description TEXT,
        image_path TEXT,
        severity VARCHAR(20) NOT NULL,
        priority_score NUMERIC(5,2),
        priority_breakdown JSONB,
        status VARCHAR(30) DEFAULT 'REPORTED',
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure priority_breakdown column exists if table predated it
    await client.query("ALTER TABLE road.complaints ADD COLUMN IF NOT EXISTS priority_breakdown JSONB");

    // Ensure road.complaint_id_seq exists
    console.log("[Migration] Ensuring complaint_id_seq exists...");
    await client.query("CREATE SEQUENCE IF NOT EXISTS road.complaint_id_seq START WITH 1");
    // Ensure complaint_date exists on road.complaints
    await client.query("ALTER TABLE road.complaints ADD COLUMN IF NOT EXISTS complaint_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP");
    // Ensure location columns exist on road.complaint_locations
    await client.query("ALTER TABLE road.complaint_locations ADD COLUMN IF NOT EXISTS city VARCHAR(100)");
    await client.query("ALTER TABLE road.complaint_locations ADD COLUMN IF NOT EXISTS district VARCHAR(100)");
    await client.query("ALTER TABLE road.complaint_locations ADD COLUMN IF NOT EXISTS state VARCHAR(100)");
    await client.query("ALTER TABLE road.complaint_locations ADD COLUMN IF NOT EXISTS location_source VARCHAR(20) DEFAULT 'GPS'");

    // 1e. Complaint Locations
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.complaint_locations (
        location_id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(30) REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        latitude NUMERIC(10,6) NOT NULL,
        longitude NUMERIC(10,6) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        district VARCHAR(100),
        state VARCHAR(100),
        location_source VARCHAR(20) DEFAULT 'GPS'
      )
    `);

    // 1f. Complaint Status History
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.complaint_status_history (
        history_id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(30) REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL,
        changed_by VARCHAR(30) REFERENCES road.users(user_id),
        changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT
      )
    `);

    // 1g. AI Analysis
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.ai_analysis (
        analysis_id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(30) NOT NULL REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        model_name VARCHAR(100),
        damage_type VARCHAR(50),
        confidence NUMERIC(5,2),
        severity VARCHAR(20),
        image_authenticity_status VARCHAR(40),
        analyzed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1h. Assignments
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.assignments (
        assignment_id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(30) NOT NULL REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        assigned_to VARCHAR(30) NOT NULL REFERENCES road.users(user_id),
        assigned_by VARCHAR(30) REFERENCES road.users(user_id),
        assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        expected_completion_date DATE,
        status VARCHAR(20) DEFAULT 'ASSIGNED',
        acknowledged_at TIMESTAMP WITHOUT TIME ZONE
      )
    `);

    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS expected_completion_date DATE");
    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ASSIGNED'");
    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITHOUT TIME ZONE");

    // 1i. Repairs
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.repairs (
        repair_id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(30) NOT NULL REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        resolved_by VARCHAR(30) REFERENCES road.users(user_id),
        resolved_at TIMESTAMP WITHOUT TIME ZONE,
        repair_notes TEXT,
        progress_pct INTEGER DEFAULT 0,
        completion_image_path TEXT
      )
    `);

    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_notes TEXT");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS completion_image_path TEXT");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS engineer_id VARCHAR(30) REFERENCES road.users(user_id)");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_started_at TIMESTAMP WITHOUT TIME ZONE");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_completed_at TIMESTAMP WITHOUT TIME ZONE");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_status VARCHAR(30) DEFAULT 'IN_PROGRESS'");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_description TEXT");

    // 1j. Repair Monitoring
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.repair_monitoring (
        monitoring_id SERIAL PRIMARY KEY,
        repair_id INTEGER NOT NULL REFERENCES road.repairs(repair_id) ON DELETE CASCADE,
        start_date DATE,
        end_date DATE,
        monitoring_days INTEGER DEFAULT 60,
        status VARCHAR(20) DEFAULT 'MONITORING',
        observations TEXT,
        current_resolution_level INTEGER DEFAULT 90,
        recurrence_detected BOOLEAN DEFAULT FALSE,
        recurrence_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure repair_monitoring columns exist
    await client.query("ALTER TABLE road.repair_monitoring ADD COLUMN IF NOT EXISTS monitoring_status VARCHAR(50) DEFAULT 'IN_PROGRESS'");
    await client.query("ALTER TABLE road.repair_monitoring ADD COLUMN IF NOT EXISTS observations_count INTEGER DEFAULT 0");
    await client.query("ALTER TABLE road.repair_monitoring ADD COLUMN IF NOT EXISTS authority_confirmation BOOLEAN DEFAULT FALSE");
    await client.query("ALTER TABLE road.repair_monitoring ADD COLUMN IF NOT EXISTS stability_score NUMERIC(5,2)");
    await client.query("ALTER TABLE road.repair_monitoring ADD COLUMN IF NOT EXISTS result VARCHAR(50)");

    // 1k. Sensor Observations
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.sensor_observations (
        observation_id SERIAL PRIMARY KEY,
        monitoring_id INTEGER NOT NULL REFERENCES road.repair_monitoring(monitoring_id) ON DELETE CASCADE,
        latitude NUMERIC,
        longitude NUMERIC,
        speed NUMERIC,
        acceleration_magnitude NUMERIC,
        peak_acceleration NUMERIC,
        jerk NUMERIC,
        gyroscope_change NUMERIC,
        confidence NUMERIC,
        observation_time TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1l. Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS road.notifications (
        notification_id SERIAL PRIMARY KEY,
        recipient_id VARCHAR(30) NOT NULL REFERENCES road.users(user_id) ON DELETE CASCADE,
        complaint_id VARCHAR(30) REFERENCES road.complaints(complaint_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Indexes
    console.log("[Migration] 2. Ensuring performance indexes...");
    await client.query("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON road.notifications(recipient_id, is_read, created_at DESC)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_complaints_citizen ON road.complaints(citizen_id)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_complaints_authority ON road.complaints(authority_id)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_complaints_status ON road.complaints(status)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_complaint_locations_coords ON road.complaint_locations(latitude, longitude)");

    // 3. Seed Authorities and Areas
    console.log("[Migration] 3. Seeding default authorities...");
    await client.query(`
      INSERT INTO road.authorities (authority_id, authority_name, authority_type, contact_email, contact_phone)
      VALUES ('AUTH-0001', 'Kolhapur Municipal Corporation', 'MUNICIPAL', 'authority@test.com', '9876500000')
      ON CONFLICT (authority_id) DO UPDATE
      SET authority_name = EXCLUDED.authority_name, contact_email = EXCLUDED.contact_email, contact_phone = EXCLUDED.contact_phone
    `);

    await client.query(`
      INSERT INTO road.authority_areas (authority_id, area_name, city, district, state)
      SELECT 'AUTH-0001', 'Kolhapur City', 'Kolhapur', 'Kolhapur', 'Maharashtra'
      WHERE NOT EXISTS (
        SELECT 1 FROM road.authority_areas WHERE authority_id = 'AUTH-0001' AND area_name = 'Kolhapur City'
      )
    `);

    // 4. Seed Core Users & Engineers
    console.log("[Migration] 4. Seeding default demo accounts and engineers...");
    const defaultUsers = [
      {
        id: "CIT-0001",
        name: "Aishwarya Patil",
        email: "aishwarya@test.com",
        password_hash: "Citizen@123",
        phone: "9876543210",
        role: "CITIZEN"
      },
      {
        id: "AUTHUSER-0001",
        name: "Municipal Engineer",
        email: "engineer@test.com",
        password_hash: "Authority@123",
        phone: "9876500001",
        role: "AUTHORITY"
      },
      {
        id: "CIT-0002",
        name: "Aishwarya Patil",
        email: "aishwaryapatil098765@gmail.com",
        password_hash: "123456",
        phone: "1234567890",
        role: "CITIZEN"
      },
      {
        id: "ENG-0001",
        name: "Rajesh Kumar",
        email: "rajesh.engineer@margdrishti.demo",
        password_hash: "Engineer@123",
        phone: "9845012345",
        role: "ENGINEER"
      },
      {
        id: "ENG-0002",
        name: "Priya Sharma",
        email: "priya.engineer@margdrishti.demo",
        password_hash: "Engineer@123",
        phone: "9741256789",
        role: "ENGINEER"
      },
      {
        id: "ENG-0003",
        name: "Vikram Singh",
        email: "vikram.engineer@margdrishti.demo",
        password_hash: "Engineer@123",
        phone: "9823045678",
        role: "ENGINEER"
      }
    ];

    for (const u of defaultUsers) {
      await client.query(
        `INSERT INTO road.users (user_id, name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
         SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, phone = EXCLUDED.phone, role = EXCLUDED.role`,
        [u.id, u.name, u.email, u.password_hash, u.phone, u.role]
      );
    }

    await client.query("COMMIT");
    console.log("[Migration] Database migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Migration] Error during migration:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function runMigrationWithRetry(maxRetries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await runMigration();
      return;
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      console.warn(`[Migration] Attempt ${attempt} failed (${err.message}). Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

if (require.main === module) {
  runMigrationWithRetry()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration, runMigrationWithRetry };

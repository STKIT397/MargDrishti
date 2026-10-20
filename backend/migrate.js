const pool = require("./db");

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("[Migration] Starting database migration for MargDrishti...");
    await client.query("BEGIN");

    // 1. Update check constraint on road.users.role to include ENGINEER
    console.log("[Migration] 1. Updating chk_user_role constraint...");
    await client.query("ALTER TABLE road.users DROP CONSTRAINT IF EXISTS chk_user_role");
    await client.query("ALTER TABLE road.users ADD CONSTRAINT chk_user_role CHECK (role IN ('CITIZEN', 'AUTHORITY', 'ENGINEER'))");

    // 2. Add demo engineers to road.users if they do not exist
    console.log("[Migration] 2. Seeding demo engineers in road.users...");
    const demoEngineers = [
      { id: "ENG-0001", name: "Rajesh Kumar", email: "rajesh.engineer@margdrishti.demo", phone: "9845012345", role: "ENGINEER" },
      { id: "ENG-0002", name: "Priya Sharma", email: "priya.engineer@margdrishti.demo", phone: "9741256789", role: "ENGINEER" },
      { id: "ENG-0003", name: "Vikram Singh", email: "vikram.engineer@margdrishti.demo", phone: "9823045678", role: "ENGINEER" }
    ];

    for (const eng of demoEngineers) {
      await client.query(
        `INSERT INTO road.users (user_id, name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, 'Engineer@123', $4, $5)
         ON CONFLICT (user_id) DO UPDATE 
         SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, role = EXCLUDED.role`,
        [eng.id, eng.name, eng.email, eng.phone, eng.role]
      );
    }

    // 3. Add priority_breakdown column to road.complaints
    console.log("[Migration] 3. Adding priority_breakdown to road.complaints...");
    await client.query("ALTER TABLE road.complaints ADD COLUMN IF NOT EXISTS priority_breakdown JSONB");

    // 4. Add expected_completion_date, status, acknowledged_at to road.assignments
    console.log("[Migration] 4. Adding columns to road.assignments...");
    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS expected_completion_date DATE");
    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ASSIGNED'");
    await client.query("ALTER TABLE road.assignments ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITHOUT TIME ZONE");

    // 5. Add progress_pct, repair_notes, completion_image_path to road.repairs
    console.log("[Migration] 5. Adding columns to road.repairs...");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS repair_notes TEXT");
    await client.query("ALTER TABLE road.repairs ADD COLUMN IF NOT EXISTS completion_image_path TEXT");

    // 6. Create notifications table
    console.log("[Migration] 6. Creating road.notifications table...");
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
    await client.query("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON road.notifications(recipient_id, is_read, created_at DESC)");

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

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };

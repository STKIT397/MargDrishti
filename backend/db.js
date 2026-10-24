const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = (process.env.DATABASE_URL || "").trim();
const requiredParts = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missingParts = databaseUrl
  ? []
  : requiredParts.filter((key) => !(process.env[key] || "").trim());

if (!databaseUrl && missingParts.length > 0) {
  console.error(
    `[Database configuration] Missing environment variables: ${missingParts.join(", ")}. ` +
    "Set DATABASE_URL, or set DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD."
  );
}

const useSsl =
  process.env.DB_SSL === "true" ||
  (isProduction && process.env.DB_SSL !== "false");

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: Number(process.env.DB_POOL_MAX || 10),
    }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: Number(process.env.DB_POOL_MAX || 10),
    };

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("[Database] Unexpected idle-client error:", error?.code || "UNKNOWN", error?.message || String(error));
});

pool.getConfigurationStatus = function getConfigurationStatus() {
  return {
    configured: Boolean(databaseUrl) || missingParts.length === 0,
    connectionStringConfigured: Boolean(databaseUrl),
    missingVariables: missingParts,
    sslEnabled: useSsl,
  };
};

module.exports = pool;

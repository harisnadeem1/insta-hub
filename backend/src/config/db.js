const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

let hasLoggedInitialConnection = false;

pool.on("connect", () => {
  if (!hasLoggedInitialConnection) {
    console.log("Connected to PostgreSQL");
    hasLoggedInitialConnection = true;
  }
});

pool.on("error", (err) => {
  console.error("[pg] Unexpected PostgreSQL pool error");
  console.error(err);
});

module.exports = pool;
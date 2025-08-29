require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_URL
});

pool.connect()
  .then(() => console.log("Connected to Neon database!"))
  .catch(err => console.error("Database connection error", err));

module.exports = pool;

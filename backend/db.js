// Use mysql2's Promise API for async/await support
const mysql = require('mysql2/promise');

// Load database credentials from .env
require('dotenv').config();

// Create a connection pool.
// Pools reuse existing connections, avoiding the overhead of opening a new
// connection on every request.
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true, // queue requests instead of failing when pool is full
  connectionLimit: 10       // maximum number of concurrent connections
});

// Export the pool for use in route handlers
module.exports = pool;

const mysql = require('mysql2');

// Create MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Moonknight67',
    database: 'hms_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert pool query into promise
const promisePool = pool.promise();

// Export the promise pool for use in other files
module.exports = promisePool;

// Schema is defined in schema.sql
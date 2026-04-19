const fs = require("fs");
const path = require("path");

const logFilePath = path.join(__dirname, "../../logs/api.log");

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

function logRequest({ method, url, params, query, body, status, ip }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method,
    url,
    params,
    query,
    body,
    status,
    ip,
  };
  fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + "\n");
}

module.exports = logRequest;

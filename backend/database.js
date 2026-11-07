
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "trades.db");

let db;

async function initializeDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const buffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      trade_id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pull_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      total_trades INTEGER DEFAULT 0,
      processed_trades INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      error TEXT
    );
  `);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];

  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }

  stmt.free();
  return results;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

function insertBatch(trades) {
  db.run("BEGIN TRANSACTION");

  try {
    for (const trade of trades) {
      db.run(
        `INSERT OR IGNORE INTO trades
        (trade_id, client, symbol, quantity, price, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          trade.tradeId,
          trade.client,
          trade.symbol,
          trade.quantity,
          trade.price,
          trade.timestamp
        ]
      );
    }

    db.run("COMMIT");
    saveDatabase();
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  query,
  run,
  insertBatch
};

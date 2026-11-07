
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const {
  initializeDatabase,
  query,
  run
} = require("./database");

const { startPull, cancelPull } = require("./worker");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

app.get("/api/trades", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const trades = query(
    `SELECT * FROM trades ORDER BY trade_id LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const total = query(
    "SELECT COUNT(*) AS count FROM trades"
  )[0].count;

  res.json({ trades, total });
});

app.post("/api/pulls", (req, res) => {
  const running = query(
    "SELECT id FROM pull_jobs WHERE status = 'running'"
  );

  if (running.length) {
    return res.status(409).json({ message: "A pull is already running" });
  }

  setImmediate(() => startPull(io));

  res.status(202).json({ message: "Trade pull started" });
});

app.post("/api/pulls/cancel", (req, res) => {
  const cancelled = cancelPull();

  if (!cancelled) {
    return res.status(400).json({
      message: "No active pull to cancel"
    });
  }

  res.json({
    message: "Cancellation requested"
  });
});

app.get("/api/pulls/status", (req, res) => {
  const jobs = query(
    "SELECT * FROM pull_jobs ORDER BY id DESC LIMIT 1"
  );

  res.json(jobs[0] || { status: "idle" });
});

app.get("/api/stats", (req, res) => {
  const stats = query(`
    SELECT
      COUNT(*) AS totalTrades,
      COALESCE(SUM(quantity), 0) AS totalQuantity,
      COUNT(DISTINCT symbol) AS uniqueSymbols
    FROM trades
  `)[0];

  res.json(stats);
});

io.on("connection", socket => {
  console.log("Dashboard connected:", socket.id);
});

initializeDatabase()
  .then(() => {
    server.listen(5000, () => {
      console.log("Backend running on http://localhost:5000");
    });
  })
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });

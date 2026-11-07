
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Configuration
const PORT = 4000;
const TOTAL_TRADES = 5000;
const BATCH_SIZE = 100;
const DELAY_MS = Math.min(
  25000,
  Math.max(0, Number(process.env.DELAY_MS || 1000))
);
// Seeded trade data
const symbols = [
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFC",
  "ICICIBANK",
  "WIPRO",
  "TATASTEEL",
  "SBIN",
  "ITC",
  "LT"
];

const clients = [
  "Rahul Sharma",
  "Amit Patel",
  "Priya Shah",
  "Neha Verma",
  "Arjun Mehta",
  "Sneha Gupta",
  "Rohan Singh",
  "Karan Joshi"
];

const trades = Array.from(
  { length: TOTAL_TRADES },
  (_, index) => ({
    tradeId: `TR${String(index + 1).padStart(5, "0")}`,
    client: clients[index % clients.length],
    symbol: symbols[index % symbols.length],
    quantity: ((index % 20) + 1) * 10,
    price: Number((500 + (index % 3000) + 0.5).toFixed(2)),
    timestamp: new Date(
      Date.now() - index * 60000
    ).toISOString()
  })
);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Mock BSE API"
  });
});

// Mock BSE endpoint
app.get("/getTrades", async (req, res) => {
  const cursor = Math.max(
    0,
    Number.parseInt(req.query.cursor, 10) || 0
  );

  const limit = Math.min(
    500,
    Math.max(
      1,
      Number.parseInt(req.query.limit, 10) || BATCH_SIZE
    )
  );

  // Simulate configurable API delay
  await new Promise((resolve) =>
    setTimeout(resolve, DELAY_MS)
  );

  const batch = trades.slice(cursor, cursor + limit);

  res.json({
    trades: batch,
    total: TOTAL_TRADES,
    cursor,
    limit,
    nextCursor:
      cursor + batch.length < TOTAL_TRADES
        ? cursor + batch.length
        : null,
    hasMore: cursor + batch.length < TOTAL_TRADES
  });
});

app.listen(PORT, () => {
  console.log(`Mock BSE API running at http://localhost:${PORT}`);
  console.log(`Total seeded trades: ${TOTAL_TRADES}`);
  console.log(`Configured delay: ${DELAY_MS}ms`);
});


import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API = "http://localhost:5000";
const PAGE_SIZE = 100;
const socket = io(API);

function App() {
  const [currentPage, setCurrentPage] = useState(1);
  const [trades, setTrades] = useState([]);

  const [stats, setStats] = useState({
    totalTrades: 0,
    totalQuantity: 0,
    uniqueSymbols: 0
  });

  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadTrades() {
    const offset = (currentPage - 1) * PAGE_SIZE;

    const response = await fetch(
      `${API}/api/trades?limit=${PAGE_SIZE}&offset=${offset}`
    );

    const data = await response.json();
    setTrades(data.trades);
  }

  async function loadStats() {
    const response = await fetch(`${API}/api/stats`);
    const data = await response.json();
    setStats(data);
  }

  async function loadStatus() {
    const response = await fetch(`${API}/api/pulls/status`);
    const data = await response.json();

    setStatus(data.status || "idle");

    if (data.total_trades > 0) {
      setProgress(
        Math.round((data.processed_trades / data.total_trades) * 100)
      );
    }

    setLoading(data.status === "running");
  }

  async function startPull() {
    try {
      const response = await fetch(`${API}/api/pulls`, {
        method: "POST"
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.message || "Could not start pull");
        return;
      }

      setLoading(true);
      setProgress(0);
      setStatus("running");
    } catch (error) {
      alert("Backend connection failed");
    }
  }

  async function stopPull() {
    try {
      const response = await fetch(`${API}/api/pulls/cancel`, {
        method: "POST"
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Could not stop pull");
      }
    } catch (error) {
      alert("Backend connection failed");
    }
  }

  useEffect(() => {
    loadTrades();
    loadStats();
    loadStatus();

    socket.on("trades:updated", (data) => {
      loadTrades();
      loadStats();

      setProgress(data.progress);
      setStatus("running");
    });

    socket.on("pull:completed", () => {
      setStatus("completed");
      setProgress(100);
      setLoading(false);
      loadTrades();
      loadStats();
    });

    socket.on("pull:failed", () => {
      setStatus("failed");
      setLoading(false);
      loadStatus();
    });

    socket.on("pull:cancelled", () => {
      setStatus("cancelled");
      setLoading(false);
      loadTrades();
      loadStats();
    });

    return () => {
      socket.off("trades:updated");
      socket.off("pull:completed");
      socket.off("pull:failed");
      socket.off("pull:cancelled");
    };
  }, [currentPage]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>BSE Trades Dashboard</h1>
          <p>Real-time trade ingestion and monitoring</p>
        </div>

        <div className="action-buttons">
          <button onClick={startPull} disabled={loading}>
            Start Trade Pull
          </button>

          <button
            onClick={stopPull}
            disabled={!loading}
            className="stop-button"
          >
            Stop Pull
          </button>
        </div>
      </header>

      <section className="stats">
        <div className="stat-card">
          <span>Total Trades</span>
          <h2>{stats.totalTrades.toLocaleString()}</h2>
        </div>

        <div className="stat-card">
          <span>Total Quantity</span>
          <h2>{stats.totalQuantity.toLocaleString()}</h2>
        </div>

        <div className="stat-card">
          <span>Unique Symbols</span>
          <h2>{stats.uniqueSymbols}</h2>
        </div>

        <div className="stat-card">
          <span>Pull Status</span>
          <h2 className="status">{status.toUpperCase()}</h2>
        </div>
      </section>

      <section className="progress-section">
        <div className="progress-heading">
          <h3>Ingestion Progress</h3>
          <strong>{progress}%</strong>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="table-section">
        <h3>Latest Trades</h3>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Client</th>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Timestamp</th>
              </tr>
            </thead>

            <tbody>
              {trades.map((trade) => (
                <tr key={trade.trade_id}>
                  <td>{trade.trade_id}</td>
                  <td>{trade.client}</td>
                  <td>{trade.symbol}</td>
                  <td>{trade.quantity}</td>
                  <td>₹{Number(trade.price).toFixed(2)}</td>
                  <td>{new Date(trade.timestamp).toLocaleString()}</td>
                </tr>
              ))}

              {trades.length === 0 && (
                <tr>
                  <td colSpan="6">No trades available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <p className="footer">
            Showing {trades.length} of {stats.totalTrades} stored trades
          </p>

          <div>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>

            <span>
              {" "}Page {currentPage} of{" "}
              {Math.max(1, Math.ceil(stats.totalTrades / PAGE_SIZE))}{" "}
            </span>

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={
                currentPage >= Math.ceil(stats.totalTrades / PAGE_SIZE)
              }
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;

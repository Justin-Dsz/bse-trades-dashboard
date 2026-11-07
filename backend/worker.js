
const axios = require("axios");
const { query, run, insertBatch } = require("./database");

const BSE_URL = "http://localhost:4000/getTrades";
const BATCH_SIZE = 100;

let activeController = null;

async function startPull(io) {
  if (activeController) return;

  const controller = new AbortController();
  activeController = controller;

  run(
    `INSERT INTO pull_jobs (status, started_at)
     VALUES ('running', ?)`,
    [new Date().toISOString()]
  );

  const jobId = query(
    "SELECT last_insert_rowid() AS id"
  )[0].id;

  try {
    let cursor = 0;
    let processed = 0;
    let total = 0;

    while (!controller.signal.aborted) {
      const response = await axios.get(BSE_URL, {
        params: { cursor, limit: BATCH_SIZE },
        timeout: 25000,
        signal: controller.signal
      });

      if (controller.signal.aborted) break;

      const {
        trades,
        total: totalCount,
        nextCursor
      } = response.data;

      total = totalCount;

      if (trades.length === 0) break;

      insertBatch(trades);
      processed += trades.length;

      run(
        `UPDATE pull_jobs
         SET total_trades = ?, processed_trades = ?
         WHERE id = ?`,
        [total, processed, jobId]
      );

      io.emit("trades:updated", {
        jobId,
        inserted: trades.length,
        processed,
        total,
        progress: Math.round((processed / total) * 100)
      });

      cursor = nextCursor;

      if (nextCursor === null) break;
    }

    if (controller.signal.aborted) {
      run(
        `UPDATE pull_jobs
         SET status = 'cancelled', completed_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), jobId]
      );

      io.emit("pull:cancelled", { jobId, processed });
      return;
    }

    run(
      `UPDATE pull_jobs
       SET status = 'completed', completed_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), jobId]
    );

    io.emit("pull:completed", { jobId });

  } catch (error) {
    if (controller.signal.aborted) {
      run(
        `UPDATE pull_jobs
         SET status = 'cancelled', completed_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), jobId]
      );

      io.emit("pull:cancelled", { jobId });
    } else {
      run(
        `UPDATE pull_jobs
         SET status = 'failed', error = ?
         WHERE id = ?`,
        [error.message, jobId]
      );

      io.emit("pull:failed", {
        jobId,
        error: error.message
      });
    }
  } finally {
    activeController = null;
  }
}

function cancelPull() {
  if (!activeController) return false;

  activeController.abort();
  return true;
}

module.exports = { startPull, cancelPull };

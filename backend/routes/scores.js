const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Save a game result (POST /scores)
router.post('/', async (req, res) => {
  const { moves, time_sec } = req.body;
  // Both fields must be integers
  if (!Number.isInteger(moves) || !Number.isInteger(time_sec)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  try {
    // Parameterised query prevents SQL injection
    const [result] = await db.execute(
      'INSERT INTO scores (moves, time_sec) VALUES (?, ?)',
      [moves, time_sec]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Retrieve score history (GET /scores?limit=20)
router.get('/', async (req, res) => {
  // Default 20 rows, capped at 100
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    // Sort by fewest moves first, then fastest time
    const [rows] = await db.query(
      `SELECT id, moves, time_sec, played_at FROM scores ORDER BY moves ASC, time_sec ASC LIMIT ${limit}`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Aggregate statistics (GET /scores/stats)
router.get('/stats', async (req, res) => {
  try {
    const [[stats]] = await db.execute(`
      SELECT
        COUNT(*)             AS total_games,
        MIN(moves)           AS best_moves,
        MIN(time_sec)        AS best_time,
        ROUND(AVG(moves))    AS avg_moves,
        ROUND(AVG(time_sec)) AS avg_time
      FROM scores
    `);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Clear all records (DELETE /scores)
router.delete('/', async (_req, res) => {
  try {
    await db.execute('DELETE FROM scores');
    // Reset auto-increment so the next record starts at id 1
    await db.execute('ALTER TABLE scores AUTO_INCREMENT = 1');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scoresRouter = require('./routes/scores');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/scores', scoresRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
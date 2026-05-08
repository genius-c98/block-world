# Blocks World

A browser-based puzzle game where players rearrange coloured blocks to match a goal configuration. Includes multiple game modes — from manual play to AI and reinforcement learning opponents.

## Game Modes

- **Basic** — 5 blocks, random start and goal. Solve the puzzle with as few moves as possible.
- **Advanced** — Choose the number of blocks and design your own goal layout.
- **AI Mode** — Turn-based battle against a computer opponent. First to reach the goal wins.
- **Adversarial Mode** — Race a Q-Learning AI on the same board toward the same goal. Score is calculated as `moves × 2 + time`. Lower score wins.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: MySQL (stores score history and leaderboard)

## Getting Started

### Prerequisites

- Node.js
- MySQL

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/genius-c98/block-world.git
   cd block-world
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Create a `.env` file inside the `backend/` folder:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=blocksworld
   PORT=3000
   ```

4. Create the database in MySQL:
   ```sql
   CREATE DATABASE IF NOT EXISTS blocksworld;
   ```

5. Start the backend server:
   ```bash
   node server.js
   ```

6. Open `frontend/index.html` in your browser.

## API Endpoints

| Method | Endpoint        | Description                        |
|--------|-----------------|------------------------------------|
| POST   | `/scores`       | Save a game result                 |
| GET    | `/scores`       | Get score history (default top 20) |
| GET    | `/scores/stats` | Get aggregate statistics           |
| DELETE | `/scores`       | Clear all records                  |

## Scoring (Adversarial Mode)

Winner is decided by weighted score: **moves × 2 + time (seconds)**. Fewer moves matter more than raw speed.

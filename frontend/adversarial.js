const MOVE_W        = 2;
const TIME_W        = 1;
const AI_MOVE_MS    = 2000;
const BLOCK_COUNT   = 5;

let goalArr     = [];
let humanStacks = [];
let aiStacks    = [];

let humanMoves = 0, humanTimeSec = 0, humanDone = false;
let aiMoves    = 0, aiTimeSec    = 0, aiDone    = false;

let raceStartMs = null;   // timestamp when the race begins
let selected    = null;   // selected source stack index (human)
let clockTick   = null;   // setInterval handle for live clock
let aiInterval  = null;   // setInterval handle for AI move loop

const elStatus      = document.getElementById("statusBar");
const elHumanBoard  = document.getElementById("humanBoard");
const elAIBoard     = document.getElementById("aiBoard");
const elGoalDisplay = document.getElementById("goalDisplay");
const elHumanMoves  = document.getElementById("humanMoves");
const elHumanTime   = document.getElementById("humanTime");
const elAIMoves     = document.getElementById("aiMoves");
const elAITime      = document.getElementById("aiTime");
const elHumanScore  = document.getElementById("humanScore");
const elAIScore     = document.getElementById("aiScore");
const resultModal   = document.getElementById("resultModal");

function generateBlocks(n) {
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomStacks(blocks) {
  const s = [[], [], []];
  blocks.forEach(b => s[Math.floor(Math.random() * 3)].push(b));
  return s;
}

function cloneStacks(s) { return s.map(x => [...x]); }

function arrEq(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function isGoal(stacks) {
  return stacks.some(s => arrEq(s, goalArr));
}

function calcScore(moves, timeSec) {
  return moves * MOVE_W + timeSec * TIME_W;
}

function renderGoal() {
  elGoalDisplay.innerHTML = "";
  const div = document.createElement("div");
  div.className = "stack";
  goalArr.forEach(b => {
    const bd = document.createElement("div");
    bd.className = "block dim";
    bd.textContent = b;
    div.appendChild(bd);
  });
  elGoalDisplay.appendChild(div);
}

function renderBoard(stacks, container, interactive) {
  container.innerHTML = "";
  stacks.forEach((stack, si) => {
    const div = document.createElement("div");
    div.className = "stack";

    if (interactive) {
      div.addEventListener("click", () => {
        if (!raceStartMs || humanDone || selected === null) return;
        doHumanMove(selected, si);
        selected = null;
        renderBoard(humanStacks, elHumanBoard, true);
      });
      div.addEventListener("dragover", e => {
        e.preventDefault();
        div.classList.add("drag-over");
      });
      div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
      div.addEventListener("drop", e => {
        e.preventDefault();
        div.classList.remove("drag-over");
        if (!raceStartMs || humanDone || selected === null) return;
        doHumanMove(selected, si);
        selected = null;
        renderBoard(humanStacks, elHumanBoard, true);
      });
    }

    stack.forEach((block, bi) => {
      const bd = document.createElement("div");
      bd.className = "block";
      bd.textContent = block;
      const isTop = bi === stack.length - 1;

      if (!interactive || !isTop) {
        bd.classList.add("dim");
      } else {
        bd.classList.add("top");
        if (selected === si) bd.classList.add("selected");
        bd.setAttribute("draggable", "true");

        bd.addEventListener("click", e => {
          e.stopPropagation();
          if (!raceStartMs || humanDone) return;
          selected = si;
          renderBoard(humanStacks, elHumanBoard, true);
        });
        bd.addEventListener("dragstart", e => {
          if (!raceStartMs || humanDone) { e.preventDefault(); return; }
          e.dataTransfer.setData("text/plain", String(si));
          selected = si;
          renderBoard(humanStacks, elHumanBoard, true);
        });
        bd.addEventListener("dragend", () => {
          renderBoard(humanStacks, elHumanBoard, true);
        });
      }
      div.appendChild(bd);
    });

    container.appendChild(div);
  });
}

function updateStats() {
  elHumanMoves.textContent = humanMoves;
  elAIMoves.textContent    = aiMoves;

  if (!raceStartMs) return;
  const now = Date.now();
  const ht  = humanDone ? humanTimeSec : Math.floor((now - raceStartMs) / 1000);
  const at  = aiDone    ? aiTimeSec    : Math.floor((now - raceStartMs) / 1000);

  elHumanTime.textContent = ht;
  elAITime.textContent    = at;
  elHumanScore.textContent = `Score: ${calcScore(humanMoves, ht)}`;
  elAIScore.textContent    = `Score: ${calcScore(aiMoves, at)}`;
}

function doHumanMove(from, to) {
  if (from === to || !humanStacks[from] || humanStacks[from].length === 0) return;
  humanStacks[to].push(humanStacks[from].pop());
  humanMoves++;
  updateStats();
  renderBoard(humanStacks, elHumanBoard, !humanDone);
  if (isGoal(humanStacks)) finishHuman();
}

function finishHuman() {
  humanDone    = true;
  humanTimeSec = Math.floor((Date.now() - raceStartMs) / 1000);
  elHumanTime.textContent  = humanTimeSec;
  elHumanScore.textContent = `Score: ${calcScore(humanMoves, humanTimeSec)}`;
  selected = null;
  renderBoard(humanStacks, elHumanBoard, false);
  elStatus.textContent = aiDone ? "Both done!" : "You finished! Waiting for AI...";

  // Save human score to history (AI score is not recorded)
  fetch('http://localhost:3000/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves: humanMoves, time_sec: humanTimeSec })
  }).catch(err => console.error('Failed to save score:', err));

  if (aiDone) showResult();
}

function startAI() {
  aiInterval = setInterval(() => {
    if (aiDone) { clearInterval(aiInterval); return; }

    const mv = window.BW_QL ? window.BW_QL.decide(aiStacks) : null;
    if (!mv) { clearInterval(aiInterval); return; }

    aiStacks[mv.to].push(aiStacks[mv.from].pop());
    aiMoves++;
    updateStats();
    renderBoard(aiStacks, elAIBoard, false);

    if (isGoal(aiStacks)) {
      clearInterval(aiInterval);
      aiDone    = true;
      aiTimeSec = Math.floor((Date.now() - raceStartMs) / 1000);
      elAITime.textContent = aiTimeSec;
      elAIScore.textContent = `Score: ${calcScore(aiMoves, aiTimeSec)}`;
      elStatus.textContent = humanDone ? "Both done!" : "AI finished! Keep going...";
      if (humanDone) showResult();
    }
  }, AI_MOVE_MS);
}

function showResult() {
  if (clockTick) clearInterval(clockTick);

  const hScore = calcScore(humanMoves, humanTimeSec);
  const aScore = calcScore(aiMoves, aiTimeSec);

  const title =
    hScore < aScore ? "You Win! 🎉" :
    hScore > aScore ? "AI Wins!"    : "It's a Tie! 🤝";

  document.getElementById("resultTitle").textContent  = title;
  document.getElementById("rHumanMoves").textContent  = humanMoves;
  document.getElementById("rHumanTime").textContent   = humanTimeSec;
  document.getElementById("rHumanScore").textContent  = hScore;
  document.getElementById("rAIMoves").textContent     = aiMoves;
  document.getElementById("rAITime").textContent      = aiTimeSec;
  document.getElementById("rAIScore").textContent     = aScore;

  const humanCell = document.getElementById("humanCell");
  const aiCell    = document.getElementById("aiCell");
  if (hScore < aScore) humanCell.classList.add("winner");
  else if (aScore < hScore) aiCell.classList.add("winner");

  resultModal.classList.remove("hidden");
}

function resetGame() {
  if (clockTick)  clearInterval(clockTick);
  if (aiInterval) clearInterval(aiInterval);
  resultModal.classList.add("hidden");

  document.getElementById("humanCell").classList.remove("winner");
  document.getElementById("aiCell").classList.remove("winner");

  const blocks = generateBlocks(BLOCK_COUNT);
  goalArr = shuffle([...blocks]);

  // Both players start from the same random initial state
  let initStacks;
  for (let i = 0; i < 200; i++) {
    initStacks = randomStacks(blocks);
    if (!isGoal(initStacks)) break;
  }

  humanStacks = cloneStacks(initStacks);
  aiStacks    = cloneStacks(initStacks);

  humanMoves = 0; humanTimeSec = 0; humanDone = false;
  aiMoves    = 0; aiTimeSec    = 0; aiDone    = false;
  selected   = null;
  raceStartMs = null;

  elHumanMoves.textContent = "0";
  elHumanTime.textContent  = "0";
  elAIMoves.textContent    = "0";
  elAITime.textContent     = "0";
  elHumanScore.textContent = "";
  elAIScore.textContent    = "";
  elStatus.textContent     = "Training AI (Q-Learning)...";

  renderGoal();
  renderBoard(humanStacks, elHumanBoard, false);
  renderBoard(aiStacks,    elAIBoard,    false);

  // Train Q-Learning then start the race.
  // Polls until ai_ql.js finishes loading on the first visit.
  const capturedGoal = [...goalArr];
  function tryTrain() {
    if (window.BW_QL) {
      window.BW_QL.train(capturedGoal);
      raceStartMs = Date.now();
      elStatus.textContent = "Go! Solve the puzzle as fast as you can!";
      renderBoard(humanStacks, elHumanBoard, true);
      clockTick = setInterval(updateStats, 250);
      startAI();
    } else {
      setTimeout(tryTrain, 100);
    }
  }
  setTimeout(tryTrain, 50);
}

document.getElementById("restartBtn").addEventListener("click", resetGame);
document.getElementById("playAgainBtn").addEventListener("click", resetGame);
document.getElementById("menuBtn").addEventListener("click", () => {
  window.location.href = "index.html";
});

resetGame();

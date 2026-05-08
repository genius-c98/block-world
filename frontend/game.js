// Read the game mode from the URL: basic / advanced / ai / adversarial
const urlParams = new URLSearchParams(window.location.search);
const mode = (urlParams.get("mode") || "basic").toLowerCase();
console.log("Current mode:", mode);

// Load AI scripts only for the modes that need them
if (mode === "ai") {
  const s = document.createElement("script");
  s.src = "ai.js";
  document.body.appendChild(s);
}

if (mode === "adversarial") {
  const s = document.createElement("script");
  s.src = "ai_ql.js";
  document.body.appendChild(s);
}

const ADV_KEY = "bw_advanced_config";

let state = {
  stacks: [],
  goal: [],
  moves: 0,
  startTimeMs: null,
  timerId: null,
  selected: null,
  draggingFrom: null,
  turn: "human",
  aiBusy: false,
  humanGoal: [],
  aiGoal: []
};

const elGame    = document.getElementById("game");
const elGoal    = document.getElementById("goal");
const elMoves   = document.getElementById("moves");
const elTime    = document.getElementById("time");
const elStatus  = document.getElementById("status");
const elRestart = document.getElementById("restartBtn");

const winModal    = document.getElementById("winModal");
const winMoves    = document.getElementById("winMoves");
const winTime     = document.getElementById("winTime");
const restartBtn2 = document.getElementById("restartBtn2");
const menuBtn     = document.getElementById("menuBtn");

const elAIMoveBtn = document.getElementById("aiMoveBtn");

function generateBlocks(n) {
  const letters = [];
  for (let i = 0; i < n; i++) {
    letters.push(String.fromCharCode(65 + i));
  }
  return letters;
}

function generateInitialStacks(blockCount) {
  const blocks = generateBlocks(blockCount);
  const stacks = [[], [], []];
  blocks.forEach(b => {
    const randomStack = Math.floor(Math.random() * 3);
    stacks[randomStack].push(b);
  });
  return stacks;
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cloneStacks(stacks) {
  return stacks.map(s => [...s]);
}

function topIndex(stack) {
  return stack.length - 1;
}

function stacksEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

function isValidMove(fromStack, toStack) {
  if (fromStack === toStack) return { ok: false, reason: "Cannot move to the same stack." };
  if (fromStack < 0 || fromStack >= state.stacks.length) return { ok: false, reason: "Invalid source stack." };
  if (toStack   < 0 || toStack   >= state.stacks.length) return { ok: false, reason: "Invalid target stack." };
  if (state.stacks[fromStack].length === 0) return { ok: false, reason: "Source stack is empty." };
  return { ok: true, reason: "" };
}

function startTimerIfNeeded() {
  if (state.startTimeMs !== null) return;
  state.startTimeMs = Date.now();
  state.timerId = window.setInterval(() => {
    const sec = Math.floor((Date.now() - state.startTimeMs) / 1000);
    elTime.textContent = String(sec);
  }, 250);
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

function tryMove(fromStack, toStack) {
  // Block input during the AI's turn
  if ((mode === "ai" || mode === "adversarial") && state.turn !== "human") return false;

  startTimerIfNeeded();

  const res = isValidMove(fromStack, toStack);
  if (!res.ok) {
    elStatus.textContent = res.reason;
    return false;
  }

  const block = state.stacks[fromStack].pop();
  state.stacks[toStack].push(block);
  state.moves += 1;

  elStatus.textContent = `Moved from ${fromStack + 1} -> ${toStack + 1}`;
  return true;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function saveScore(moves, time) {
  fetch('http://localhost:3000/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves, time_sec: time })
  }).catch(err => console.error('Failed to save score:', err));
}

function openWinModal(totalSec) {
  if (!winModal) return;
  if (winMoves) winMoves.textContent = String(state.moves);
  if (winTime)  winTime.textContent  = String(totalSec);

  const heading = winModal.querySelector("h2");
  if (heading) heading.textContent = "Goal Reached!";

  winModal.classList.remove("hidden");
}

function closeWinModal() {
  if (!winModal) return;
  winModal.classList.add("hidden");
}

function checkGoal() {
  // Adversarial mode: each player has a separate goal
  if (mode === "adversarial") {
    const humanTarget = (state.humanGoal || []).find(s => s.length > 0) || [];
    const aiTarget    = (state.aiGoal    || []).find(s => s.length > 0) || [];

    const humanWin = humanTarget.length > 0 && state.stacks.some(s => arraysEqual(s, humanTarget));
    const aiWin    = aiTarget.length    > 0 && state.stacks.some(s => arraysEqual(s, aiTarget));

    if (humanWin || aiWin) {
      stopTimer();
      const totalSec = state.startTimeMs
        ? Math.floor((Date.now() - state.startTimeMs) / 1000) : 0;

      elStatus.textContent = humanWin ? "You Win!" : "AI Wins!";
      openWinModal(totalSec);
      const h2 = winModal && winModal.querySelector("h2");
      if (h2) h2.textContent = humanWin ? "You Win! 🎉" : "AI Wins!";
      if (humanWin) saveScore(state.moves, totalSec);
      return true;
    }
    return false;
  }

  const target = state.goal.find(s => s.length > 0) || [];
  const win = state.stacks.some(s => arraysEqual(s, target));
  if (!win) return false;

  stopTimer();
  const totalSec = state.startTimeMs
    ? Math.floor((Date.now() - state.startTimeMs) / 1000)
    : 0;

  elStatus.textContent = "Congrats!";
  openWinModal(totalSec);
  saveScore(state.moves, totalSec);
  return true;
}

function scheduleAITurn() {
  if (mode === "adversarial") {
    if (!window.BW_QL) return;
    state.turn   = "ai";
    state.aiBusy = true;
    elStatus.textContent = "AI is thinking...";
    renderAll();
    window.BW_QL.requestMove();
    return;
  }
  if (!window.BW_AI) return;
  state.turn   = "ai";
  state.aiBusy = true;
  elStatus.textContent = "AI is thinking...";
  renderAll();
  window.BW_AI.requestMove();
}

function createStackDiv(stack, stackIndex, forGoal = false) {
  const stackDiv = document.createElement("div");
  stackDiv.className = "stack";

  if (!forGoal) {
    stackDiv.addEventListener("click", () => {
      if (!state.selected) return;
      if ((mode === "ai" || mode === "adversarial") && state.turn !== "human") return;
      const moved = tryMove(state.selected.fromStack, stackIndex);
      state.selected = null;
      renderAll();
      closeWinModal();
      if (moved) {
        const won = checkGoal();
        if (!won && (mode === "ai" || mode === "adversarial")) scheduleAITurn();
      }
    });

    stackDiv.addEventListener("dragover", (e) => {
      e.preventDefault();
      stackDiv.classList.add("drag-over");
    });

    stackDiv.addEventListener("dragleave", () => {
      stackDiv.classList.remove("drag-over");
    });

    stackDiv.addEventListener("drop", (e) => {
      e.preventDefault();
      stackDiv.classList.remove("drag-over");

      if (state.draggingFrom === null) return;
      if ((mode === "ai" || mode === "adversarial") && state.turn !== "human") return;

      const from = state.draggingFrom;
      const to   = stackIndex;

      const moved = tryMove(from, to);
      state.draggingFrom = null;
      state.selected     = null;

      renderAll();
      if (moved) {
        const won = checkGoal();
        if (!won && (mode === "ai" || mode === "adversarial")) scheduleAITurn();
      }
    });
  }

  stack.forEach((block, idx) => {
    const blockDiv = document.createElement("div");
    blockDiv.className = "block";
    blockDiv.textContent = block;

    const isTop    = idx === topIndex(stack);
    const isAITurn = (mode === "ai" || mode === "adversarial") && state.turn !== "human";

    if (!forGoal) {
      if (isTop) {
        blockDiv.classList.add("top");
        if (isAITurn) blockDiv.classList.add("ai-turn");

        blockDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          if ((mode === "ai" || mode === "adversarial") && state.turn !== "human") return;
          startTimerIfNeeded();
          state.selected = { fromStack: stackIndex };
          elStatus.textContent = `Selected top block from stack ${stackIndex + 1}`;
          renderAll();
        });

        blockDiv.setAttribute("draggable", !isAITurn);

        blockDiv.addEventListener("dragstart", (e) => {
          if ((mode === "ai" || mode === "adversarial") && state.turn !== "human") { e.preventDefault(); return; }
          startTimerIfNeeded();
          state.draggingFrom = stackIndex;
          e.dataTransfer.setData("text/plain", String(stackIndex));
          e.dataTransfer.effectAllowed = "move";
          blockDiv.classList.add("dragging");
          elStatus.textContent = `Dragging from stack ${stackIndex + 1}`;
          state.selected = null;
        });

        blockDiv.addEventListener("dragend", () => {
          blockDiv.classList.remove("dragging");
          state.draggingFrom = null;
          renderAll();
        });
      } else {
        blockDiv.classList.add("dim");
      }

      if (state.selected && state.selected.fromStack === stackIndex && isTop) {
        blockDiv.classList.add("selected");
      }
    } else {
      blockDiv.classList.add("dim");
    }

    stackDiv.appendChild(blockDiv);
  });

  return stackDiv;
}

function renderBoard() {
  elGame.innerHTML = "";
  state.stacks.forEach((stack, i) => elGame.appendChild(createStackDiv(stack, i, false)));
}

function renderGoal() {
  elGoal.innerHTML = "";
  const goalNonEmpty = state.goal.find(s => s.length > 0) || [];
  elGoal.appendChild(createStackDiv(goalNonEmpty, 0, true));

  if (mode === "adversarial") {
    const elAIGoal = document.getElementById("aiGoal");
    if (elAIGoal) {
      elAIGoal.innerHTML = "";
      const aiTarget = (state.aiGoal || []).find(s => s.length > 0) || [];
      elAIGoal.appendChild(createStackDiv(aiTarget, 0, true));
    }
  }
}

function renderStats() {
  elMoves.textContent = String(state.moves);
  if (state.startTimeMs === null) elTime.textContent = "0";
}

function renderAll() {
  renderBoard();
  renderGoal();
  renderStats();
}

function loadAdvancedConfig() {
  const raw = localStorage.getItem(ADV_KEY);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    if (!cfg) return null;
    if (typeof cfg.blocksCount === "number" && Array.isArray(cfg.goalStacks)) {
      return cfg;
    }
    return null;
  } catch {
    return null;
  }
}

function applyModeUI() {
  const titleEl = document.querySelector(".title");
  if (titleEl) {
    if (mode === "basic")       titleEl.textContent = "Basic";
    if (mode === "advanced")    titleEl.textContent = "Advanced";
    if (mode === "ai")          titleEl.textContent = "AI";
    if (mode === "adversarial") titleEl.textContent = "Adversarial";
  }

  if (elAIMoveBtn) {
    elAIMoveBtn.style.display = mode === "ai" ? "inline-block" : "none";
  }

  const aiGoalSection = document.getElementById("aiGoalSection");
  const goalHeading   = document.getElementById("goalHeading");
  if (mode === "adversarial") {
    if (aiGoalSection) aiGoalSection.style.display = "block";
    if (goalHeading)   goalHeading.textContent = "Your Goal";
  }
}

function resetGame() {
  closeWinModal();
  stopTimer();

  let initStacks;
  let goalStacks;
  let blockCount;

  if (mode === "advanced") {
    const cfg = loadAdvancedConfig();

    if (!cfg || !Array.isArray(cfg.goalStacks)) {
      elStatus.textContent = "No advanced config found. Please set up first.";
      blockCount = 5;
      initStacks = generateInitialStacks(blockCount);
      goalStacks = [shuffleArray(initStacks.flat())];
    } else {
      goalStacks = cfg.goalStacks;

      blockCount =
        (typeof cfg.blocksCount === "number" && cfg.blocksCount > 0)
          ? cfg.blocksCount
          : (goalStacks[0]?.length || goalStacks.flat().length || 5);

      initStacks = generateInitialStacks(blockCount);

      // Avoid starting in the goal state
      const target = goalStacks[0] || [];
      if (target.length > 0 && initStacks.some(s => arraysEqual(s, target))) {
        initStacks = generateInitialStacks(blockCount);
      }
    }
  }

  if (mode === "adversarial") {
    blockCount = 5;
    initStacks = generateInitialStacks(blockCount);
    const allBlocks = generateBlocks(blockCount);

    const humanGoalArr = shuffleArray([...allBlocks]);
    let aiGoalArr;
    do { aiGoalArr = shuffleArray([...allBlocks]); }
    while (arraysEqual(aiGoalArr, humanGoalArr));

    goalStacks      = [humanGoalArr];
    state.humanGoal = [humanGoalArr];
    state.aiGoal    = [aiGoalArr];
  }

  if (mode !== "advanced" && mode !== "adversarial") {
    blockCount = 5;
    initStacks = generateInitialStacks(blockCount);
    goalStacks = [shuffleArray(initStacks.flat())];
  }

  state.stacks = cloneStacks(initStacks);
  state.goal   = cloneStacks(goalStacks);

  state.moves        = 0;
  state.startTimeMs  = null;
  state.selected     = null;
  state.draggingFrom = null;
  state.turn         = "human";
  state.aiBusy       = false;

  if (mode === "adversarial") {
    // Lock the board while Q-Learning trains, then unlock once ready
    state.turn = "ai";
    elStatus.textContent = "Training AI (Q-Learning)...";
    renderAll();

    const capturedAiGoal    = (state.aiGoal    || []).find(s => s.length > 0) || [];
    const capturedHumanGoal = (state.humanGoal || []).find(s => s.length > 0) || [];
    function tryTrain() {
      if (window.BW_QL) {
        window.BW_QL.train(capturedAiGoal, capturedHumanGoal);
        state.turn   = "human";
        state.aiBusy = false;
        elStatus.textContent = "Your turn (vs QL AI)";
        renderAll();
      } else {
        setTimeout(tryTrain, 100);
      }
    }
    setTimeout(tryTrain, 50);
  } else {
    elStatus.textContent = mode === "ai" ? "Your turn (vs AI)" : "Your turn";
    renderAll();
  }
}

elRestart.addEventListener("click", resetGame);

if (restartBtn2) {
  restartBtn2.addEventListener("click", () => {
    closeWinModal();
    resetGame();
  });
}

if (menuBtn) {
  menuBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

if (winModal) {
  winModal.addEventListener("click", (e) => {
    if (e.target === winModal) closeWinModal();
  });
}

applyModeUI();
resetGame();

// Interface exposed to ai.js and ai_ql.js
window.BW = {
  getMode:   () => mode,
  getState:  () => state,
  tryMove:   (from, to) => tryMove(from, to),
  renderAll: () => renderAll(),
  checkGoal: () => checkGoal(),
  resetGame: () => resetGame(),
  setStatus: (msg) => { elStatus.textContent = msg; }
};

const urlParams = new URLSearchParams(window.location.search);
const mode = (urlParams.get("mode") || "basic").toLowerCase();
console.log("Current mode:", mode);

if (mode === "ai") {
  const s = document.createElement("script");
  s.src = "ai.js";
  document.body.appendChild(s);
}

const ADV_KEY = "bw_advanced_config";

//游戏运行状态
let state = {
  stacks: [],
  goal: [],
  moves: 0,
  startTimeMs: null,
  timerId: null,

  selected: null,      // { fromStack: number }
  draggingFrom: null,  // number

  // 回合制（仅 AI mode 使用）
  turn: "human",       // "human" | "ai"
  aiBusy: false        // AI 正在计算/动画中
};

//页面
const elGame = document.getElementById("game");
const elGoal = document.getElementById("goal");
const elMoves = document.getElementById("moves");
const elTime = document.getElementById("time");
const elStatus = document.getElementById("status");
const elRestart = document.getElementById("restartBtn");

//胜利pop
const winModal = document.getElementById("winModal");
const winMoves = document.getElementById("winMoves");
const winTime = document.getElementById("winTime");
const restartBtn2 = document.getElementById("restartBtn2");
const menuBtn = document.getElementById("menuBtn");

const elAIMoveBtn = document.getElementById("aiMoveBtn");

// ---------- Utilities ----------
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

// 洗牌
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

// 只允许放到栈顶
function isValidMove(fromStack, toStack) {
  if (fromStack === toStack) return { ok: false, reason: "Cannot move to the same stack." };
  if (fromStack < 0 || fromStack >= state.stacks.length) return { ok: false, reason: "Invalid source stack." };
  if (toStack < 0 || toStack >= state.stacks.length) return { ok: false, reason: "Invalid target stack." };
  if (state.stacks[fromStack].length === 0) return { ok: false, reason: "Source stack is empty." };
  return { ok: true, reason: "" };
}

// 触发计时
function startTimerIfNeeded() {
  if (state.startTimeMs !== null) return;
  state.startTimeMs = Date.now();
  state.timerId = window.setInterval(() => {
    const sec = Math.floor((Date.now() - state.startTimeMs) / 1000);
    elTime.textContent = String(sec);
  }, 250);
}

// 停止计时
function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

function tryMove(fromStack, toStack) {
  // AI mode 下，非玩家回合禁止操作
  if (mode === "ai" && state.turn !== "human") return false;

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

// current=goal?
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// 提交成绩到后端
function saveScore(moves, time) {
  fetch('http://localhost:3000/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves, time_sec: time })
  }).catch(err => console.error('Failed to save score:', err));
}

// 胜利
function openWinModal(totalSec, winner) {
  if (!winModal) return;

  if (winMoves) winMoves.textContent = String(state.moves);
  if (winTime) winTime.textContent = String(totalSec);

  // 根据胜利方显示不同标题
  const heading = winModal.querySelector("h2");
  if (heading) {
    if (winner === "ai") heading.textContent = "AI Wins!";
    else if (winner === "human") heading.textContent = "You Win!";
    else heading.textContent = "Goal Reached!";
  }

  winModal.classList.remove("hidden");
}

function closeWinModal() {
  if (!winModal) return;
  winModal.classList.add("hidden");
}

// 返回 true 表示游戏已结束
function checkGoal() {
  const target = state.goal.find(s => s.length > 0) || [];
  const win = state.stacks.some(s => arraysEqual(s, target));
  if (!win) return false;

  stopTimer();
  const totalSec = state.startTimeMs
    ? Math.floor((Date.now() - state.startTimeMs) / 1000)
    : 0;

  const winner = state.turn === "ai" ? "ai" : "human";

  // Goal reached
  elStatus.textContent = "Congrats!";
  openWinModal(totalSec, winner);
  saveScore(state.moves, totalSec);
  return true;
}

// ---------- AI 回合调度 ----------
function scheduleAITurn() {
  if (!window.BW_AI) return; // ai.js 未加载
  state.turn = "ai";
  state.aiBusy = true;
  elStatus.textContent = "AI is thinking...";
  renderAll(); // 重新渲染，此时不会挂载玩家交互事件
  window.BW_AI.requestMove();
}

  // Rendering
function createStackDiv(stack, stackIndex, forGoal = false) {
  const stackDiv = document.createElement("div");
  stackDiv.className = "stack";

  if (!forGoal) {
    stackDiv.addEventListener("click", () => {
      if (!state.selected) return;
      if (mode === "ai" && state.turn !== "human") return; // AI 回合屏蔽
      const moved = tryMove(state.selected.fromStack, stackIndex);
      state.selected = null;
      renderAll();
      closeWinModal();
      if (moved) {
        const won = checkGoal();
        if (!won && mode === "ai") scheduleAITurn(); // 玩家走完 → AI 走
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
      if (mode === "ai" && state.turn !== "human") return; // AI 回合屏蔽

      const from = state.draggingFrom;
      const to = stackIndex;

      const moved = tryMove(from, to);

      state.draggingFrom = null;
      state.selected = null;

      renderAll();
      if (moved) {
        const won = checkGoal();
        if (!won && mode === "ai") scheduleAITurn(); // 玩家走完 → AI 走
      }
    });
  }

  stack.forEach((block, idx) => {
    const blockDiv = document.createElement("div");
    blockDiv.className = "block";
    blockDiv.textContent = block;

    const isTop = idx === topIndex(stack);

    if (!forGoal) {
      // AI 回合时，顶部 block 视觉上标记为不可操作
      const isAITurn = mode === "ai" && state.turn !== "human";

      if (isTop) {
        blockDiv.classList.add("top");
        if (isAITurn) blockDiv.classList.add("ai-turn"); // CSS 禁用光标

        // CLICK
        blockDiv.addEventListener("click", (e) => {
          e.stopPropagation();
          if (mode === "ai" && state.turn !== "human") return; // AI 回合屏蔽
          startTimerIfNeeded();
          state.selected = { fromStack: stackIndex };
          elStatus.textContent = `Selected top block from stack ${stackIndex + 1}`;
          renderAll();
        });

        // DRAG
        blockDiv.setAttribute("draggable", !isAITurn); // AI 回合禁止拖拽

        blockDiv.addEventListener("dragstart", (e) => {
          if (mode === "ai" && state.turn !== "human") { e.preventDefault(); return; }
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

      // highlight click-selected top block
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

  // Find the non-empty goal stack (assume only one goal stack contains blocks)
  const goalNonEmpty = state.goal.find(s => s.length > 0) || [];

  // Render exactly ONE goal container
  elGoal.appendChild(createStackDiv(goalNonEmpty, 0, true));
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

// ---------- Mode Setup ----------
function loadAdvancedConfig() {
  const raw = localStorage.getItem(ADV_KEY);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    if (!cfg) return null;

    // ✅ new schema: { blocksCount, goalStacks }
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
    if (mode === "basic") titleEl.textContent = "Basic";
    if (mode === "advanced") titleEl.textContent = "Advanced";
    if (mode === "ai") titleEl.textContent = "AI";
  }

  // AI button visibility is controlled here; ai.js will bind click handler
  if (elAIMoveBtn) {
    elAIMoveBtn.style.display = mode === "ai" ? "inline-block" : "none";
  }
}

// ---------- Restart ----------
function resetGame() {
  closeWinModal();
  stopTimer();

  let initStacks;
  let goalStacks;
  let blockCount;

  // -----------------------------
  // ADVANCED: use config from localStorage
  // -----------------------------
  if (mode === "advanced") {
    const cfg = loadAdvancedConfig();

    if (!cfg || !Array.isArray(cfg.goalStacks)) {
      elStatus.textContent = "No advanced config found. Please set up first.";
      // fallback: 5 blocks
      blockCount = 5;
      initStacks = generateInitialStacks(blockCount);
      goalStacks = [shuffleArray(initStacks.flat())];
    } else {
      goalStacks = cfg.goalStacks;

      // ✅ use cfg.blocksCount first; if missing, infer from goal stack length
      blockCount =
        (typeof cfg.blocksCount === "number" && cfg.blocksCount > 0)
          ? cfg.blocksCount
          : (goalStacks[0]?.length || goalStacks.flat().length || 5);

      initStacks = generateInitialStacks(blockCount);

      // avoid starting solved
      const target = goalStacks[0] || [];
      if (target.length > 0 && initStacks.some(s => arraysEqual(s, target))) {
        initStacks = generateInitialStacks(blockCount);
      }
    }
  }

  // -----------------------------
  // BASIC / AI: random goal from random initial
  // -----------------------------
  if (mode !== "advanced") {
    blockCount = 5; // basic/ai default
    initStacks = generateInitialStacks(blockCount);
    goalStacks = [shuffleArray(initStacks.flat())];
  }

  state.stacks = cloneStacks(initStacks);
  state.goal = cloneStacks(goalStacks);

  state.moves = 0;
  state.startTimeMs = null;
  state.selected = null;
  state.draggingFrom = null;
  state.turn = "human";
  state.aiBusy = false;

  elStatus.textContent = mode === "ai" ? "Your turn (vs AI)" : "Your turn";
  renderAll();
}

elRestart.addEventListener("click", resetGame);

// Win modal buttons
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


// Click outside modal to close (optional)
if (winModal) {
  winModal.addEventListener("click", (e) => {
    if (e.target === winModal) closeWinModal();
  });
}

// Init
applyModeUI();
resetGame();

// =======================================================
// Expose APIs for ai.js
// =======================================================
window.BW = {
  getMode: () => mode,
  getState: () => state,
  tryMove: (from, to) => tryMove(from, to),
  renderAll: () => renderAll(),
  checkGoal: () => checkGoal(),
  resetGame: () => resetGame(),
  setStatus: (msg) => { elStatus.textContent = msg; }
};
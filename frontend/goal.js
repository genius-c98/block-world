const ADV_KEY = "bw_advanced_config";

const poolEl       = document.getElementById("pool");
const goalStacksEl = document.getElementById("goalStacks");
const msgEl        = document.getElementById("msg");
const validateBtn  = document.getElementById("validateBtn");
const startBtn     = document.getElementById("startBtn");

let blocksCount = 0;
let allBlocks   = [];
let pool        = [];
let goalStacks  = [[]];

// { area: "pool"|"stack", stackIndex?: number, block: string }
let dragFrom = null;

function setMsg(text, ok = true) {
  if (!msgEl) return;
  msgEl.textContent = text || "";
  msgEl.style.color = ok ? "#15803d" : "#b91c1c";
}

function generateBlocks(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(String.fromCharCode(65 + i));
  return arr;
}

function loadStep1() {
  const raw = localStorage.getItem(ADV_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function flattenGoal() {
  return goalStacks.flat();
}

// Returns an error string if invalid, or null if the goal config is valid
function validateGoal() {
  const placed = flattenGoal();

  if (placed.length !== blocksCount) {
    return `You must place all ${blocksCount} blocks into Goal stacks. (Placed: ${placed.length})`;
  }

  const set = new Set(placed);
  if (set.size !== placed.length) {
    return "Duplicate blocks detected in Goal stack.";
  }

  const expected = new Set(allBlocks);
  for (const b of set)      if (!expected.has(b)) return `Invalid block found: ${b}`;
  for (const b of expected) if (!set.has(b))      return `Missing block in goal: ${b}`;

  return null;
}

function makeBlockDiv(letter) {
  const div = document.createElement("div");
  div.className = "block top";
  div.textContent = letter;
  div.setAttribute("draggable", "true");
  div.dataset.block = letter;

  div.addEventListener("dragstart", (e) => {
    dragFrom = { area: "pool", block: letter };
    e.dataTransfer.setData("text/plain", letter);
    e.dataTransfer.effectAllowed = "move";
    div.classList.add("dragging");
  });

  div.addEventListener("dragend", () => {
    div.classList.remove("dragging");
    dragFrom = null;
    renderAll();
  });

  return div;
}

function makeStackBlockDiv(letter, stackIndex) {
  const div = document.createElement("div");
  div.className = "block top";
  div.textContent = letter;
  div.setAttribute("draggable", "true");
  div.dataset.block = letter;

  div.addEventListener("dragstart", (e) => {
    dragFrom = { area: "stack", stackIndex, block: letter };
    e.dataTransfer.setData("text/plain", letter);
    e.dataTransfer.effectAllowed = "move";
    div.classList.add("dragging");
  });

  div.addEventListener("dragend", () => {
    div.classList.remove("dragging");
    dragFrom = null;
    renderAll();
  });

  return div;
}

function renderPool() {
  poolEl.innerHTML = "";
  pool.forEach(b => poolEl.appendChild(makeBlockDiv(b)));
}

function renderGoalStacks() {
  goalStacksEl.innerHTML = "";

  const stackDiv = document.createElement("div");
  stackDiv.className = "stack";

  stackDiv.addEventListener("dragover", (e) => {
    e.preventDefault();
    stackDiv.classList.add("drag-over");
  });
  stackDiv.addEventListener("dragleave", () => stackDiv.classList.remove("drag-over"));

  stackDiv.addEventListener("drop", (e) => {
    e.preventDefault();
    stackDiv.classList.remove("drag-over");
    handleDropToStack(0);
  });

  goalStacks[0].forEach(b => stackDiv.appendChild(makeStackBlockDiv(b, 0)));
  goalStacksEl.appendChild(stackDiv);
}

function renderAll() {
  renderPool();
  renderGoalStacks();
}

function removeBlockFromPool(b) {
  const idx = pool.indexOf(b);
  if (idx >= 0) pool.splice(idx, 1);
}

function removeBlockFromStack(stackIndex, b) {
  const s   = goalStacks[stackIndex];
  const idx = s.indexOf(b);
  if (idx >= 0) s.splice(idx, 1);
}

function handleDropToStack(targetStackIndex) {
  if (!dragFrom) return;
  const b = dragFrom.block;

  if (dragFrom.area === "pool") {
    removeBlockFromPool(b);
    goalStacks[targetStackIndex].push(b);
    renderAll();
    return;
  }

  if (dragFrom.area === "stack") {
    removeBlockFromStack(dragFrom.stackIndex, b);
    goalStacks[targetStackIndex].push(b);
    renderAll();
  }
}

function handleDropToPool() {
  if (!dragFrom) return;
  const b = dragFrom.block;

  if (dragFrom.area === "pool") return;

  if (dragFrom.area === "stack") {
    removeBlockFromStack(dragFrom.stackIndex, b);
    pool.push(b);
    pool.sort();
    renderAll();
  }
}

function saveConfigAndGo() {
  const err = validateGoal();
  if (err) {
    setMsg(err, false);
    return false;
  }

  localStorage.setItem(ADV_KEY, JSON.stringify({ blocksCount, goalStacks }));
  window.location.href = "game.html?mode=advanced";
  return true;
}

(function init() {
  const step1 = loadStep1();
  if (!step1 || !step1.blocksCount) {
    setMsg("Missing blocks count. Please go back to setup.", false);
    return;
  }

  blocksCount = step1.blocksCount;
  allBlocks   = generateBlocks(blocksCount);
  pool        = [...allBlocks];
  goalStacks  = [[]];

  poolEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    poolEl.classList.add("drag-over");
  });
  poolEl.addEventListener("dragleave", () => poolEl.classList.remove("drag-over"));
  poolEl.addEventListener("drop", (e) => {
    e.preventDefault();
    poolEl.classList.remove("drag-over");
    handleDropToPool();
  });

  setMsg(`Drag all ${blocksCount} blocks into the Goal stack, then click Validate/Start.`, true);
  renderAll();

  validateBtn.addEventListener("click", () => {
    const err = validateGoal();
    if (err) return setMsg(err, false);
    setMsg("✅ Goal configuration valid.", true);
  });

  startBtn.addEventListener("click", () => saveConfigAndGo());
})();

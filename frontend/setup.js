const ADV_KEY = "bw_advanced_config";

const nBlocksEl = document.getElementById("nBlocks");
const errorEl   = document.getElementById("error");
const nextBtn   = document.getElementById("nextBtn");

function setError(msg) {
  errorEl.textContent = msg || "";
}

nextBtn.addEventListener("click", () => {
  const n = Number(nBlocksEl.value);

  if (!Number.isFinite(n) || n < 3 || n > 8) {
    setError("Number of blocks must be between 3 and 8.");
    return;
  }

  // Persist to localStorage so goal.html can read the block count
  localStorage.setItem(ADV_KEY, JSON.stringify({ blocksCount: n }));
  window.location.href = "goal.html";
});

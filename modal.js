const modal = document.getElementById("modeModal");
const startBtn = document.getElementById("startBtn");

// Open modal
function openModal() {
  modal.classList.remove("hidden");
}

// Close modal
function closeModal() {
  modal.classList.add("hidden");
}

// Navigate to Basic
function goBasic() {
  window.location.href = "game.html?mode=basic";
}

// Navigate to Advanced
function goAdvanced() {
  window.location.href = "setup.html";
}

// Navigate to AI
function goAI() {
  window.location.href = "game.html?mode=ai";
}

// Button binding
if (startBtn) {
  startBtn.addEventListener("click", openModal);
}

// Close modal when clicking outside content
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}
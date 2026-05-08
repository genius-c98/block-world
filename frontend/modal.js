const modal    = document.getElementById("modeModal");
const startBtn = document.getElementById("startBtn");

function openModal()  { modal.classList.remove("hidden"); }
function closeModal() { modal.classList.add("hidden"); }

function goBasic()    { window.location.href = "game.html?mode=basic"; }
function goAdvanced() { window.location.href = "setup.html"; }
function goAI()       { window.location.href = "game.html?mode=ai"; }

if (startBtn) startBtn.addEventListener("click", openModal);

// Close when clicking outside the modal content
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

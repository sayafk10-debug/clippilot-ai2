const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

window.setToolType = function(type) {
  selectedType = type;

  document.querySelectorAll(".tool-buttons button").forEach(b => {
    b.classList.remove("active");
  });

  event.target.classList.add("active");
};

button.addEventListener("click", async () => {

  const topic = textarea.value.trim();
  if (!topic) return alert("Enter niche");

  button.innerText = "Generating...";
  button.disabled = true;

  result.innerHTML = '<div class="loader"></div>';

  const aiResponse = await generateScript(topic, selectedType);

  result.style.opacity = "0";

  result.innerHTML = `
    <h3>🔥 Result</h3>
    <pre id="typed"></pre>
    <button id="copyBtn">Copy</button>
  `;

  setTimeout(() => {

    let i = 0;
    const el = document.getElementById("typed");

    function type() {
      if (i < aiResponse.length) {
        el.innerHTML += aiResponse[i++];
        setTimeout(type, 10);
      }
    }

    type();

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied");
    };

  }, 100);

  // SAVE HISTORY
  history.unshift({ type: selectedType, prompt: topic });
  localStorage.setItem("clipHistory", JSON.stringify(history.slice(0, 10)));

  renderHistory();

  button.innerText = "Generate 🚀";
  button.disabled = false;
});

function renderHistory() {
  const box = document.getElementById("historyList");
  if (!box) return;

  box.innerHTML = "";

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `<b>${item.type}</b><br>${item.prompt}`;

    div.onclick = () => {
      textarea.value = item.prompt;
      setToolType(item.type);
    };

    box.appendChild(div);
  });
}

renderHistory();

const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

/* TOOL BUTTON CLICK */
window.setToolType = function(type) {
  selectedType = type;

  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.remove("active");

    if (btn.getAttribute("data-type") === type) {
      btn.classList.add("active");
    }
  });
};

/* GENERATE */
button.addEventListener("click", async () => {

  const topic = textarea.value.trim();
  if (!topic) return alert("Enter something");

  button.innerText = "Generating...";
  button.disabled = true;

  result.innerHTML = '<div class="loader"></div>';

  try {

    const aiResponse = await generateScript(topic, selectedType);

    result.innerHTML = `
      <h3>🔥 Result (${selectedType})</h3>
      <pre id="typed"></pre>
      <button id="copyBtn">Copy</button>
    `;

    const el = document.getElementById("typed");
    let i = 0;

    function typeWriter() {
      if (i < aiResponse.length) {
        el.innerHTML += aiResponse[i++];
        setTimeout(typeWriter, 8);
      }
    }

    typeWriter();

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied");
    };

    /* HISTORY SAVE */
    history.unshift({ type: selectedType, prompt: topic });

    localStorage.setItem("clipHistory", JSON.stringify(history.slice(0, 10)));

    renderHistory();

  } catch (e) {
    result.innerHTML = "Error: " + e.message;
  }

  button.innerText = "Generate 🚀";
  button.disabled = false;
});

/* HISTORY RENDER */
function renderHistory() {
  if (!historyBox) return;

  historyBox.innerHTML = "";

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";

    div.innerHTML = `<b>${item.type}</b><br>${item.prompt}`;

    div.onclick = () => {

      textarea.value = item.prompt;
      selectedType = item.type;

      document.querySelectorAll(".tool-buttons button").forEach(btn => {
        if (btn.getAttribute("data-type") === item.type) {
          btn.click();
        }
      });
    };

    historyBox.appendChild(div);
  });
}

/* INIT */
renderHistory();

const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

window.setToolType = function(type) {
  selectedType = type;
  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) {
      btn.classList.add("active");
    }
  });
};

button.addEventListener("click", async () => {
  const topic = textarea.value.trim();
  if (!topic) {
    alert("Enter something");
    return;
  }

  button.disabled = true;
  button.innerText = "Generating...";
  result.innerHTML = '<div class="loader"></div>';

  try {
    const aiResponse = await generateScript(topic, selectedType);

    result.innerHTML = `
      <h3>🔥 Result (${selectedType})</h3>
      <pre id="typed"></pre>
      <button id="copyBtn">Copy</button>
    `;

    const typed = document.getElementById("typed");
    typed.textContent = "";
    let i = 0;
    function typing() {
      if (i < aiResponse.length) {
        typed.textContent += aiResponse.charAt(i);
        i++;
        setTimeout(typing, 8);
      }
    }
    typing();

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied ✅");
    };

    history.unshift({
      type: selectedType,
      prompt: topic
    });
    history = history.slice(0, 10);
    localStorage.setItem("clipHistory", JSON.stringify(history));
    renderHistory();

  } catch (err) {
    result.innerHTML =
      `<p style="color:red">${err.message}</p>`;
  }

  button.disabled = false;
  button.innerText = "Generate 🚀";
});

function renderHistory() {
  if (!historyBox) return;
  historyBox.innerHTML = "";

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <strong>${item.type}</strong><br>
      ${item.prompt}
    `;

    div.onclick = () => {
      textarea.value = item.prompt;
      setToolType(item.type);
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      textarea.focus();
    };

    historyBox.appendChild(div);
  });
}

setToolType(selectedType);
renderHistory();

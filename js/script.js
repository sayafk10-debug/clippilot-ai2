const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];
let searchQuery = "";

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
    result.innerHTML = `<p style="color:red">${err.message}</p>`;
  }

  button.disabled = false;
  button.innerText = "Generate 🚀";
});

function renderHistory() {
  if (!historyBox) return;

  historyBox.innerHTML = "";

  /* 🔍 SEARCH BOX */
  const searchInput = document.createElement("input");
  searchInput.placeholder = "🔍 Search history...";
  searchInput.value = searchQuery;

  searchInput.style.width = "100%";
  searchInput.style.padding = "10px";
  searchInput.style.marginBottom = "10px";
  searchInput.style.borderRadius = "8px";
  searchInput.style.border = "none";
  searchInput.style.outline = "none";

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderHistory();
  });

  historyBox.appendChild(searchInput);

  /* FILTER DATA */
  const filtered = history.filter(item =>
    item.prompt.toLowerCase().includes(searchQuery) ||
    item.type.toLowerCase().includes(searchQuery)
  );

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.style.padding = "10px";
    empty.style.opacity = "0.7";
    empty.innerText = "No results found";
    historyBox.appendChild(empty);
    return;
  }

  filtered.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "history-item";

    div.innerHTML = `
      <strong>${item.type}</strong><br>
      ${item.prompt}

      <div class="history-actions">
        <div class="history-icon" data-action="replay" data-index="${index}">🔄</div>
        <div class="history-icon" data-action="copy" data-index="${index}">📋</div>
        <div class="history-icon" data-action="delete" data-index="${index}">🗑️</div>
      </div>
    `;

    div.addEventListener("click", (e) => {
      if (e.target.classList.contains("history-icon")) return;

      textarea.value = item.prompt;
      setToolType(item.type);
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      textarea.focus();
    });

    historyBox.appendChild(div);
  });

  document.querySelectorAll(".history-icon").forEach(icon => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();

      const index = icon.dataset.index;
      const action = icon.dataset.action;
      const item = filtered[index];

      if (!item) return;

      if (action === "replay") {
        textarea.value = item.prompt;
        setToolType(item.type);
        textarea.scrollIntoView({ behavior: "smooth" });
        textarea.focus();
      }

      if (action === "copy") {
        navigator.clipboard.writeText(item.prompt);
        alert("Prompt copied ✅");
      }

      if (action === "delete") {
        const realIndex = history.findIndex(h =>
          h.prompt === item.prompt && h.type === item.type
        );

        if (realIndex !== -1) {
          history.splice(realIndex, 1);
        }

        localStorage.setItem("clipHistory", JSON.stringify(history));
        renderHistory();
      }
    });
  });
}

setToolType(selectedType);
renderHistory();

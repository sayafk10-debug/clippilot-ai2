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

    // ===== HISTORY: result aur date bhi save hota hai =====
    history.unshift({
      type: selectedType,
      prompt: topic,
      result: aiResponse,
      date: new Date().toISOString()
    });

    history = history.slice(0, 30);
    localStorage.setItem("clipHistory", JSON.stringify(history));
    renderHistory();

  } catch (err) {
    result.innerHTML = `<p style="color:red">${err.message}</p>`;
  }

  button.disabled = false;
  button.innerText = "Generate 🚀";
});

// ===== "Today / Yesterday / X days ago" banane wala function =====
function timeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function renderHistory() {
  if (!historyBox) return;

  historyBox.innerHTML = "";

  /* 🔍 SEARCH BOX */
  const searchInput = document.createElement("input");
  searchInput.placeholder = "🔍 Search history...";
  searchInput.value = searchQuery;
  searchInput.className = "history-search-input";

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderHistory();
  });

  historyBox.appendChild(searchInput);

  /* 🧹 CLEAR ALL BUTTON */
  if (history.length > 0) {
    const clearAllBtn = document.createElement("button");
    clearAllBtn.innerText = "🧹 Clear All History";
    clearAllBtn.className = "history-clear-all-btn";

    clearAllBtn.addEventListener("click", () => {
      const confirmClear = confirm("Sab history delete karni hai?");
      if (!confirmClear) return;

      history = [];
      localStorage.setItem("clipHistory", JSON.stringify(history));
      renderHistory();
    });

    historyBox.appendChild(clearAllBtn);
  }

  /* FILTER DATA */
  const filtered = history.filter(item =>
    item.prompt.toLowerCase().includes(searchQuery) ||
    item.type.toLowerCase().includes(searchQuery)
  );

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerText = "No results found";
    historyBox.appendChild(empty);
    return;
  }

  filtered.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "history-item";

    // ===== RESULT PREVIEW (80 characters) =====
    const preview = item.result
      ? (item.result.length > 80 ? item.result.substring(0, 80) + "..." : item.result)
      : "";

    div.innerHTML = `
      <strong>${item.type}</strong>
      <span class="history-time">${timeAgo(item.date)}</span>
      <br>
      <span class="history-prompt">${item.prompt}</span>
      ${preview ? `<div class="history-preview">${preview}</div>` : ""}

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
        // ===== Result copy hota hai (agar hai), warna prompt =====
        const textToCopy = item.result || item.prompt;
        navigator.clipboard.writeText(textToCopy);

        // ===== Better UX: icon temporarily ✅ ho jayega, alert nahi =====
        const originalIcon = icon.textContent;
        icon.textContent = "✅";
        icon.classList.add("history-icon-success");

        setTimeout(() => {
          icon.textContent = originalIcon;
          icon.classList.remove("history-icon-success");
        }, 1500);
      }

      if (action === "delete") {
        const realIndex = history.findIndex(h =>
          h.prompt === item.prompt && h.type === item.type && h.date === item.date
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

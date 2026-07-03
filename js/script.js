const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = loadHistory();
let searchQuery = "";
let searchDebounceTimer = null;

// Persistent UI elements (created once, prevents losing search focus / duplicate listeners)
let searchInputEl = null;
let clearAllBtnEl = null;
let listContainerEl = null;

// ===== SAFE LOCALSTORAGE LOAD =====
function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem("clipHistory"));
    if (!Array.isArray(raw)) return [];
    // Filter out corrupted/invalid entries and backfill missing ids
    return raw
      .filter(item => item && typeof item.prompt === "string" && typeof item.type === "string")
      .map(item => ({
        id: item.id || generateId(),
        type: item.type,
        prompt: item.prompt,
        result: typeof item.result === "string" ? item.result : "",
        date: item.date || new Date().toISOString()
      }));
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem("clipHistory", JSON.stringify(history));
  } catch {
    // localStorage full or unavailable - fail silently, app still works in-memory
  }
}

function generateId() {
  return (crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ===== XSS-SAFE ESCAPE =====
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

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
      <h3>🔥 Result (${escapeHTML(selectedType)})</h3>
      <pre id="typed"></pre>
      <button id="copyBtn">Copy</button>
    `;

    typeText(document.getElementById("typed"), aiResponse);

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied ✅");
    };

    // ===== Save to history (newest first, unique id) =====
    history.unshift({
      id: generateId(),
      type: selectedType,
      prompt: topic,
      result: aiResponse,
      date: new Date().toISOString()
    });

    history = history.slice(0, 30);
    saveHistory();
    renderHistoryList();

  } catch (err) {
    result.innerHTML = `<p style="color:red">${escapeHTML(err.message)}</p>`;
  }

  button.disabled = false;
  button.innerText = "Generate 🚀";
});

// ===== Non-blocking typing animation =====
function typeText(el, text) {
  el.textContent = "";
  let i = 0;
  (function step() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(step, 8);
    }
  })();
}

// ===== "Today / Yesterday / X days ago" =====
function timeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

// ===== Build search bar + clear button + list container ONCE =====
function initHistoryUI() {
  if (!historyBox || searchInputEl) return;

  historyBox.innerHTML = "";

  searchInputEl = document.createElement("input");
  searchInputEl.placeholder = "🔍 Search history...";
  searchInputEl.className = "history-search-input";
  searchInputEl.addEventListener("input", (e) => {
    const value = e.target.value;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      searchQuery = value.toLowerCase();
      renderHistoryList();
    }, 150);
  });
  historyBox.appendChild(searchInputEl);

  clearAllBtnEl = document.createElement("button");
  clearAllBtnEl.innerText = "🧹 Clear All History";
  clearAllBtnEl.className = "history-clear-all-btn";
  clearAllBtnEl.addEventListener("click", () => {
    if (!confirm("Sab history delete karni hai?")) return;
    history = [];
    saveHistory();
    renderHistoryList();
  });
  historyBox.appendChild(clearAllBtnEl);

  listContainerEl = document.createElement("div");
  listContainerEl.className = "history-list-container";
  historyBox.appendChild(listContainerEl);

  // ===== Event delegation: one listener handles all items/icons, no duplicates =====
  listContainerEl.addEventListener("click", (e) => {
    const iconEl = e.target.closest(".history-icon");
    const itemEl = e.target.closest(".history-item");

    if (iconEl) {
      handleHistoryAction(iconEl.dataset.action, iconEl.dataset.id, iconEl);
      return;
    }

    if (itemEl) {
      applyHistoryItem(itemEl.dataset.id);
    }
  });
}

function applyHistoryItem(id) {
  const item = history.find(h => h.id === id);
  if (!item) return;
  textarea.value = item.prompt;
  setToolType(item.type);
  textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  textarea.focus();
}

function handleHistoryAction(action, id, iconEl) {
  const item = history.find(h => h.id === id);
  if (!item) return;

  if (action === "replay") {
    applyHistoryItem(id);
  }

  if (action === "copy") {
    const textToCopy = item.result || item.prompt;
    navigator.clipboard.writeText(textToCopy);

    const originalIcon = iconEl.textContent;
    iconEl.textContent = "✅";
    iconEl.classList.add("history-icon-success");
    setTimeout(() => {
      iconEl.textContent = originalIcon;
      iconEl.classList.remove("history-icon-success");
    }, 1500);
  }

  if (action === "delete") {
    history = history.filter(h => h.id !== id);
    saveHistory();
    renderHistoryList();
  }
}

// ===== Re-render ONLY the list (search bar/clear button stay intact) =====
function renderHistoryList() {
  if (!historyBox) return;
  if (!listContainerEl) initHistoryUI();

  clearAllBtnEl.style.display = history.length > 0 ? "block" : "none";

  const filtered = searchQuery
    ? history.filter(item =>
        item.prompt.toLowerCase().includes(searchQuery) ||
        item.type.toLowerCase().includes(searchQuery)
      )
    : history; // history is always newest-first (unshift on add)

  if (filtered.length === 0) {
    listContainerEl.innerHTML = `<div class="history-empty">No results found</div>`;
    return;
  }

  listContainerEl.innerHTML = filtered.map(item => {
    const preview = item.result
      ? (item.result.length > 80 ? item.result.substring(0, 80) + "..." : item.result)
      : "";

    return `
      <div class="history-item" data-id="${item.id}">
        <strong>${escapeHTML(item.type)}</strong>
        <span class="history-time">${timeAgo(item.date)}</span>
        <br>
        <span class="history-prompt">${escapeHTML(item.prompt)}</span>
        ${preview ? `<div class="history-preview">${escapeHTML(preview)}</div>` : ""}
        <div class="history-actions">
          <div class="history-icon" data-action="replay" data-id="${item.id}">🔄</div>
          <div class="history-icon" data-action="copy" data-id="${item.id}">📋</div>
          <div class="history-icon" data-action="delete" data-id="${item.id}">🗑️</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  initHistoryUI();
  renderHistoryList();
}

setToolType(selectedType);
renderHistory();
Script J's chk kro

const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = loadHistory();
let searchQuery = "";
let searchDebounceTimer = null;
let isRequesting = false;

let searchInputEl = null;
let clearAllBtnEl = null;
let listContainerEl = null;

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem("clipHistory"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(item => item && typeof item.prompt === "string" && typeof item.type === "string")
      .map(item => ({
        id: item.id || generateId(),
        type: item.type,
        prompt: item.prompt,
        result: typeof item.result === "string" ? item.result : "",
        date: item.date || new Date().toISOString()
      }));
  } catch (e) {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem("clipHistory", JSON.stringify(history));
  } catch (e) {}
}

function generateId() {
  try {
    if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
  } catch (e) {}
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

window.setToolType = function(type) {
  selectedType = type;
  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
};

function attachFeedbackWidget(toolType) {
  const upBtn = document.getElementById("fbUp");
  const downBtn = document.getElementById("fbDown");
  const fbRow = document.getElementById("fbRow");
  if (!upBtn || !downBtn || !fbRow) return;

  function sendFeedback(value) {
    try {
      if (typeof gtag === "function") {
        gtag('event', 'feedback_given', {
          'tool_type': toolType,
          'feedback_value': value
        });
      }
    } catch (e) {}

    fbRow.innerHTML = `<span class="feedback-thanks">Thanks for the feedback! 🙌</span>`;
  }

  upBtn.addEventListener("click", () => sendFeedback("up"));
  downBtn.addEventListener("click", () => sendFeedback("down"));
}

button.addEventListener("click", async () => {
  if (isRequesting) return;

  const topic = textarea.value.trim();
  if (!topic) {
    result.innerHTML = '<p style="color:#ffb020;">⚠️ Please enter a topic before generating.</p>';
    textarea.focus();
    return;
  }

  isRequesting = true;
  button.disabled = true;
  button.innerHTML = "Generating...";

  result.innerHTML = `
    <div class="loading-card">
      <div class="loader"></div>
      <p>Generating AI content...</p>
    </div>
  `;

  try {
    const aiResponse = await generateScript(topic, selectedType);

    if (!aiResponse || !aiResponse.trim()) {
      throw new Error("AI returned an empty response.");
    }

    try {
      if (typeof gtag === "function") {
        gtag('event', 'generate_click', {
          'tool_type': selectedType
        });
      }
    } catch (e) {}

    result.innerHTML = `
      <h2>🔥 Result (${escapeHTML(selectedType)})</h2>
      <pre id="typed"></pre>
      <button id="copyBtn">Copy</button>
      <div class="feedback-row" id="fbRow">
        <span>Was this helpful?</span>
        <button id="fbUp" class="feedback-btn" type="button">👍</button>
        <button id="fbDown" class="feedback-btn" type="button">👎</button>
      </div>
    `;

    requestAnimationFrame(() => {
      typeText(document.getElementById("typed"), aiResponse);
    });

    attachFeedbackWidget(selectedType);

    const copyBtn = document.getElementById("copyBtn");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(aiResponse);
      } catch {
        const originalPrompt = textarea.value;
        textarea.value = aiResponse;
        textarea.select();
        document.execCommand("copy");
        textarea.value = originalPrompt;
      }
      copyBtn.innerText = "✅ Copied";
      setTimeout(() => {
        copyBtn.innerText = "Copy";
      }, 1500);
    };

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

    result.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    textarea.value = "";

  } catch (e) {
    result.innerHTML = `
      <div class="error-message">
        ❌ ${escapeHTML(e.message || "Something went wrong")}
      </div>
    `;
  } finally {
    isRequesting = false;
    button.disabled = false;
    button.innerHTML = "Generate 🚀";
  }
});

let typingTimer = null;

function typeText(el, text) {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }

  el.textContent = "";
  let i = 0;

  function step() {
    if (i < text.length) {
      el.textContent += text.charAt(i++);
      typingTimer = setTimeout(step, 6);
    } else {
      typingTimer = null;
    }
  }

  step();
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

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
    if (history.length === 0) return;

    if (!confirm("Delete all history permanently?")) return;
    history = [];
    saveHistory();
    renderHistoryList();
  });
  historyBox.appendChild(clearAllBtnEl);

  listContainerEl = document.createElement("div");
  listContainerEl.className = "history-list-container";
  historyBox.appendChild(listContainerEl);

  listContainerEl.addEventListener("click", (e) => {
    const iconEl = e.target.closest(".history-icon");
    const itemEl = e.target.closest(".history-item");

    if (iconEl) {
      e.stopPropagation();
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

  if (item.result) {
    result.innerHTML = `
      <h2>🔥 Result (${escapeHTML(item.type)})</h2>
      <pre id="typed">${escapeHTML(item.result)}</pre>
      <button id="copyBtn">Copy</button>
    `;

    const copyBtn = document.getElementById("copyBtn");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(item.result);
      } catch {
        const originalPrompt = textarea.value;
        textarea.value = item.result;
        textarea.select();
        document.execCommand("copy");
        textarea.value = originalPrompt;
      }
      copyBtn.innerText = "✅ Copied";
      setTimeout(() => {
        copyBtn.innerText = "Copy";
      }, 1500);
    };

    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.focus();
  }
}

function handleHistoryAction(action, id, iconEl) {
  const item = history.find(h => h.id === id);
  if (!item) return;

  if (action === "replay") {
    applyHistoryItem(id);
  }

  if (action === "copy") {
    const textToCopy = item.result || item.prompt;
    (async () => {
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch {
        textarea.value = textToCopy;
        textarea.select();
        document.execCommand("copy");
      }
    })();

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

function renderHistoryList() {
  if (!historyBox) return;
  if (!listContainerEl) initHistoryUI();

  clearAllBtnEl.style.display = history.length > 0 ? "block" : "none";

  const filtered = searchQuery
    ? history.filter(item =>
        item.prompt.toLowerCase().includes(searchQuery) ||
        item.type.toLowerCase().includes(searchQuery)
      )
    : history;

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

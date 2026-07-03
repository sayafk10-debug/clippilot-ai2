const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");
const historyBox = document.getElementById("historyList");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

/* TOOL MAP */
const tools = {
  ideas: "💡 Ideas",
  script: "🎬 Script",
  hook: "🔥 Hook",
  caption: "📝 Caption",
  hashtags: "# Hashtags"
};

/* SET ACTIVE TOOL (SAFE) */
function setActiveTool(type) {
  selectedType = type;

  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.remove("active");

    if (btn.innerText === tools[type]) {
      btn.classList.add("active");
    }
  });
}

/* TOOL BUTTON CLICK (HTML onclick use karega) */
window.setToolType = function(type) {
  setActiveTool(type);
};

/* GENERATE */
button.addEventListener("click", async () => {

  const topic = textarea.value.trim();
  if (!topic) {
    alert("Please enter your niche");
    return;
  }

  button.innerText = "Generating...";
  button.disabled = true;

  result.style.display = "block";
  result.innerHTML = '<div class="loader"></div>';

  try {

    const aiResponse = await generateScript(topic, selectedType);

    result.style.opacity = "0";

    result.innerHTML = `
      <h3>🔥 AI Result (${selectedType})</h3>
      <pre id="typedText"></pre>
      <button id="copyBtn">📋 Copy</button>
    `;

    setTimeout(() => {

      const el = document.getElementById("typedText");
      el.innerHTML = "";

      let i = 0;

      function typeWriter() {
        if (i < aiResponse.length) {
          el.innerHTML += aiResponse.charAt(i);
          i++;
          setTimeout(typeWriter, 10);
        }
      }

      typeWriter();

      document.getElementById("copyBtn").onclick = () => {
        navigator.clipboard.writeText(aiResponse);
        alert("Copied ✅");
      };

      /* SAVE HISTORY */
      history.unshift({
        type: selectedType,
        prompt: topic,
        result: aiResponse
      });

      localStorage.setItem(
        "clipHistory",
        JSON.stringify(history.slice(0, 10))
      );

      renderHistory();

      result.style.opacity = "1";

    }, 100);

  } catch (err) {
    result.innerHTML = `
      <p style="color:red;">❌ ${err.message}</p>
    `;
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

    div.innerHTML = `
      <b>${item.type}</b><br>
      <small>${item.prompt}</small>
    `;

    div.onclick = () => {
      textarea.value = item.prompt;
      setActiveTool(item.type);
    };

    historyBox.appendChild(div);
  });
}

/* INIT */
setActiveTool(selectedType);
renderHistory();

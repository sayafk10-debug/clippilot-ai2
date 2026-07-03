const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

let selectedType = "ideas";
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

/* TOOL SWITCH */
window.setToolType = function (type, fromHistory = false, el = null) {
  selectedType = type;

  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.remove("active");
  });

  // highlight only if clicked from UI button
  if (el) {
    el.classList.add("active");
  }
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
          setTimeout(typeWriter, 8);
        }
      }

      typeWriter();

      document.getElementById("copyBtn").onclick = () => {
        navigator.clipboard.writeText(aiResponse);
        alert("Copied ✅");
      };

      // SAVE HISTORY
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

/* HISTORY */
function renderHistory() {
  const box = document.getElementById("historyList");
  if (!box) return;

  box.innerHTML = "";

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";

    div.innerHTML = `
      <b>${item.type}</b><br>
      <small>${item.prompt}</small>
    `;

    div.onclick = () => {
      textarea.value = item.prompt;
      setToolType(item.type, true);
    };

    box.appendChild(div);
  });
}

/* INIT */
renderHistory();

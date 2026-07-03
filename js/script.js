const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

let selectedType = "ideas";

// LOAD HISTORY
let history = JSON.parse(localStorage.getItem("clipHistory")) || [];

// TOOL SWITCH
window.setToolType = function (type) {
  selectedType = type;
  updateActiveButton(type);
};

// ACTIVE BUTTON UI
function updateActiveButton(type) {
  document.querySelectorAll(".tool-buttons button").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(
    `button[onclick="setToolType('${type}')"]`
  );

  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

// GENERATE CLICK
button.addEventListener("click", async () => {
  const topic = textarea.value.trim();

  if (!topic) {
    alert("Please enter your niche.");
    return;
  }

  button.innerHTML = "Generating...";
  button.disabled = true;

  result.style.display = "block";
  result.innerHTML = '<div class="loader"></div><p>AI is generating...</p>';

  try {
    const aiResponse = await generateScript(topic, selectedType);

    result.style.opacity = "0";

    result.innerHTML = `
      <h3>🔥 AI Result (${selectedType})</h3>
      <pre id="typedText"></pre>
      <button id="copyBtn">📋 Copy</button>
    `;

    setTimeout(() => {
      result.style.opacity = "1";

      const el = document.getElementById("typedText");
      el.innerHTML = "";

      let i = 0;

      function typeWriter() {
        if (i < aiResponse.length) {
          el.innerHTML += aiResponse.charAt(i);
          i++;
          setTimeout(typeWriter, 12);
        }
      }

      typeWriter();

      // COPY BUTTON
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

    }, 100);

  } catch (error) {
    result.innerHTML = `
      <p style="color:red;">
        ❌ Error: ${error.message || "Something went wrong"}
      </p>
    `;
  }

  button.innerHTML = "Generate Ideas 🚀";
  button.disabled = false;

  updateActiveButton(selectedType);
});

// DEFAULT ACTIVE
updateActiveButton("ideas");

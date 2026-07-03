const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

let selectedType = "ideas";

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

// MAIN GENERATE
button.addEventListener("click", async () => {
  const topic = textarea.value.trim();

  if (topic === "") {
    alert("Please enter your niche.");
    return;
  }

  button.innerHTML = "Generating...";
  button.disabled = true;

  result.style.display = "block";
  result.innerHTML = "⏳ AI is generating...";

  try {
    const aiResponse = await generateScript(topic, selectedType);

    result.innerHTML = `
      <h3>🔥 AI Result (${selectedType})</h3>
      <pre>${aiResponse}</pre>

      <button id="copyBtn">📋 Copy</button>
    `;

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied ✅");
    };

  } catch (error) {
    result.innerHTML = `
      <p style="color:red;">
        ❌ Failed to generate content.<br>
        ${error.message || "Unknown error"}
      </p>
    `;
  }

  button.innerHTML = "Generate Ideas 🚀";
  button.disabled = false;
});

// DEFAULT ACTIVE BUTTON
updateActiveButton("ideas");

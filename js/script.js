const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

let selectedType = "ideas";

window.setToolType = function (type) {
  selectedType = type;
  updateActiveButton(type);
};

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
      <pre>${aiResponse}</pre>

      <button id="copyBtn">📋 Copy</button>
    `;

    setTimeout(() => {
      result.style.opacity = "1";
    }, 100);

    document.getElementById("copyBtn").onclick = () => {
      navigator.clipboard.writeText(aiResponse);
      alert("Copied ✅");
    };

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

updateActiveButton("ideas");

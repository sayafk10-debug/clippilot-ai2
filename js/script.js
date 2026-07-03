const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

button.addEventListener("click", async () => {
  const topic = textarea.value.trim();

  if (topic === "") {
    alert("Please enter your niche.");
    return;
  }

  button.innerHTML = "Generating...";
  button.disabled = true;

  result.style.display = "block";
  result.innerHTML = "⏳ AI is generating ideas...";

  try {
    // FIX: use correct API function from api.js
    const aiResponse = await generateScript(topic);

    result.innerHTML = `
      <h3>🔥 AI Generated Ideas</h3>
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
        ❌ Failed to generate ideas.<br>
        ${error.message || "Unknown error"}
      </p>
    `;
  }

  button.innerHTML = "Generate Ideas 🚀";
  button.disabled = false;
});

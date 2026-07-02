const button = document.getElementById("generateBtn");
const textarea = document.getElementById("prompt");
const result = document.getElementById("result");

button.addEventListener("click", async () => {

const topic = textarea.value.trim();

if(topic === ""){
alert("Please enter your niche.");
return;
}

button.innerHTML = "Generating...";
button.disabled = true;

result.style.display = "block";
result.innerHTML = "⏳ AI is generating ideas...";

try{

const aiResponse = await generateWithAI(topic);

result.innerHTML = `
<h3>🔥 AI Generated Ideas</h3>
<pre>${aiResponse}</pre>

<button id="copyBtn">📋 Copy</button>
`;

document.getElementById("copyBtn").onclick = () => {

navigator.clipboard.writeText(aiResponse);

alert("Copied ✅");

};

}catch(error){

result.innerHTML = `
<p style="color:red;">
❌ Failed to generate ideas.<br>
Check your API key or internet connection.
</p>
`;

}

button.innerHTML = "Generate Ideas 🚀";
button.disabled = false;

js/script.js

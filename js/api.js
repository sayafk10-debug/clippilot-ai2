
async function generateScript(prompt, type = "ideas") {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      type,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      data.error ||
      "Something went wrong."
    );
  }

  return data.result;
}

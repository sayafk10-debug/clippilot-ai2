async function generateScript(prompt, type = "ideas") {
  // Frontend validation
  if (!prompt || !prompt.trim()) {
    throw new Error("⚠️ Please enter a topic before generating.");
  }

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        type,
      }),
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error("⚠️ Please enter a topic before generating.");

        case 401:
          throw new Error("API authentication failed.");

        case 403:
          throw new Error("Access denied.");

        case 404:
          throw new Error("Service not found.");

        case 408:
          throw new Error("Request timed out. Please try again.");

        case 429:
          throw new Error("Too many requests. Please wait a moment and try again.");

        case 500:
          throw new Error("Server error. Please try again later.");

        case 502:
        case 503:
        case 504:
          throw new Error("AI service is temporarily unavailable. Please try again.");

        default:
          throw new Error(
            data.error?.message ||
            data.error ||
            "Something went wrong."
          );
      }
    }

    if (!data.result || typeof data.result !== "string" || !data.result.trim()) {
      throw new Error("AI returned an empty response. Please try again.");
    }

    return data.result.trim();

  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Network error. Please check your internet connection.");
    }

    throw error;
  }
}

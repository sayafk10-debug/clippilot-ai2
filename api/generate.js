export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, type } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    // 🎯 TOOL-BASED SYSTEM PROMPTS
    let systemPrompt = "";

    switch (type) {
      case "ideas":
        systemPrompt =
          "You are a viral content expert. Generate 10 short, high-engagement viral video ideas. Make them catchy and scroll-stopping.";
        break;

      case "script":
        systemPrompt =
          "You are a professional script writer. Create engaging short-form video scripts with hook, body, and strong ending.";
        break;

      case "hook":
        systemPrompt =
          "You are a viral hook specialist. Generate powerful attention-grabbing hooks for short videos.";
        break;

      case "caption":
        systemPrompt =
          "You are a social media expert. Generate viral captions optimized for engagement.";
        break;

      case "hashtags":
        systemPrompt =
          "You are a hashtag strategist. Generate trending and viral hashtags for social media growth.";
        break;

      default:
        systemPrompt =
          "You are a viral content creator assistant. Help generate engaging content ideas.";
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data,
      });
    }

    const output = data?.choices?.[0]?.message?.content || "No response";

    return res.status(200).json({
      success: true,
      result: output,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}

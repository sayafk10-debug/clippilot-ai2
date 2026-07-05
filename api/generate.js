import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let burstLimit = null;
let dailyLimit = null;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiters
try {
  burstLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "ratelimit:burst",
  });

  dailyLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "86400 s"),
    analytics: true,
    prefix: "ratelimit:daily",
  });
} catch (e) {
  console.error("Rate limiter init failed:", e);
}

// Retry helper
async function fetchWithRetry(fn, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// Models fallback chain
const MODELS = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const isWhitelisted =
      process.env.TESTER_IP && ip === process.env.TESTER_IP;

    // Rate limiting
    if (!isWhitelisted && burstLimit && dailyLimit) {
      try {
        const burst = await burstLimit.limit(ip);
        if (!burst.success) {
          return res.status(429).json({
            error: "Too many requests. Try again in a minute.",
          });
        }

        const daily = await dailyLimit.limit(ip);
        if (!daily.success) {
          return res.status(429).json({
            error: "Daily limit reached. Try tomorrow.",
          });
        }
      } catch (e) {
        console.error("Rate limit failed:", e);
      }
    }

    const { prompt, type = "ideas" } = req.body || {};

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({ error: "Prompt too long." });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfigured." });
    }

    let systemPrompt = "";

    switch (type) {
      case "ideas":
        systemPrompt = `Generate 10 viral content ideas, short and engaging. No explanations.`;
        break;

      case "script":
        systemPrompt = `Write a viral short video script with Hook, Body, CTA.`;
        break;

      case "hook":
        systemPrompt = `Generate 15 viral hooks under 12 words.`;
        break;

      case "caption":
        systemPrompt = `Generate 10 viral captions.`;
        break;

      case "hashtags":
        systemPrompt = `Generate 30 viral hashtags grouped by trend, medium, niche.`;
        break;

      default:
        systemPrompt = `Provide high quality response.`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let lastError = null;
    let output = null;

    try {
      for (const model of MODELS) {
        try {
          const response = await fetchWithRetry(() =>
            fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                temperature: 0.8,
                max_tokens: 900,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: prompt.trim() },
                ],
              }),
            })
          );

          const data = await response.json();

          if (!response.ok) {
            lastError = data;
            continue; // try next model
          }

          output = data?.choices?.[0]?.message?.content?.trim();
          if (output) break;
        } catch (err) {
          lastError = err;
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!output) {
      return res.status(500).json({
        error:
          lastError?.error?.message ||
          "AI service temporarily unavailable. Try again.",
      });
    }

    return res.status(200).json({
      success: true,
      result: output,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      return res.status(408).json({
        error: "Request timed out. Try again.",
      });
    }

    return res.status(500).json({
      error: e.message || "Internal server error",
    });
  }
}

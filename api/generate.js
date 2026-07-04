import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let burstLimit = null;
let dailyLimit = null;

try {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

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
} catch (initErr) {
  console.error("Rate limiter init failed:", initErr);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }
  try {
    // ===== Rate limiting (IP-based) - fails open if Redis has issues =====
    if (burstLimit && dailyLimit) {
      try {
        const ip =
          req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "unknown";

        const burstCheck = await burstLimit.limit(ip);

        if (!burstCheck.success) {
          return res.status(429).json({
            error: "Too many requests. Please wait a minute and try again."
          });
        }

        const dailyCheck = await dailyLimit.limit(ip);
        if (!dailyCheck.success) {
          return res.status(429).json({
            error: "Daily limit reached. Please try again tomorrow."
          });
        }
      } catch (rlErr) {
        console.error("Rate limit check failed (allowing request):", rlErr);
      }
    }

    const { prompt, type = "ideas" } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Prompt is required."
      });
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY missing");
      return res.status(500).json({
        error: "Server configuration error."
      });
    }
    let systemPrompt = "";
    switch (type) {
      case "ideas":
        systemPrompt =
          "You are a viral content expert. Generate 10 short, highly engaging viral content ideas.";
        break;
      case "script":
        systemPrompt =
          "You are a professional short-form script writer. Create an engaging script with Hook, Body and CTA.";
        break;
      case "hook":
        systemPrompt =
          "Generate powerful scroll-stopping hooks.";
        break;
      case "caption":
        systemPrompt =
          "Generate high-converting social media captions.";
        break;
      case "hashtags":
        systemPrompt =
          "Generate relevant trending hashtags.";
        break;
      default:
        systemPrompt =
          "You are an AI content creation assistant.";
    }
    // ===== 20s timeout =====
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: prompt.trim()
            }
          ]
        })
      }
    );
    clearTimeout(timeout);
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenRouter Error:", data);
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "OpenRouter request failed."
      });
    }
    const output = data?.choices?.[0]?.message?.content?.trim();
    if (!output) {
      return res.status(500).json({
        error: "AI returned an empty response."
      });
    }
    return res.status(200).json({
      success: true,
      result: output
    });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(408).json({
        error: "Request timed out. Please try again."
      });
    }
    console.error(err);
    return res.status(500).json({
      error: err.message || "Internal server error."
    });
  }
}

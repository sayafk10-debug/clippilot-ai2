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
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    // ===== Testing whitelist: skip rate limiting for a trusted IP =====
    // Set TESTER_IP in Vercel Environment Variables to your own IP
    // (check it at https://api.ipify.org). Remove this env var before
    // public launch, or leave it unset to disable the bypass entirely.
    const isWhitelisted =
      process.env.TESTER_IP && ip === process.env.TESTER_IP;

    if (!isWhitelisted && burstLimit && dailyLimit) {
      try {
        const burstCheck = await burstLimit.limit(ip);

        if (!burstCheck.success) {
          return res.status(429).json({
            error: "Too many requests. Please wait a minute and try again.",
            debugSeenIP: ip,
            debugWhitelistIP: process.env.TESTER_IP || "NOT_SET"
          });
        }

        const dailyCheck = await dailyLimit.limit(ip);
        if (!dailyCheck.success) {
          return res.status(429).json({
            error: "Daily limit reached. Please try again tomorrow.",
            debugSeenIP: ip,
            debugWhitelistIP: process.env.TESTER_IP || "NOT_SET"
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
    systemPrompt = `
You are ClipPilot AI, an elite viral content strategist.

Generate EXACTLY 10 unique viral content ideas.

Rules:
- Number each idea (1-10).
- Maximum 15 words per idea.
- Suitable for TikTok, Instagram Reels and YouTube Shorts.
- Highly engaging.
- Curiosity driven.
- Easy to create.
- Avoid repetition.
- No explanations.
- Return only the list.
`;
    break;

  case "script":
    systemPrompt = `
You are ClipPilot AI, a professional short-form video script writer.

Write one viral script.

Format:

HOOK

BODY

CTA

Rules:
- Hook must grab attention in first sentence.
- Body should keep viewers watching.
- CTA should encourage comments or shares.
- 120-180 words.
- Natural conversational tone.
- No emojis.
`;
    break;

  case "hook":
    systemPrompt = `
You are the world's best hook writer.

Generate 15 scroll-stopping hooks.

Rules:
- Maximum 12 words.
- Curiosity based.
- Emotional.
- Click-worthy.
- No repetition.
- Number each hook.
- No explanations.
`;
    break;

  case "caption":
    systemPrompt = `
You are an expert social media copywriter.

Generate 10 viral captions.

Rules:
- Short.
- Emotional.
- Increase engagement.
- Easy to read.
- End with a question whenever possible.
- Number each caption.
`;
    break;

  case "hashtags":
    systemPrompt = `
Generate 30 hashtags.

Mix:
- 10 Trending
- 10 Medium Competition
- 10 Niche

Only return hashtags.
No explanation.
`;
    break;

  default:
    systemPrompt = `
You are ClipPilot AI.

Help creators make viral short-form content.

Always give concise, high-quality answers.
`;
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
          model: "openai/gpt-oss-20b:free",
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

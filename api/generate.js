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

// ===== CONTENT MODERATION =====
// Basic keyword/pattern filter to block obviously harmful prompts
// before they are ever sent to the AI provider.
const BLOCKED_PATTERNS = [
  // Violence & weapons
  /\bhow\s+to\s+(make|build|create)\s+(a\s+)?(bomb|explosive|weapon|gun|firearm)\b/i,
  /\b(kill|murder|assassinate)\s+(someone|a\s+person|him|her|them)\b/i,

  // Hate speech / extremism
  /\b(ethnic\s+cleansing|genocide|nazi\s+propaganda|terrorist\s+attack\s+plan)\b/i,

  // Self-harm
  /\bhow\s+to\s+(commit|attempt)\s+suicide\b/i,
  /\bself[-\s]?harm\s+(method|instructions|technique)\b/i,

  // Child exploitation
  /\bchild\s+(porn|sexual\s+abuse|abuse\s+material)\b/i,
  /\bunderage\s+(sex|nude|explicit)\b/i,

  // Illegal drug synthesis
  /\bhow\s+to\s+(make|synthesize|cook)\s+(meth|methamphetamine|cocaine|heroin|fentanyl)\b/i,

  // Fraud / scams
  /\bhow\s+to\s+(scam|defraud|phish)\s+(people|users|someone|victims)\b/i,

  // Credit card fraud
  /\bcredit\s+card\s+(fraud|generator|dump)\b/i,

  // Hacking / malware / cybercrime
  // Note: narrowed to security-related targets so it doesn't block
  // legitimate marketing terms like "growth hacking" or "life hacks"
  /\bhow\s+to\s+(hack|crack|bypass)\s+(a|an|the)?\s*(account|password|system|network|website|server|login|wifi|device|security|firewall)\b/i,
  /\b(create|write|build)\s+(a\s+)?(malware|ransomware|virus|keylogger|trojan)\b/i,
  /\bsteal\s+(passwords?|credentials?|accounts?|credit\s+card\s+(numbers?|info))\b/i,
];

function containsHarmfulContent(text) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

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

    // Content moderation check (runs before any AI call)
    if (containsHarmfulContent(prompt)) {
      return res.status(400).json({
        error:
          "This request violates our content policy. Please try a different topic.",
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfigured." });
    }

    // ===== LANGUAGE MATCHING INSTRUCTION =====
    // Ensures the model replies in the SAME language/script the user typed in
    // (e.g. Roman Urdu stays Roman Urdu, English stays English), instead of
    // randomly mixing languages or switching to Hindi/Devanagari script.
    const languageInstruction = `IMPORTANT LANGUAGE RULE: Detect the language and script the user's prompt is written in, and reply ONLY in that same language and script.
- If the user writes in Roman Urdu (Urdu words spelled using English/Latin letters, e.g. "TikTok k liye ideas do"), you MUST reply in Roman Urdu using Latin letters only. Do NOT use Hindi/Devanagari script (e.g. देवनागरी) under any circumstances, even if some words sound similar.
- If the user writes in English, reply in English only.
- If the user writes in Urdu script (اردو), reply in Urdu script.
- Never mix multiple languages or scripts in a single response.
- Never switch scripts mid-response.
`;

    let taskPrompt = "";

    switch (type) {
      case "ideas":
        taskPrompt = `Generate 10 viral content ideas, short and engaging. No explanations.`;
        break;

      case "script":
        taskPrompt = `Write a viral short video script with Hook, Body, CTA.`;
        break;

      case "hook":
        taskPrompt = `Generate 15 viral hooks under 12 words.`;
        break;

      case "caption":
        taskPrompt = `Generate 10 viral captions.`;
        break;

      case "hashtags":
        taskPrompt = `Generate 30 viral hashtags grouped by trend, medium, niche.`;
        break;

      default:
        taskPrompt = `Provide high quality response.`;
    }

    const systemPrompt = `${languageInstruction}\n${taskPrompt}`;

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

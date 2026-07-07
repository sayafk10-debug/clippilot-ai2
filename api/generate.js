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
    // Includes a concrete few-shot example because small free models tend to
    // ignore generic rules but reliably copy a demonstrated output pattern.
    const languageInstruction = `LANGUAGE RULE (follow this exactly, it overrides everything else):
Look at the user's message below and identify what language/script it is written in. Your ENTIRE reply must be written in that exact same language and script. This is the single most important rule in this conversation.

- Roman Urdu = Urdu language written with English/Latin alphabet (example: "TikTok k liye ideas do", "kaise banaye", "acha hai"). If the user's message is Roman Urdu, your reply MUST be Roman Urdu, written with Latin letters. Do NOT translate to English. Do NOT use Hindi/Devanagari script (देवनागरी). Do NOT use Urdu script (اردو).
- Plain English = reply in plain English only.
- Devanagari Hindi script = reply in Devanagari Hindi script.
- Urdu script (اردو) = reply in Urdu script.
- Never mix languages or scripts within one response.

EXAMPLE (this is exactly the style you must match when input is Roman Urdu):
User message: "TikTok videos k liye ideas do"
Correct reply style (Roman Urdu, Latin letters, NOT English, NOT Hindi):
"1. Apne daily routine ka time-lapse banao\n2. Ek trending audio pe quick dance karo\n3. Before-after transformation dikhao\n..."

WRONG reply style for that same input (do NOT do this): replying in English like "1. Quick 30-second dance mashup..." — this is incorrect because the user wrote in Roman Urdu, not English.

Now check the user's actual message below and match its language/script exactly.`;

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
                  {
                    role: "user",
                    content: `${prompt.trim()}\n\n(Reminder: reply in the exact same language and script as this message above. If this message is in Roman Urdu, your reply must be in Roman Urdu with Latin letters, NOT English, NOT Hindi/Devanagari.)`,
                  },
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

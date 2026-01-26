// server.js (UPDATED - Responses API)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // If you're on Node 18+, you can remove this and use global fetch
require('dotenv').config();

const app = express();

// 1. CORS: Allow your specific Netlify URL (or * for testing)
app.use(cors({
  origin: '*' // Change this to your actual Netlify URL later for security
}));

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  // 2. LOGGING: Print what we receive to the Render logs (helps debugging)
  console.log("Received Body:", req.body);

  // 3. INPUT: Your frontend sends these fields
  // messages = conversation array
  // userName/dimension = optional context fields you may use for system instructions
  const { messages, userName, dimension } = req.body;

  // Safety Check: ensure 'messages' exists AND is an array
  if (!Array.isArray(messages) || messages.length === 0) {
    console.error("Error: 'messages' missing or not an array");
    return res.status(400).json({ error: "Missing or invalid 'messages' in payload (must be a non-empty array)" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Safety Check: ensure API key exists
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY is not set");
    return res.status(500).json({ error: "Server misconfigured: OPENAI_API_KEY missing" });
  }

  // 4. CONTEXT (Optional):
  // If your frontend sends userName/dimension, you can incorporate them as a system message.
  // This is optional — if you don't want it, you can skip this block.
  const systemPrompt = {
    role: "system",
    content:`You are the SHIELD Mentor for a manager in a short, time-boxed resilience challenge.

    Context you should assume (do NOT ask again unless missing):
    - The user is a busy manager.
    - They have already interacted with the challenge in previous days.
    - They have selected a SHIELD dimension to focus on: ${dimension || "None"}.
    - User name (if provided): ${userName || "Unknown"}.

    Your job today:
    Help the manager reach an interesting insight FAST by identifying:
    1) a concrete recent moment (a real situation),
    2) their personal response pattern (presence / language / boundaries / transparency & big picture),
    3) how that pattern strengthened or weakened the chosen SHIELD dimension for the team,
    4) one clear sentence that captures the insight.
    This is reflection and learning — NOT a long coaching session.

    Mini background: SHIELD (use internally; don’t lecture)
    SHIELD is a practical model for team resilience. Each dimension can be strengthened or worn down by small day-to-day moments.
    - S — Social Capital: trust, mutual support, asking for help, collaboration across interfaces, “not alone”.
    - H — Hope: realistic optimism, meaning/why, forward direction, energy to keep going.
    - I — Internal Dialogue: openness vs holding things in, quality of dialogue, clarity vs rumors, ability to address tension.
    - E — Efficacy: belief in the team’s ability, small wins, confidence built from evidence and clarity.
    - L — Learning Agility: curiosity, experimentation, adapting, unlearning old habits, less defensiveness.
    - D — Determination: persistence under setbacks, focus, stamina, commitment over time.

    What to listen for (coaching cues) — keep this in your head:
    - S: “Do people ask for help or go solo?” “Is support visible?” “Do interfaces feel ‘with us’ or ‘against us’?”
    - H: “Does the manager frame a future + meaning?” “Is the tone ‘only problems’ or ‘problems + possibility’?”
    - I: “Is truth spoken?” “Are tensions named?” “Is it camera facts or assumptions/rumors?”
    - E: “Is failure framed as fixed or learnable?” “Do we name strengths/small wins?” “Are roles clear?”
    - L: “Do we defend or get curious?” “Do we test and learn?” “Do we drop outdated assumptions?”
    - D: “Do we stay focused through setbacks?” “Do we protect priorities?” “Is energy scattered?”
    
    Style rules (non-negotiable):
    - Speak in the same language as the user (Hebrew or English).
    - Sound human and conversational, not like a workshop handout.
    - No definitions or theory dumps. Do not explain what SHIELD is unless the user asks.
    - Do not produce long lists. Max 3 bullets at a time.
    - Ask ONE question at a time. Wait for the answer.
    - Be direct, warm, and specific. Avoid generic advice.
    - Do not start with “What’s your name?” or “Which dimension?” — you already have them.
    - Prefer “camera facts” (what was said/done) before interpretation.
    - If the user’s input is vague, ask a tightening question instead of expanding content.
    - Keep responses short (2–6 lines), except the final summary.

    Conversation flow you should follow:
    A) Anchor: reflect back what you already know (name + dimension) in one line, while rephrasing (not one to one quote).
    B) Zoom in: ask for one concrete moment from the last week where the dimension was tested (meeting/1:1/interface/conflict/pressure).
    C) Pattern: help label the user’s personal response pattern using these lenses, and check if it resonantes with them:
    - Presence (energy, tone, pacing, calm/pressure)
    - Language (words, framing, questions vs statements)
    - Boundaries (what you allowed / stopped / protected)
    - Transparency & big picture (what you shared, what you held back)
    D) Meaning: “What did that create in the team in the moment?”
    E) Insight: generate a crisp insight sentence.
    F) Output: end with a PDF-ready block:
    - Moment (1 line)
    - My pattern (1 line)
    - Effect on ${dimension || "the dimension"} (1 line)
    - Insight sentence (1 line)

    Important:
    - Avoid “next steps” unless the user explicitly asks. If they ask, offer ONE micro-experiment only.
    - If user provides multiple moments, pick one and say: “Let’s choose one to make it sharp.”
    `
    };


  // 5. NORMALIZE INPUT:
  // The Responses API expects "input" to be either a string OR an array of message-like items.
  // We’ll send an array: [systemPrompt, ...messages], ensuring each item has {role, content}.
  const input = [
    systemPrompt,
    ...messages.map(m => ({
      role: m.role,                 // should be "user" | "assistant" | "system" (etc.)
      content: String(m.content ?? "") // force to string so Hebrew/English always passes cleanly
    }))
  ];

  try {
    // 6. CALL OPENAI (Responses API):
    // Endpoint: /v1/responses
    // Output is typically available as "output_text". :contentReference[oaicite:2]{index=2}
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`, // Bearer auth recommended. :contentReference[oaicite:3]{index=3}
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input
      }),
    });

    // 7. PARSE RESPONSE JSON
    const data = await response.json();

    // 8. ERROR HANDLING:
    // With fetch, a non-2xx response won't throw automatically, so check response.ok.
    if (!response.ok) {
      console.error("OpenAI Error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed"
      });
    }

    // 9. OUTPUT:
    // IMPORTANT: Responses API does NOT return data.choices[0].message.content.
    // Instead use data.output_text (or parse data.output as a fallback). :contentReference[oaicite:4]{index=4}
    const botMessage =
      data.output_text ||
      (data.output || [])
        .flatMap(item => item.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("") ||
      "";

    console.log("Sending Reply:", botMessage);
    res.json({ reply: botMessage });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

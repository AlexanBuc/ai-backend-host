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
    content:`
    You are the SHIELD Mentor — a sharp, human, reflective coach for busy managers in a short resilience challenge.

    You are NOT a lecturer. You help the manager reach a meaningful insight quickly, using a few high-leverage questions and crisp reflection.

    Session context (assume this is Day 4: personal reflection):
    - The manager already observed team patterns in previous days.
    - Today we focus on the manager’s own response pattern that strengthens or weakens the chosen SHIELD dimension.
    - User name (if provided): ${userName ?? "there"}.
    - Focus dimension (if provided): ${dimension ?? ""}.
    - Reply in the same language as the user (Hebrew or English). Default to Hebrew if the user writes Hebrew.

    CRITICAL BEHAVIOR RULES
    1) Make it meaningful fast:
    - After the user shares a moment + one follow-up detail (max 2 user turns), you MUST offer:
        a) one crisp hypothesis about the manager’s response pattern,
        b) one high-leverage reflective question to validate/sharpen it.
    - Do NOT keep collecting details endlessly.

    2) Keep it conversational:
    - 2–6 short lines per reply.
    - Ask ONE question at a time.
    - No long lists. Max 3 bullets only if necessary.
    - No “workshop handout” tone.

    3) No jargon / invented phrases:
    - Do NOT use odd terms like “דפוס ההגבהה”.
    - Use natural Hebrew: “דפוס תגובה”, “האוטומט שלי”, “איך הופעתי שם”.

    4) No generic advice:
    - Avoid “be positive / communicate better”.
    - Stay specific to the user’s described moment.
    - No “next steps” unless the user asks. If asked: offer ONE micro-experiment only.

    5) Don’t re-ask what you already have:
    - Do NOT ask “what’s your name?”
    - If the dimension is missing (empty/null), ask ONCE: “על איזה מימד נרצה לעבוד היום?”
        Then proceed without repeating it.

    WHAT SHIELD MEANS (use internally; don’t lecture unless asked)
    SHIELD is a practical model for team resilience. Small day-to-day moments strengthen or wear down:
    - S Social Capital: trust, mutual support, asking for help, collaboration, “not alone”.
    - H Hope: meaning, direction, realistic optimism, energy forward.
    - I Internal Dialogue: the stories/assumptions in the room, openness, naming tensions, truth vs rumors.
    - E Efficacy: belief in ability, evidence from small wins, clarity of roles.
    - L Learning Agility: curiosity, experimentation, adaptation, unlearning, low defensiveness.
    - D Determination: persistence through setbacks, focus, stamina, commitment.

    DIMENSION ROUTER (use this to coach meaningfully)
    When the dimension is:
    - S: focus on help-seeking, support visibility, “solo vs together”, interface trust.
    - H: focus on meaning + direction, “reality + possibility”, energy drain vs lift.
    - I: focus on STORY + ASSUMPTIONS + UNSAID TRUTH.
        Key moves: separate camera facts from interpretation, surface the story (“מה הסיפור שרץ?”),
        name what wasn’t said, and the manager’s protective move (avoidance / smoothing / rushing to solution).
        Avoid pushing optimism too early.
    - E: focus on evidence, small wins, framing failure, clarity of roles/ownership.
    - L: focus on curiosity vs defensiveness, experiments, updating assumptions.
    - D: focus on priorities, persistence, energy scatter vs commitment.

    TODAY’S TARGET (the output you are driving toward)
    Help the manager produce one PDF-ready insight:
    - Moment (1 line, concrete)
    - My response pattern (1 line: presence/language/boundaries/transparency)
    - Effect on the chosen dimension (1 line)
    - Insight sentence (1 line): “כש____ קורה, האוטומט שלי הוא ____, וזה יוצר בצוות ____.”

    CONVERSATION FLOW (follow this)
    Step 0 — Anchor (1 line):
    Use the name and (if available) the dimension. If dimension missing, ask for it once.

    Step 1 — Pick one real moment:
    Ask for one concrete moment from the last week where the dimension was tested.
    If the user speaks generally, tighten: “תן לי רגע אחד ספציפי — איפה זה קרה ובאיזה משפט זה התבטא?”

    Step 2 — Camera facts first:
    Ask for one concrete quote or behavior (“מי אמר מה / מה קרה בפועל?”). Keep it short.

    Step 3 — Hypothesis (must happen quickly):
    Offer a crisp hypothesis about the manager’s pattern using ONE of these lenses:
    - Presence (tone/pace/pressure)
    - Language (framing/questions vs statements)
    - Boundaries (what you allowed/stopped)
    - Transparency & big picture (what you shared/withheld)
    Then ask ONE reflective question that deepens meaning.
    Do NOT ask yes/no. Ask a sharpening question.

    Step 4 — Meaning:
    Ask: “ומה זה יצר בצוות באותו רגע?” or dimension-specific equivalent.

    Step 5 — PDF-ready summary:
    End with the 4-line block (Moment / Pattern / Effect / Insight sentence).
    Keep it concise and written in the user’s language.

    QUALITY BAR (self-check before responding)
    - Did I move from facts → meaning within 2 user turns?
    - Did I avoid generic advice and long lists?
    - Did I use the dimension router (especially I = story/assumptions/unsaid truth)?
    - Is my question high-leverage and specific?
    - Is the final output PDF-ready?
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

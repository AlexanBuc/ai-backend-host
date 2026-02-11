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
  const { messages, userName, dimension, language } = req.body;

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
    content:`You are the SHIELD Mentor, a sharp, human, and "priceless" leadership thought partner designed by IQL.
      
      ### SESSION CONTEXT
      - **Current Phase:** Day 4 (Personal Reflection).
      - **Goal:** To help the manager identify their contribution to the team's resilience in a specific moment.
      - **User Name:** ${userName ?? "there"}
      - **Focus Dimension:** ${dimension ?? "General Resilience"}
      
      ---
      
      ### I. VOICE & STYLE: THE IQL DNA
      Your tone must be "Everything but generic." You are not a sterile consultant; you are a partner in the "messy" reality of leadership.
      
      1. **The "Bar Test" (Crucial):** If you wouldn't say it to a friend at a bar, DON'T write it.
         - *Bad:* "Your inquisitive language indicates a lack of boundaries."
         - *Good:* "You asked too many questions instead of deciding."
      2. **Simple Behavioral Language:** DO NOT use professional terms like "Presence," "Boundaries," "Transparency," or "Internal Locus." Describe the *action*.
      3. **Emotional Intelligence ("Feel It"):**
         - **Venting is Key:** If the user sounds frustrated, cynical, or "below the line," DO NOT jump to solutions. Validate the difficulty. Let them vent. Say: "Listen, it sounds exhausting," or "That's a tough spot to be in." Only move up when they are ready.
      4. **"Say It" (Truth):** Be direct but empathetic. Don't smooth things over.
      5. **No Labels:** Never say "CTA," "Wisdom Question," or "PDF Ready." Just talk.
      
      ---
      
      ### II. LANGUAGE & TONE INSTRUCTIONS
      
      1. **Language Detection:**
         - If the user writes in English, reply in crisp, professional, conversational English. Check ${language ?? "General Resilience"}
         - **If the user writes in Hebrew, switch immediately to Hebrew.**
      
      2. **Hebrew Style Guide ("IQL Spoken Hebrew"):**
         - **Register:** Use "Eye-level" spoken Israeli Hebrew (עברית מדוברת / בגובה העיניים).
         - **Tone:** Direct, warm, unpretentious.
           - *YES:* "תכלס", "בוא נבדוק", "מה קורה שם", "מרגיש", "כבד", "צעד קטן".
           - *NO:* "כיצד", "אמנם", "הנך", "נא", "סבורני", "הבה", "לשקף", "להכיל", "שאלה מחכימה", "הנעה לפעולה".
         - **Grammar:** Use **Active Voice** (לשון פעילה).
           - *Say:* "מה עשית?" (What did you do?) NOT "מה נעשה?" (What was done?)
      
      ---
      
      ### III. DEEP KNOWLEDGE BASE (THE SHIELD MUSCLES)
      *Use these concepts to deepen your analysis, but describe them simply.*
      
      - **S (Social Capital):** Trust isn't just "nice." It's asking for help when stuck. It's collaboration across silos.
      - **H (Hope):** Not "everything will be fine." It's realistic optimism. Agency. Finding the "Why" in the mess.
      - **I (Internal Dialogue):** Taming the rumors. Naming the "Elephant in the room." Replacing assumptions with facts.
      - **E (Efficacy):** **Growth Mindset.** How do we handle failure? Do we see it as learning or as a disaster? celebrating small wins.
      - **L (Learning Agility):** Letting go of "I know it all." Experimentation. Unlearning old habits. Reduced defensiveness.
      - **D (Determination):** **Grit.** Managing long-term energy. Project management stamina. Staying focused when the "Load" (עומס) is high.
      
      ---
      
      ### IV. THE INTERVENTION FLOW (STRICT)
      
      **Step 1: The Anchor (Fixed Opening)**
      If this is the first message, output EXACTLY this (adjusting gender/dimension/language):
      "היי ${userName}. אתמול צפית בהתנהגויות של הצוות סביב מימד ה-${dimension}, היום המטרה להסתכל על התרומה שלך כמנהל/ת להתנהלות ולצאת עם תובנה ומחוייבות לפעולה.
      בוא/י ניקח רגע קונקרטי אחד שאפשר ללמוד ממנו. מה היה המצב?"
      
      **Step 2: The Camera Facts (The Gate)**
      You need 3 things before analyzing: (1) Context, (2) Team reaction, (3) Manager action.
      - If missing the Manager's action, ASK: "Wait, I need you in the picture. What did YOU do or say in that exact moment?"
      
      **Step 3: The Mirror (Behavior & Impact)**
      Once you have the facts, describe the dynamic simply (based on the 4 layers model, but WITHOUT naming the layers).
      - Describe their pattern (The "Automt") simply.
      - Describe the impact on the team (The Signal).
      - **Format:** "It sounds like when [Situation] happened, your automatic response was to [Action], and that likely made the team feel [Impact]. Does that make sense?"
      
      **Step 4: The Pivot**
      After they confirm or correct:
      - Ask: **"Looking back, what would you do differently in that moment?"** (מה היית עושה אחרת?)
      
      **Step 5: Closing (Support + Action)**
      After they answer what they would do differently:
      1. **Supportive Feedback:** Give a human, supportive comment on their intention (don't say "Here is feedback", just give it).
      2. **Thought Point:** One sentence to challenge their thinking (related to the Dimension depth).
      3. **Action Item:** Suggest one tiny experiment for next time.
      4. **Final Summary Block:** (See Section V).
      
      ---
      
      ### V. FINAL OUTPUT FORMAT (Clean Summary)
      At the very end of the conversation, generate this simple block. Do not label it "PDF Ready".
      
      **IF HEBREW:**
      הסיכום שלנו להיום:
      
      הרגע: <תיאור קצר של הסיטואציה>
      התגובה שלך: <מה עשית בפועל>
      ההשפעה: <איך זה פגש את הצוות>
      התובנה: בפעם הבאה ש____, הניסיון הוא ____.
      
      **IF ENGLISH**
      Today's Summary:
      
      The Moment: <Brief description>
      Your Reaction: <What you actually did>
      The Impact: <How it met the team>
      The Insight: Next time ____ happens, the goal is to ____.
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
        model: "gpt-5.2",
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



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
    content:
      `You are a facilitator coach. Your job is to provide deep, meaningful feedback and ask reflective questions.` +
      `Be direct yet supportive. Use probing questions, summarize patterns, suggest next steps, and avoid generic advice.`  +
      `User name: ${userName || "Unknown"}. ` +
      `Dimension/context: ${dimension || "None"}. ` +
      `Reply in the same language as the user (Hebrew or English).`
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

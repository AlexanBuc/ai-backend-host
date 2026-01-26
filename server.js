// server.js (UPDATED)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
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

    // 3. INPUT: extract the specific fields your frontend sends
    const { messages, userName, dimension } = req.body;

    // Safety Check: ensure 'messages' exists
    if (!messages) {
        console.error("Error: No messages found in body");
        return res.status(400).json({ error: "Missing 'messages' in payload" });
    }

    // 4. CONTEXT: (Optional) You can use userName or dimension to customize the system prompt
    // For now, we just pass the conversation history to OpenAI
    
    const apiKey = process.env.OPENAI_API_KEY;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // or gpt-4
                messages: messages, // We pass the full conversation array
            })
        });

        const data = await response.json();
        
        // Check if OpenAI returned an error
        if (data.error) {
            console.error("OpenAI Error:", data.error);
            return res.status(500).json({ error: data.error.message });
        }

        // 5. OUTPUT: Format the response exactly as your frontend expects ({ reply: "..." })
        const botMessage = data.choices[0].message.content;
        
        console.log("Sending Reply:", botMessage); // Log the success
        res.json({ reply: botMessage });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

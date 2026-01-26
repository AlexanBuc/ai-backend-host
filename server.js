const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// This allows your Netlify site to talk to this server
app.use(cors()); 
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;
    const apiKey = process.env.OPENAI_API_KEY; // The secret key lives here

    if (!apiKey) {
        return res.status(500).json({ error: "API Key not configured on server" });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: userMessage }]
            })
        });

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error processing request" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
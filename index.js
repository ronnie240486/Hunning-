import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Serve frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Hugging Face API URL ---
const HF_API_URL = "https://api-inference.huggingface.co/models/";

// --- Função para gerar mídia ---
async function generateMedia(apiKey, model, prompt, ratio) {
    const payload = { inputs: prompt, options: { wait_for_model: true } };

    if (ratio) {
        payload.parameters = {
            width: ratio === '16:9' ? 1024 : ratio === '9:16' ? 576 : 768,
            height: ratio === '16:9' ? 576 : ratio === '9:16' ? 1024 : 768
        };
    }

    const response = await fetch(`${HF_API_URL}${model}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro Hugging Face: ${response.status} - ${text}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

// --- Rotas ---
// Gerar imagem
app.post('/generate-image', async (req, res) => {
    try {
        const { prompts, model, ratio } = req.body;
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        if (!apiKey) return res.status(400).json({ error: "API Key necessária" });

        const results = [];
        for (const p of prompts) {
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }
        res.json({ data: results });
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

// Gerar vídeo
app.post('/generate-video', async (req, res) => {
    try {
        const { prompts, model, ratio } = req.body;
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        if (!apiKey) return res.status(400).json({ error: "API Key necessária" });

        const results = [];
        for (const p of prompts) {
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }
        res.json({ data: results });
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`CORS is enabled, ready to accept requests from the frontend.`);
});

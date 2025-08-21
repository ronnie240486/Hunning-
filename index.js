import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const HF_API_URL = "https://api-inference.huggingface.co/models/";

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

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, '../frontend') });
});

app.post('/generate-image', async (req, res) => {
    try {
        const { prompts, model, ratio } = req.body;
        const apiKey = process.env.HF_API_KEY;

        if (!apiKey) return res.status(400).json({ error: "API Key necessária" });

        const results = [];
        for (const p of prompts) {
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }

        res.json({ data: results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/generate-video', async (req, res) => {
    try {
        const { prompts, model, ratio } = req.body;
        const apiKey = process.env.HF_API_KEY;

        if (!apiKey) return res.status(400).json({ error: "API Key necessária" });

        const results = [];
        for (const p of prompts) {
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }

        res.json({ data: results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

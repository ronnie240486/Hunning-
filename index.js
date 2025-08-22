// index.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- Caminho do __dirname no ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Servir Frontend ---
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// --- Função auxiliar para chamada Hugging Face ---
async function generateMedia({ apiKey, model, prompt }) {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Hugging Face API error: ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
}

// --- Endpoint para gerar imagens ---
app.post('/generate-image', async (req, res) => {
    try {
        const { apiKey, prompts, model } = req.body;
        if (!apiKey || !prompts || !prompts.length) {
            return res.status(400).json({ error: 'API Key e prompts são obrigatórios.' });
        }

        const data = [];
        for (const prompt of prompts) {
            const base64 = await generateMedia({ apiKey, model, prompt });
            data.push(base64);
        }

        res.json({ data });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- Endpoint para gerar vídeos ---
app.post('/generate-video', async (req, res) => {
    try {
        const { apiKey, prompts, model } = req.body;
        if (!apiKey || !prompts || !prompts.length) {
            return res.status(400).json({ error: 'API Key e prompts são obrigatórios.' });
        }

        const data = [];
        for (const prompt of prompts) {
            const base64 = await generateMedia({ apiKey, model, prompt });
            data.push(base64);
        }

        res.json({ data });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- Iniciar servidor ---
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Frontend disponível em: http://localhost:${PORT}`);
});

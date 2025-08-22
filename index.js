// index.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Servir frontend estático ---
const frontendPath = path.join(path.resolve(), 'frontend');
app.use(express.static(frontendPath));

// --- Rota raiz serve index.html ---
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Endpoint para gerar imagens ---
app.post('/generate-image', async (req, res) => {
    try {
        const { apiKey, prompts, model, ratio } = req.body;

        if (!apiKey || !prompts || !Array.isArray(prompts) || !model) {
            return res.status(400).json({ error: 'Parâmetros inválidos.' });
        }

        const results = [];

        for (let prompt of prompts) {
            const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(500).json({ error: errorText });
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            results.push(buffer.toString('base64'));
        }

        res.json({ data: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Endpoint para gerar vídeos (exemplo simplificado) ---
app.post('/generate-video', async (req, res) => {
    try {
        const { apiKey, prompts, model } = req.body;

        if (!apiKey || !prompts || !Array.isArray(prompts) || !model) {
            return res.status(400).json({ error: 'Parâmetros inválidos.' });
        }

        const results = [];

        for (let prompt of prompts) {
            const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            });

            if (!response.ok) {
                const errorText = await response.text();
                return res.status(500).json({ error: errorText });
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            results.push(buffer.toString('base64'));
        }

        res.json({ data: results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});


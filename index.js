import express from 'express';
import path from 'path';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;

// --- MIDDLEWARES ---
app.use(cors()); // Permite requisições do frontend
app.use(express.json({ limit: '50mb' })); // Para receber JSON grande
app.use(express.static(path.join(process.cwd(), 'frontend'))); // Servir arquivos do frontend

// --- ROTA RAIZ ---
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'frontend', 'index.html'));
});

// --- FUNÇÃO AUXILIAR PARA CHAMAR HUGGING FACE ---
async function generateFromHF(apiKey, model, inputs) {
    try {
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inputs)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Hugging Face API error: ${text}`);
        }

        // Para imagens ou vídeos, retornamos ArrayBuffer e depois Base64
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return base64;
    } catch (error) {
        throw error;
    }
}

// --- ROTA GERAR IMAGEM ---
app.post('/generate-image', async (req, res) => {
    const { apiKey, prompts, model } = req.body;
    if (!apiKey || !prompts || !Array.isArray(prompts)) {
        return res.status(400).json({ error: 'API Key e prompts são obrigatórios' });
    }

    try {
        const data = [];
        for (const prompt of prompts) {
            const base64 = await generateFromHF(apiKey, model, { inputs: prompt });
            data.push(base64);
        }
        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA GERAR VÍDEO ---
app.post('/generate-video', async (req, res) => {
    const { apiKey, prompts, model } = req.body;
    if (!apiKey || !prompts || !Array.isArray(prompts)) {
        return res.status(400).json({ error: 'API Key e prompts são obrigatórios' });
    }

    try {
        const data = [];
        for (const prompt of prompts) {
            const base64 = await generateFromHF(apiKey, model, { inputs: prompt });
            data.push(base64);
        }
        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

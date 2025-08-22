// backend/index.js
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

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// --- CONSTANTES ---
const HF_API_URL = "https://api-inference.huggingface.co/models/";

// --- FUNÇÃO PARA CHAMAR HUGGING FACE ---
async function generateMedia(apiKey, model, prompt, ratio) {
    const payload = { inputs: prompt, options: { wait_for_model: true } };

    if (ratio) {
        let width, height;
        switch(ratio){
            case '16:9': width=1024; height=576; break;
            case '9:16': width=576; height=1024; break;
            case '1:1': width=768; height=768; break;
            default: width=768; height=768;
        }
        payload.parameters = { width, height };
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

// --- ROTAS ---
// Gerar imagem
app.post('/generate-image', async (req,res)=>{
    try{
        const { prompts, model, ratio } = req.body;
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        if(!apiKey) return res.status(400).json({error:"API Key necessária"});

        const results = [];
        for(const p of prompts){
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }
        res.json({ data: results });
    } catch(e){
        console.error(e);
        res.status(500).send(e.message);
    }
});

// Gerar vídeo
app.post('/generate-video', async (req,res)=>{
    try{
        const { prompts, model, ratio } = req.body;
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        if(!apiKey) return res.status(400).json({error:"API Key necessária"});

        const results = [];
        for(const p of prompts){
            const base64 = await generateMedia(apiKey, model, p, ratio);
            results.push(base64);
        }
        res.json({ data: results });
    } catch(e){
        console.error(e);
        res.status(500).send(e.message);
    }
});

// --- START SERVER ---
app.listen(PORT, ()=>{
    console.log(`Servidor rodando na porta ${PORT}`);
});
porta ${PORT}`));

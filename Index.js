const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('../frontend')); // Servir HTML diretamente

const HF_API_URL = "https://api-inference.huggingface.co/models/";

// Função para chamar Hugging Face
async function generateMedia(apiKey, model, prompt, ratio) {
    const payload = { inputs: prompt, options: { wait_for_model: true } };
    // Adiciona resolução baseada na proporção
    if (ratio) payload.parameters = { width: ratio==='16:9'?1024:ratio==='9:16'?576:768, height: ratio==='16:9'?576:ratio==='9:16'?1024:768 };

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
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
}

// Rota para gerar imagem
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

// Rota para gerar vídeo
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

app.listen(PORT, ()=>{
    console.log(`Servidor rodando na porta ${PORT}`);
});

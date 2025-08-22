import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para receber prompts grandes

// --- Frontend direto no backend ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gerador de Mídia com IA</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
body { font-family: 'Inter', sans-serif; background-color: #111; color: white; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen p-4">
<h1 class="text-3xl mb-4">Gerador de Mídia com IA</h1>
<input id="api-key" type="password" placeholder="API Key Hugging Face" class="mb-2 p-2 text-black w-80">
<textarea id="prompt" rows="4" placeholder="Digite seu prompt" class="mb-2 p-2 w-80 text-black"></textarea>
<button id="generate-btn" class="mb-4 p-2 bg-cyan-600">Gerar Imagem</button>
<div id="result" class="w-80"></div>

<script>
const BACKEND_URL = '';

async function generate() {
    const apiKey = document.getElementById('api-key').value.trim();
    const prompt = document.getElementById('prompt').value.trim();
    if(!apiKey || !prompt){ alert('API Key e Prompt são obrigatórios'); return; }
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = 'Gerando...';
    
    try {
        const res = await fetch('/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, prompts: [prompt], model: 'stabilityai/stable-diffusion-xl-base-1.0' })
        });
        const data = await res.json();
        resultDiv.innerHTML = '';
        data.data.forEach(base64 => {
            const img = document.createElement('img');
            img.src = 'data:image/jpeg;base64,' + base64;
            img.style.maxWidth = '100%';
            resultDiv.appendChild(img);
        });
    } catch(e) {
        resultDiv.innerHTML = 'Erro: ' + e.message;
    }
}

document.getElementById('generate-btn').addEventListener('click', generate);
</script>
</body>
</html>
    `);
});

// --- Endpoint para gerar imagem ---
app.post('/generate-image', async (req, res) => {
    try {
        const { apiKey, prompts, model } = req.body;
        if (!apiKey || !prompts || !prompts.length) return res.status(400).json({ error: 'API Key e prompts obrigatórios' });

        // Chamada para Hugging Face
        const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: prompts[0] }) // usando primeiro prompt
        });

        if(!hfRes.ok) throw new Error('Falha na Hugging Face API');
        const hfData = await hfRes.arrayBuffer();
        const base64 = Buffer.from(hfData).toString('base64');

        res.json({ data: [base64] });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- Inicia o servidor ---
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

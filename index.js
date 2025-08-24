// index.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 8080;

// Inicializa OpenAI
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Rota principal
app.get('/', (req, res) => {
  res.send('🚀 Backend Media AI ativo!');
});

// ✅ Rota de geração de imagem
app.post('/generate', async (req, res) => {
  const { service, prompt, ratio } = req.body;

  if (!service || !prompt) {
    return res.status(400).json({ error: 'Serviço e prompt são obrigatórios.' });
  }

  try {
    let imageData;
    switch (service) {
      case 'huggingface':
        imageData = await generateWithHuggingFace(prompt);
        break;
      case 'stability':
        imageData = await generateWithStability(prompt, ratio);
        break;
      case 'openai':
        imageData = await generateWithOpenAI(prompt);
        break;
      case 'replicate':
        imageData = await generateWithReplicate(prompt);
        break;
      default:
        return res.status(400).json({ error: 'Serviço de IA desconhecido.' });
    }

    res.json({ base64: imageData });
  } catch (error) {
    console.error(`❌ Erro detalhado com ${service}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 HuggingFace (modelo gratuito)
async function generateWithHuggingFace(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('❌ Variável HUGGINGFACE_API_KEY não definida.');

  const modelURL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5";

  const response = await fetch(modelURL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      options: { wait_for_model: true }
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro HuggingFace: ${response.status} - ${errorBody}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// 🔹 Stability AI
async function generateWithStability(prompt, ratio = '1:1') {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('❌ Variável STABILITY_API_KEY não definida.');

  const sizes = {
  '1:1': [1024, 1024],
  '16:9': [1024, 576],
  '9:16': [640, 1536] // ✅ dimensões válidas para Stability XL
};
  const [width, height] = sizes[ratio] || sizes['1:1'];

  const enginesResponse = await fetch('https://api.stability.ai/v1/engines/list', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!enginesResponse.ok) {
    const errorBody = await enginesResponse.text();
    throw new Error(`Erro ao listar modelos Stability: ${enginesResponse.status} - ${errorBody}`);
  }

  const engines = await enginesResponse.json();
  if (!engines || engines.length === 0) throw new Error('Nenhum modelo disponível na Stability AI.');

  const modelId = engines[0].id;

  const response = await fetch(`https://api.stability.ai/v1/generation/${modelId}/text-to-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt }],
      cfg_scale: 7,
      height,
      width,
      samples: 1,
      steps: 30,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro Stability: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error("Resposta inválida da API da Stability.");
  return base64;
}

// 🔹 OpenAI DALL·E
async function generateWithOpenAI(prompt) {
  if (!openai) throw new Error('❌ OpenAI não configurado!');

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024"
  });

  const imageUrl = response.data[0].url;
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// 🔹 Replicate
async function generateWithReplicate(prompt) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new Error('❌ Variável REPLICATE_API_TOKEN não definida!');

  const modelVersion = "7de64d5e7b0a6fbb25b9f99e7f70f146f48db2c9b6b6f3a0d35f80368e8e45f3";

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: modelVersion,
      input: { prompt }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro Replicate: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const imageUrl = data.output[0];
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

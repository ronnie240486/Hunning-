import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 8080;

// Config OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ✅ Rota principal
app.get('/', (req, res) => {
  res.send('🚀 Backend Media AI ativo!');
});

// ✅ Rota de geração de imagem
app.post('/generate', async (req, res) => {
  const { service, prompt, ratio, num_images = 1 } = req.body;

  if (!service || !prompt) return res.status(400).json({ error: 'Serviço e prompt são obrigatórios.' });

  if (num_images < 1 || num_images > 4) return res.status(400).json({ error: 'num_images deve ser entre 1 e 4.' });

  try {
    const images = [];
    for (let i = 0; i < num_images; i++) {
      let imageData;
      switch (service) {
        case 'huggingface':
          imageData = await generateWithHuggingFace(prompt);
          break;
        case 'stability':
          imageData = await generateWithStability(prompt, ratio);
          break;
        case 'replicate':
          imageData = await generateWithReplicate(prompt);
          break;
        case 'openai':
          imageData = await generateWithOpenAI(prompt);
          break;
        default:
          return res.status(400).json({ error: 'Serviço de IA desconhecido.' });
      }
      images.push(imageData);
    }

    res.json({ images });
  } catch (error) {
    console.error(`❌ Erro detalhado com ${service}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Função Hugging Face
async function generateWithHuggingFace(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('Chave de API do Hugging Face não configurada.');

  const modelURL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5";

  const response = await fetch(modelURL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro da API Hugging Face: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// 🔹 Função Stability AI
async function generateWithStability(prompt, ratio = '1:1') {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('Chave de API da Stability AI não configurada.');

  const sizes = { '1:1': [1024, 1024], '16:9': [1024, 576], '9:16': [576, 1024] };
  const [width, height] = sizes[ratio] || sizes['1:1'];

  const enginesResponse = await fetch('https://api.stability.ai/v1/engines/list', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!enginesResponse.ok) {
    const errorBody = await enginesResponse.text();
    throw new Error(`Erro ao listar modelos: ${enginesResponse.status} - ${errorBody}`);
  }

  const engines = await enginesResponse.json();
  if (!engines || engines.length === 0) throw new Error('Nenhum modelo disponível na conta da Stability AI.');

  const modelId = engines[0].id;

  const response = await fetch(`https://api.stability.ai/v1/generation/${modelId}/text-to-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ text_prompts: [{ text: prompt }], cfg_scale: 7, height, width, samples: 1, steps: 30 }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro da API Stability: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error("Resposta inválida da API da Stability.");
  return base64;
}

// 🔹 Função Replicate
async function generateWithReplicate(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('Chave de API do Replicate não configurada.');

  const modelVersion = "7de6c8b2d04f84f6573c6c3f0bb50cbbf7c28787e63c15bb79b8dcf0e1f48f92";

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: modelVersion, input: { prompt } })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro da API Replicate: ${response.status} - ${err}`);
  }

  const data = await response.json();
  let output = null;

  while (!output) {
    const statusResp = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { "Authorization": `Token ${apiKey}` }
    });
    const statusData = await statusResp.json();

    if (statusData.status === "succeeded") output = statusData.output[0];
    else if (statusData.status === "failed") throw new Error("Falha na geração da imagem no Replicate.");
    else await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const imageResp = await fetch(output);
  const arrayBuffer = await imageResp.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

// 🔹 Função OpenAI DALL·E
async function generateWithOpenAI(prompt) {
  const result = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024" });
  const base64 = result.data[0].b64_json;
  if (!base64) throw new Error("Resposta inválida da API OpenAI.");
  return base64;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

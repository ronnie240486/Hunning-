import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8080;

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
      case 'replicate':
        imageData = await generateWithReplicate(prompt, ratio);
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

// 🔹 Hugging Face (modelo gratuito)
async function generateWithHuggingFace(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('Chave de API do Hugging Face não configurada.');

  const modelURL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5";

  const response = await fetch(modelURL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro da API Hugging Face: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// 🔹 Stability AI
async function generateWithStability(prompt, ratio = '1:1') {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('Chave de API da Stability AI não configurada.');

  const sizes = { '1:1':[1024,1024], '16:9':[1024,576], '9:16':[576,1024] };
  const [width, height] = sizes[ratio] || sizes['1:1'];

  const enginesResponse = await fetch('https://api.stability.ai/v1/engines/list', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!enginesResponse.ok) {
    const errorBody = await enginesResponse.text();
    throw new Error(`Erro ao listar modelos: ${enginesResponse.status} - ${errorBody}`);
  }

  const engines = await enginesResponse.json();
  if (!engines || engines.length === 0) throw new Error('Nenhum modelo disponível na Stability AI.');
  
  const modelId = engines[0].id;
  console.log(`✅ Usando modelo Stability AI: ${modelId}`);

  const response = await fetch(`https://api.stability.ai/v1/generation/${modelId}/text-to-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt }],
      cfg_scale: 7, height, width, samples: 1, steps: 30,
    }),
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

// 🔹 Replicate (modelo gratuito)
async function generateWithReplicate(prompt, ratio = '1:1') {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('Chave de API da Replicate não configurada.');

  // Modelo gratuito público: stable-diffusion-v1-5
  const modelVersion = "7de7bd9e64e3b2e5bda44f2b93e0c5f3f0b52f4dbd1c1bfc2e80b8cf1e8a77d3"; // versão pública
  const response = await fetch(`https://api.replicate.com/v1/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: modelVersion,
      input: { prompt }
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro Replicate: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();

  // Espera a geração terminar
  let imageUrl = data.output?.[0];
  let tries = 0;
  while (!imageUrl && tries < 20) { // timeout 20 tentativas
    await new Promise(r => setTimeout(r, 3000));
    const check = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    const checkData = await check.json();
    imageUrl = checkData.output?.[0];
    tries++;
  }

  if (!imageUrl) throw new Error("Falha ao gerar imagem no Replicate.");

  // Baixa imagem e converte para base64
  const imgResp = await fetch(imageUrl);
  const buffer = await imgResp.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

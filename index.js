import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 8080;

// Chaves
const HUGGINGFACE_KEY = process.env.HUGGINGFACE_API_KEY;
const STABILITY_KEY = process.env.STABILITY_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN;

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


// 🔹 Hugging Face (modelo gratuito)
async function generateWithHuggingFace(prompt) {
  if (!HUGGINGFACE_KEY) throw new Error('❌ Hugging Face não configurado!');
  
  const modelURL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5";

  const response = await fetch(modelURL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGINGFACE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Hugging Face falhou: ${response.status} - ${err}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// 🔹 Stability AI
async function generateWithStability(prompt, ratio = '1:1') {
  if (!STABILITY_KEY) throw new Error('❌ Stability AI não configurado!');

  const sizes = { '1:1': [1024, 1024], '16:9': [1024, 576], '9:16': [576, 1024] };
  const [width, height] = sizes[ratio] || sizes['1:1'];

  const enginesResp = await fetch('https://api.stability.ai/v1/engines/list', {
    headers: { 'Authorization': `Bearer ${STABILITY_KEY}` }
  });

  if (!enginesResp.ok) {
    const err = await enginesResp.text();
    throw new Error(`Erro ao listar modelos Stability: ${enginesResp.status} - ${err}`);
  }

  const engines = await enginesResp.json();
  if (!engines.length) throw new Error('Nenhum modelo disponível na Stability AI.');
  
  const modelId = engines[0].id;
  console.log(`✅ Usando modelo Stability AI: ${modelId}`);

  const response = await fetch(`https://api.stability.ai/v1/generation/${modelId}/text-to-image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STABILITY_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt }],
      cfg_scale: 7,
      height,
      width,
      samples: 1,
      steps: 30
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Stability AI falhou: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error('Resposta inválida da Stability AI.');
  return base64;
}

// 🔹 OpenAI DALL·E
async function generateWithOpenAI(prompt) {
  if (!OPENAI_KEY) throw new Error('❌ OpenAI não configurado!');

  const client = new OpenAI({ apiKey: OPENAI_KEY });

  const result = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024'
  });

  const base64 = result.data[0].b64_json;
  if (!base64) throw new Error('Resposta inválida da OpenAI.');
  return base64;
}

// 🔹 Replicate
async function generateWithReplicate(prompt) {
  if (!REPLICATE_KEY) throw new Error('❌ Replicate não configurado!');

  const modelVersion = 'd1afeac2-c19a-4d8a-aea7-08c51b5adbe4'; // seu modelo Replicate
  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Token ${REPLICATE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: modelVersion, input: { prompt } })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Erro ao criar predição Replicate: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  let output = null;

  while (!output) {
    const statusResp = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_KEY}` }
    });

    const statusData = await statusResp.json();

    if (statusData.status === 'succeeded') output = statusData.output[0];
    else if (statusData.status === 'failed') throw new Error(`Predição Replicate falhou: ${JSON.stringify(statusData, null, 2)}`);
    else await new Promise(r => setTimeout(r, 1000));
  }

  const imgResp = await fetch(output);
  const buffer = await imgResp.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import OpenAI from 'openai';

// ------------------------
// CONFIGURAÇÃO DE CHAVES
// ------------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || 'COLOQUE_SUA_CHAVE_OPENAI_AQUI';
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN || 'COLOQUE_SUA_CHAVE_REPLICATE_AQUI';
const HUGGINGFACE_KEY = process.env.HUGGINGFACE_API_KEY || 'COLOQUE_SUA_CHAVE_HUGGINGFACE_AQUI';
const STABILITY_KEY = process.env.STABILITY_API_KEY || 'COLOQUE_SUA_CHAVE_STABILITY_AQUI';
const PORT = process.env.PORT || 8080;

// ------------------------
// CLIENTES
// ------------------------
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ------------------------
// APP CONFIG
// ------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ------------------------
// ROTAS
// ------------------------
app.get('/', (req, res) => {
  res.send('🚀 Backend Media AI ativo!');
});

app.post('/generate', async (req, res) => {
  const { service, prompt, ratio = '1:1' } = req.body;

  if (!service || !prompt) return res.status(400).json({ error: 'Serviço e prompt são obrigatórios.' });

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
        imageData = await generateWithReplicate(prompt);
        break;
      case 'openai':
        imageData = await generateWithOpenAI(prompt);
        break;
      default:
        return res.status(400).json({ error: 'Serviço de IA desconhecido.' });
    }

    res.json({ base64: imageData });
  } catch (err) {
    console.error(`❌ Erro detalhado com ${service}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------
// FUNÇÕES DE GERAÇÃO
// ------------------------

// Hugging Face
async function generateWithHuggingFace(prompt) {
  if (!HUGGINGFACE_KEY) throw new Error('Chave Hugging Face não configurada.');
  const url = 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HUGGINGFACE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro Hugging Face: ${response.status} - ${err}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Stability AI
async function generateWithStability(prompt, ratio) {
  if (!STABILITY_KEY) throw new Error('Chave Stability não configurada.');
  const sizes = { '1:1': [1024, 1024], '16:9': [1024, 576], '9:16': [576, 1024] };
  const [width, height] = sizes[ratio] || sizes['1:1'];

  const enginesRes = await fetch('https://api.stability.ai/v1/engines/list', {
    headers: { 'Authorization': `Bearer ${STABILITY_KEY}` }
  });
  if (!enginesRes.ok) throw new Error('Erro ao listar modelos Stability.');
  const engines = await enginesRes.json();
  const modelId = engines[0]?.id;

  const response = await fetch(`https://api.stability.ai/v1/generation/${modelId}/text-to-image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STABILITY_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ text_prompts: [{ text: prompt }], cfg_scale: 7, height, width, samples: 1, steps: 30 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro Stability: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error('Resposta inválida Stability.');
  return base64;
}

// Replicate
async function generateWithReplicate(prompt) {
  if (!REPLICATE_KEY) throw new Error('Chave Replicate não configurada.');
  const modelVersion = '7de6c8b2d04f84f6573c6c3f0bb50cbbf7c28787e63c15bb79b8dcf0e1f48f92';

  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Token ${REPLICATE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: modelVersion, input: { prompt } })
  });
  if (!resp.ok) throw new Error('Erro Replicate.');

  const data = await resp.json();
  let output = null;
  while (!output) {
    const statusResp = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_KEY}` }
    });
    const statusData = await statusResp.json();
    if (statusData.status === 'succeeded') output = statusData.output[0];
    else if (statusData.status === 'failed') throw new Error('Falha no Replicate.');
    else await new Promise(r => setTimeout(r, 1000));
  }

  const imgResp = await fetch(output);
  const buffer = await imgResp.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// OpenAI DALL·E
async function generateWithOpenAI(prompt) {
  const result = await openai.images.generate({ model: 'gpt-image-1', prompt, size: '1024x1024' });
  const base64 = result.data[0].b64_json;
  if (!base64) throw new Error('Resposta inválida OpenAI.');
  return base64;
}

// ------------------------
// START SERVER
// ------------------------
app.listen(PORT, () => console.log(`🔥 Servidor rodando na porta ${PORT}`));

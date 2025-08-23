import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import OpenAI from 'openai';

// ------------------------
// CONFIGURAÇÃO DE CHAVES
// ------------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN || '';
const HUGGINGFACE_KEY = process.env.HUGGINGFACE_API_KEY || '';
const STABILITY_KEY = process.env.STABILITY_API_KEY || '';
const PORT = process.env.PORT || 8080;

// ------------------------
// VALIDAR CHAVES
// ------------------------
if (!OPENAI_KEY) console.warn('❌ Variável de ambiente OPENAI_API_KEY não definida!');
if (!REPLICATE_KEY) console.warn('❌ Variável de ambiente REPLICATE_API_TOKEN não definida!');
if (!HUGGINGFACE_KEY) console.warn('❌ Variável de ambiente HUGGINGFACE_API_KEY não definida!');
if (!STABILITY_KEY) console.warn('❌ Variável de ambiente STABILITY_API_KEY não definida!');

// ------------------------
// CLIENTES
// ------------------------
let openai;
if (OPENAI_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_KEY });
}

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
        if (!HUGGINGFACE_KEY) throw new Error('❌ Hugging Face não configurado!');
        imageData = await generateWithHuggingFace(prompt);
        break;

      case 'stability':
        if (!STABILITY_KEY) throw new Error('❌ Stability AI não configurado!');
        imageData = await generateWithStability(prompt, ratio);
        break;

      case 'replicate':
        if (!REPLICATE_KEY) throw new Error('❌ Replicate não configurado!');
        imageData = await generateWithReplicate(prompt);
        break;

      case 'openai':
        if (!OPENAI_KEY) throw new Error('❌ OpenAI não configurado!');
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
  try {
    const result = await openai.images.generate({ model: 'gpt-image-1', prompt, size: '1024x1024' });
    const base64 = result.data[0].b64_json;
    if (!base64) throw new Error('Resposta inválida OpenAI.');
    return base64;
  } catch (err) {
    throw new Error(`Erro OpenAI: ${err.message}`);
  }
}

// ------------------------
// START SERVER
// ------------------------
app.listen(PORT, () => console.log(`🔥 Servidor rodando na porta ${PORT}`));

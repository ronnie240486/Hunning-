import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // necessário instalar: npm install node-fetch
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());

// Verifica se as variáveis estão configuradas
if (!process.env.OPENAI_API_KEY) console.warn("❌ OPENAI_API_KEY não configurada!");
if (!process.env.REPLICATE_API_TOKEN) console.warn("❌ REPLICATE_API_TOKEN não configurada!");
if (!process.env.HUGGINGFACE_API_KEY) console.warn("❌ HUGGINGFACE_API_KEY não configurada!");
if (!process.env.STABILITY_API_KEY) console.warn("❌ STABILITY_API_KEY não configurada!");

// Configuração OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Rota principal
app.get('/', (req, res) => {
  res.send('🚀 Backend Media AI ativo!');
});

// Rota de geração de imagem
app.post('/generate', async (req, res) => {
  const { service, prompt, ratio } = req.body;

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

// Função HuggingFace (gratuito)
async function generateWithHuggingFace(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('Chave de API HuggingFace não configurada.');

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
    throw new Error(`Erro HuggingFace: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Função Stability AI
async function generateWithStability(prompt, ratio = '1:1') {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) throw new Error('Chave de API Stability AI não configurada.');

  const sizes = { '1:1': [1024, 1024], '16:9': [1024, 576], '9:16': [576, 1024] };
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
      cfg_scale: 7,
      height,
      width,
      samples: 1,
      steps: 30,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro Stability: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) throw new Error("Resposta inválida da Stability AI.");
  return base64;
}

// Função OpenAI
async function generateWithOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) throw new Error('❌ OpenAI não configurado!');

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024'
  });

  const imageBase64 = response.data[0].b64_json;
  if (!imageBase64) throw new Error("Erro na resposta OpenAI.");
  return imageBase64;
}

// Função Replicate
async function generateWithReplicate(prompt) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new Error("❌ REPLICATE_API_TOKEN não configurado!");

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiToken}`, // ← obrigatório
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "7de09ca0f49c3d04589f0fbc8e85c7f89dffdeed0a045e76b6b23e94e3c3f38f", // substitua pelo modelo desejado
      input: { prompt }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro Replicate: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const output = data.output?.[0];
  if (!output) throw new Error("Resposta inválida da Replicate.");
  return output;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

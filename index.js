import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, 'frontend')));

// --- ROUTES ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

/**
 * Função genérica para chamar a Hugging Face
 * @param {string} apiKey - sua Hugging Face API Key
 * @param {string} model - nome do modelo
 * @param {Array<string>} prompts - lista de prompts
 * @returns {Array<string>} array de base64
 */
async function callHuggingFace(apiKey, model, prompts) {
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompts.join('\n'),
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Hugging Face API error: ${text}`);
    }

    const data = await response.json();

    // Para text-to-image, geralmente é retornado array base64
    if (Array.isArray(data)) {
      return data.map(item => item?.image || item?.binary || item?.base64).filter(Boolean);
    }

    // Alguns modelos retornam objeto com key "image" ou "video"
    if (data.image || data.video) {
      return [data.image || data.video];
    }

    throw new Error('Formato de resposta do Hugging Face inválido.');
  } catch (error) {
    throw error;
  }
}

// --- IMAGE ROUTE ---
app.post('/generate-image', async (req, res) => {
  const { apiKey, model, prompts } = req.body;

  if (!apiKey || !model || !prompts?.length) {
    return res.status(400).json({ error: 'apiKey, model e prompts são obrigatórios.' });
  }

  try {
    const imagesBase64 = await callHuggingFace(apiKey, model, prompts);
    res.json({ data: imagesBase64 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- VIDEO ROUTE ---
app.post('/generate-video', async (req, res) => {
  const { apiKey, model, prompts } = req.body;

  if (!apiKey || !model || !prompts?.length) {
    return res.status(400).json({ error: 'apiKey, model e prompts são obrigatórios.' });
  }

  try {
    const videosBase64 = await callHuggingFace(apiKey, model, prompts);
    res.json({ data: videosBase64 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('CORS is enabled, ready to accept requests from the frontend.');
});

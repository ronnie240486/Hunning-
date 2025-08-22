import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middlewares ---
// 1. Habilita o CORS para permitir requisições do frontend
app.use(cors());
// 2. Habilita o parsing de corpos de requisição em JSON
app.use(express.json());

/**
 * Função para consultar a API de Inferência da Hugging Face.
 * @param {string} model - O ID do modelo a ser consultado.
 * @param {string} apiKey - A chave da API da Hugging Face.
 * @param {object} payload - Os dados a serem enviados para o modelo.
 * @returns {Promise<Buffer>} - Uma promessa que resolve para os dados binários da mídia.
 */
async function queryHuggingFace(model, apiKey, payload) {
    const API_URL = `https://api-inference.huggingface.co/models/${model}`;
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        // Tenta ler a resposta de erro como texto para dar mais detalhes
        const errorDetails = await response.text();
        console.error(`Erro na API da Hugging Face: ${response.status}`, errorDetails);
        // Retorna um erro mais claro para o frontend
        throw new Error(`Erro na API da Hugging Face: ${errorDetails}`);
    }

    // Pega a resposta como um Buffer (dados binários)
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Manipulador genérico para requisições de geração de mídia.
 * @param {'image' | 'video'} type - O tipo de mídia a ser gerada.
 * @param {express.Request} req - O objeto de requisição do Express.
 * @param {express.Response} res - O objeto de resposta do Express.
 */
async function handleGenerationRequest(type, req, res) {
    const { apiKey, prompts, model, ratio } = req.body;

    if (!apiKey || !prompts || !model) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes: apiKey, prompts, model.' });
    }

    console.log(`Recebida requisição para gerar ${prompts.length} ${type}(s) com o modelo: ${model}`);

    try {
        const results = [];
        for (const prompt of prompts) {
            const payload = { inputs: prompt };

            if (type === 'image' && model.includes('stable-diffusion-xl')) {
                payload.parameters = {};
                const [w, h] = ratio.split(':').map(Number);
                if (w > h) {
                    payload.parameters.width = 1024;
                    payload.parameters.height = Math.round(1024 * (h / w));
                } else {
                    payload.parameters.height = 1024;
                    payload.parameters.width = Math.round(1024 * (w / h));
                }
            }

            const mediaBuffer = await queryHuggingFace(model, apiKey, payload);
            
            // **A PARTE MAIS IMPORTANTE DA CORREÇÃO ESTÁ AQUI**
            // Converte os dados binários da imagem/vídeo para uma string Base64.
            const base64String = mediaBuffer.toString('base64');
            results.push(base64String);
        }

        // Envia os resultados de volta para o frontend no formato JSON esperado.
        res.json({ data: results });

    } catch (error) {
        console.error('Erro durante a geração de mídia:', error);
        // Envia o erro como JSON para que o frontend possa exibi-lo corretamente.
        res.status(500).json({ error: error.message });
    }
}

// --- Endpoints da API ---
app.post('/generate-image', (req, res) => handleGenerationRequest('image', req, res));
app.post('/generate-video', (req, res) => handleGenerationRequest('video', req, res));

// --- Início do Servidor ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('CORS habilitado, pronto para receber requisições do frontend.');
});

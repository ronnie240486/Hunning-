import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Rota Principal (verificação)
app.get('/', (req, res) => {
    res.send('🚀 Backend Media AI está no ar!');
});

// ✅ Rota de Geração de Imagem
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
            default:
                return res.status(400).json({ error: 'Serviço de IA desconhecido.' });
        }

        res.json({ base64: imageData });
    } catch (error) {
        console.error(`❌ Erro detalhado com ${service}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});


// 🔹 Função Hugging Face
async function generateWithHuggingFace(prompt) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) throw new Error('Chave de API do Hugging Face não configurada no backend.');

    const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt }),
        }
    );

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
    if (!apiKey) throw new Error('Chave de API da Stability AI não configurada no backend.');

    const sizes = {
        '1:1': [1024, 1024],
        '16:9': [1024, 576],
        '9:16': [576, 1024]
    };
    const [width, height] = sizes[ratio] || sizes['1:1'];

    const response = await fetch(
        "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image",
        {
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
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro da API Stability: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const base64 = data.artifacts?.[0]?.base64;
    if (!base64) throw new Error("Resposta inválida da API da Stability.");
    return base64;
}


// ✅ Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware ---
// 1. Enable CORS for all routes to allow frontend requests
app.use(cors());
// 2. Enable parsing of JSON bodies in requests
app.use(express.json());

/**
 * A helper function to query the Hugging Face Inference API.
 * @param {string} model - The model ID to query.
 * @param {string} apiKey - The Hugging Face API key.
 * @param {object} payload - The data to send to the model.
 * @returns {Promise<Buffer>} - A promise that resolves to the binary data of the media.
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
        const errorDetails = await response.text();
        console.error(`Hugging Face API Error: ${response.status}`, errorDetails);
        throw new Error(`Failed to fetch from Hugging Face API: ${errorDetails}`);
    }

    // Get the response as a Buffer (binary data)
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Generic handler for media generation requests.
 * @param {'image' | 'video'} type - The type of media to generate.
 * @param {express.Request} req - The Express request object.
 * @param {express.Response} res - The Express response object.
 */
async function handleGenerationRequest(type, req, res) {
    // Extract data from the request body sent by the frontend
    const { apiKey, prompts, model, ratio } = req.body;

    if (!apiKey || !prompts || !model) {
        return res.status(400).send('Missing required fields: apiKey, prompts, model.');
    }

    console.log(`Received request to generate ${prompts.length} ${type}(s) with model: ${model}`);

    try {
        const results = [];
        // Process each prompt individually
        for (const prompt of prompts) {
            const payload = { inputs: prompt };

            // Add specific parameters for SDXL models if it's an image request
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
            // Convert the binary data to a Base64 string to send as JSON
            results.push(mediaBuffer.toString('base64'));
        }

        // Send the results back to the frontend in the expected format
        res.json({ data: results });

    } catch (error) {
        console.error('Error during media generation:', error);
        res.status(500).send(error.message);
    }
}

// --- API Endpoints ---
app.post('/generate-image', (req, res) => handleGenerationRequest('image', req, res));
app.post('/generate-video', (req, res) => handleGenerationRequest('video', req, res));

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log('CORS is enabled, ready to accept requests from the frontend.');
});

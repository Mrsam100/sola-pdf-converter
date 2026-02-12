/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";

/**
 * ⚠️ SECURITY WARNING ⚠️
 * This service uses client-side API calls which exposes the API key in the browser.
 *
 * CRITICAL SECURITY ISSUES:
 * 1. API key is visible in browser DevTools (Network tab, Sources tab)
 * 2. Malicious users can extract the key and abuse your quota
 * 3. No rate limiting on client side - can exhaust API quota
 *
 * PRODUCTION RECOMMENDATION:
 * Move all Gemini API calls to a backend server:
 * - Client → Your Backend API → Gemini API
 * - Implement rate limiting on your backend (3 req/min per user)
 * - Add request logging and monitoring
 * - Protect API key server-side only
 */

// Validate API key format (Google AI API keys start with "AIza")
const validateApiKey = (key: string): boolean => {
    return key.startsWith('AIza') && key.length >= 39;
};

// Rate limiter for client-side protection (weak protection - use backend for production)
const rateLimiter = {
    requests: [] as number[],
    maxRequests: 10, // Max 10 requests per minute
    windowMs: 60000, // 1 minute window

    isAllowed(): boolean {
        const now = Date.now();
        // Remove old requests outside window
        this.requests = this.requests.filter(time => now - time < this.windowMs);

        if (this.requests.length >= this.maxRequests) {
            return false;
        }

        this.requests.push(now);
        return true;
    },

    getWaitTime(): number {
        if (this.requests.length === 0) return 0;
        const oldestRequest = this.requests[0];
        return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
    }
};

export const convertFile = async (file: File, toolId: string): Promise<string> => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

    // Validate API key exists
    if (!apiKey) {
        throw new Error("❌ API Key missing. Please add GEMINI_API_KEY to your .env file.\n\nGet your key from: https://aistudio.google.com/apikey");
    }

    // Validate API key format
    if (!validateApiKey(apiKey)) {
        throw new Error("❌ Invalid API key format. Google AI API keys start with 'AIza' and are 39+ characters long.\n\nCheck your .env file and get a valid key from: https://aistudio.google.com/apikey");
    }

    // Client-side rate limiting (weak protection)
    if (!rateLimiter.isAllowed()) {
        const waitSeconds = Math.ceil(rateLimiter.getWaitTime() / 1000);
        throw new Error(`⏱️ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.\n\n💡 Tip: Upgrade to a backend API for unlimited requests.`);
    }

    // Validate file size (max 50MB for Gemini API - increased limit)
    const maxSize = 50 * 1024 * 1024; // 50MB (increased from 20MB)
    if (file.size > maxSize) {
        throw new Error(`❌ File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: 50MB.\n\n💡 Tip: Compress the file or split it into smaller chunks.`);
    }

    // Validate file type
    const allowedTypes = ['image/', 'audio/', 'video/', 'application/pdf', 'text/'];
    const isAllowedType = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowedType) {
        throw new Error(`❌ Unsupported file type: ${file.type}\n\nAllowed types: Images, Audio, Video, PDF, Text files`);
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToBase64(file);

    // Default config using gemini-2.0-flash-exp for speed and efficiency
    const modelName = 'gemini-2.0-flash-exp';
    let prompt = "Analyze this file.";

    // Tailor prompt based on tool ID for specific output formats
    switch (toolId) {
        case 'ocr-text':
            prompt = "Extract all readable text from this image. Return ONLY the extracted text. Do not add any conversational filler. Maintain the original layout spacing where possible.";
            break;
        case 'audio-text':
            prompt = "Transcribe this audio file accurately. Return ONLY the transcript text. Do not include timestamps or speaker labels unless they are critical to understanding.";
            break;
        case 'pdf-word':
        case 'word-pdf':
            prompt = "Read this document and convert its content into a well-structured text format. Use Markdown headers (#, ##) for titles and bullet points for lists. Return ONLY the content.";
            break;
        case 'pdf-excel':
        case 'pdf-csv':
            prompt = "Extract all tabular data from this document and format it strictly as CSV (Comma Separated Values). If there are multiple tables, separate them with a blank line. Do not include any other text or markdown code blocks.";
            break;
        case 'summarize-text':
             prompt = "Provide a concise, professional summary of the attached file content. Focus on the key points and conclusions.";
             break;
        case 'image-caption':
             prompt = "Provide a detailed caption for this image.";
             break;
        default:
             prompt = "Analyze the content of this file and provide a detailed text representation of it.";
    }

    try {
       const response = await ai.models.generateContent({
           model: modelName,
           contents: [{
               role: 'user',
               parts: [
                   { inlineData: { mimeType: file.type || 'application/octet-stream', data: base64Data } },
                   { text: prompt }
               ]
           }],
           config: {
               // Ensure the model doesn't truncate important conversions
               maxOutputTokens: 8192,
           }
       });

       return response.text || "No text could be extracted from this file.";
    } catch (e) {
        console.error("Conversion Error", e);
        throw new Error("We could not process this file. It may be too large or the format is unsupported by the current model.");
    }
}

export const sendMessageToGemini = async (history: { role: 'user' | 'model'; text: string }[], message: string): Promise<string> => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

    // Validate API key exists
    if (!apiKey) {
        throw new Error("❌ API Key missing. Please add GEMINI_API_KEY to your .env file.\n\nGet your key from: https://aistudio.google.com/apikey");
    }

    // Validate API key format
    if (!validateApiKey(apiKey)) {
        throw new Error("❌ Invalid API key format. Google AI API keys start with 'AIza' and are 39+ characters long.");
    }

    // Client-side rate limiting
    if (!rateLimiter.isAllowed()) {
        const waitSeconds = Math.ceil(rateLimiter.getWaitTime() / 1000);
        throw new Error(`⏱️ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`);
    }

    // Validate message length (max 30,000 characters)
    if (message.length > 30000) {
        throw new Error(`❌ Message too long (${message.length} characters). Maximum: 30,000 characters.`);
    }

    // Sanitize message to prevent injection attacks
    const sanitizedMessage = message
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();

    const ai = new GoogleGenAI({ apiKey });

    // Transform history to API format
    const chatHistory = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
        model: 'gemini-2.0-flash-exp',
        history: chatHistory,
        config: {
            systemInstruction: "You are Aura, a sophisticated and helpful AI assistant for the Sola conversion suite. You are concise, polite, and professional. Your goal is to help users find the right tools or answer questions about file formats."
        }
    });

    const result = await chat.sendMessage({ message: sanitizedMessage });
    return result.text || "";
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
             const result = reader.result as string;
             // Remove data url prefix (e.g. "data:image/png;base64,")
             const base64 = result.split(',')[1];
             resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

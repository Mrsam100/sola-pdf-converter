/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";

export const convertFile = async (file: File, toolId: string): Promise<string> => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("API Key missing. Please add GEMINI_API_KEY to your .env file.");
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
    if (!apiKey) {
        throw new Error("API Key missing. Please add GEMINI_API_KEY to your .env file.");
    }

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

    const result = await chat.sendMessage({ message });
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

import { GoogleGenAI } from '@google/genai';
import { AI_TIMEOUT_MS } from '@/lib/constants';
import type { AiClient } from './client';

/** Gemini through the Google Gen AI SDK. The model id comes from GEMINI_MODEL. */
export function createGeminiClient(apiKey: string, model: string): AiClient {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateJson({ system, user, schema }) {
      const response = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
        },
      });
      return JSON.parse(response.text ?? '');
    },
  };
}

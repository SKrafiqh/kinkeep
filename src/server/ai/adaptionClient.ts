import { z } from 'zod';
import { AI_TIMEOUT_MS } from '@/lib/constants';
import type { AiClient } from './client';

const MAX_OUTPUT_TOKENS = 1500;

// Only the fields we read. `output_text` is the joined text; `output` is the raw list.
const responseSchema = z.object({
  output_text: z.string().optional(),
  output: z
    .array(z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() }))
    .optional(),
});

/** The text of a Responses API reply, from `output_text` or else from the output items. */
export function replyText(body: unknown): string {
  const parsed = responseSchema.parse(body);
  if (parsed.output_text) return parsed.output_text;
  return (parsed.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');
}

/** The JSON object inside a reply. Models sometimes wrap it in a code fence or a sentence. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('The reply held no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Adaption Labs through its Responses API. The API documents no JSON mode, so the schema is
 * stated in the instructions and the caller validates the result; a mismatch falls back.
 */
export function createAdaptionClient(options: { apiKey: string; model: string; baseUrl: string }): AiClient {
  return {
    async generateJson({ system, user, schema }) {
      const response = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/api/v1/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify({
          model: options.model,
          instructions: `${system}\nReply with one JSON object only, no other text, matching this JSON Schema:\n${JSON.stringify(schema)}`,
          input: user,
          temperature: 0.2,
          max_output_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      // Status only: the body of an error reply is not logged or shown.
      if (!response.ok) throw new Error(`AI request failed with status ${response.status}`);
      return extractJson(replyText(await response.json()));
    },
  };
}

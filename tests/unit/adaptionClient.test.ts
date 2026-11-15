import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdaptionClient, extractJson, replyText } from '@/server/ai/adaptionClient';

const OPTIONS = { apiKey: 'pt_live_test', model: 'gemma-4-31b-it', baseUrl: 'https://ai.example/' };
const REQUEST = { system: 'Be brief.', user: '<DATA>{}</DATA>', schema: { type: 'object' } };

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('replyText', () => {
  it('prefers output_text', () => {
    expect(replyText({ output_text: '{"a":1}', output: [] })).toBe('{"a":1}');
  });

  it('joins the output_text parts when output_text is absent', () => {
    const body = {
      output: [
        {
          content: [{ type: 'output_text', text: '{"a":' }, { type: 'reasoning' }, { type: 'output_text', text: '1}' }],
        },
      ],
    };
    expect(replyText(body)).toBe('{"a":1}');
  });

  it('rejects a body of the wrong shape', () => {
    expect(() => replyText({ output: 'nope' })).toThrow();
  });
});

describe('extractJson', () => {
  it('reads bare JSON and JSON wrapped in a fence or a sentence', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":{"b":2}}\n```')).toEqual({ a: { b: 2 } });
    expect(extractJson('Here it is: {"a":1} Hope it helps.')).toEqual({ a: 1 });
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJson('I cannot help with that.')).toThrow('no JSON object');
    expect(() => extractJson('{not json}')).toThrow();
  });
});

describe('createAdaptionClient', () => {
  it('posts to the Responses API with the key, model and schema', async () => {
    const fetchMock = stubFetch(200, { output_text: '{"summary":"ok"}' });
    const result = await createAdaptionClient(OPTIONS).generateJson(REQUEST);
    expect(result).toEqual({ summary: 'ok' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.example/api/v1/responses');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer pt_live_test' });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: 'gemma-4-31b-it', input: REQUEST.user });
    expect(body.instructions).toContain('Be brief.');
    expect(body.instructions).toContain('{"type":"object"}');
  });

  it('fails with the status only, never the error body', async () => {
    stubFetch(402, { error: 'insufficient credits for org 123' });
    const error = await createAdaptionClient(OPTIONS)
      .generateJson(REQUEST)
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('AI request failed with status 402');
  });
});

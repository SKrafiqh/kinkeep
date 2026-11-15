export interface AiRequest {
  /** Fixes the role and the refusals. */
  system: string;
  /** Untrusted data, already wrapped in a delimited block. */
  user: string;
  /** JSON Schema the reply must follow. */
  schema: unknown;
}

export interface AiClient {
  /** The model's reply parsed as JSON. Callers must still validate it; rejects on timeout or failure. */
  generateJson(request: AiRequest): Promise<unknown>;
}

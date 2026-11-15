import type { AiClient } from './ai/client';
import { createGeminiClient } from './ai/geminiClient';
import type { OidcVerifier } from './auth/cron';
import { googleOidcVerifier } from './auth/googleOidc';
import { systemClock, type Clock } from './clock';
import { getConfig, type Config } from './config';
import { createEmailSender, type EmailSender } from './email/sender';
import { createFirestoreStore } from './repos/firestoreStore';
import { createMemoryStore } from './repos/memoryStore';
import type { DocStore } from './repos/store';

/** Everything that does I/O. Services receive this, so tests can pass fakes. */
export interface Deps {
  config: Config;
  store: DocStore;
  clock: Clock;
  email: EmailSender;
  /** Null when no Gemini key is configured; AI features then use their fallback. */
  ai: AiClient | null;
  oidc: OidcVerifier;
}

// On globalThis so the in-memory store survives hot reloads and is shared by every route bundle.
const holder = globalThis as typeof globalThis & { __kinkeepDeps?: Deps };

function build(): Deps {
  const config = getConfig();
  return {
    config,
    store: config.DATA_STORE === 'firestore' ? createFirestoreStore(config) : createMemoryStore(),
    clock: systemClock,
    email: createEmailSender(config),
    ai: config.GEMINI_API_KEY ? createGeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODEL) : null,
    oidc: googleOidcVerifier,
  };
}

/** The process-wide dependencies, built on first use. */
export function getDeps(): Deps {
  holder.__kinkeepDeps ??= build();
  return holder.__kinkeepDeps;
}

/** Replace the dependencies. For tests. */
export function setDeps(deps: Deps | undefined): void {
  holder.__kinkeepDeps = deps;
}

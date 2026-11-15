import { log, maskEmail } from '@/lib/logger';
import type { Config } from '../config';
import { createGmailSender } from './gmailSender';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  /** Rejects when the message could not be handed to the mail server. */
  send(message: EmailMessage): Promise<void>;
}

/** Logs instead of sending. The body, which holds one-tap links, is shown only outside production. */
export function createConsoleSender(config: Config): EmailSender {
  return {
    async send(message) {
      log.info('email.console', { to: maskEmail(message.to), subject: message.subject });
      if (!config.isProduction && process.env.LOG_LEVEL !== 'silent') process.stdout.write(`${message.text}\n`);
    },
  };
}

/** The sender chosen by EMAIL_PROVIDER. */
export function createEmailSender(config: Config): EmailSender {
  return config.EMAIL_PROVIDER === 'gmail' ? createGmailSender(config) : createConsoleSender(config);
}

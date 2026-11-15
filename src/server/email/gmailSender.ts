import { createTransport } from 'nodemailer';
import { APP_NAME } from '@/lib/constants';
import type { Config } from '../config';
import type { EmailSender } from './sender';

/** Sends through Gmail SMTP with an app password. Consumer accounts cap at about 500 recipients a day. */
export function createGmailSender(config: Config): EmailSender {
  const transport = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: config.GMAIL_USER, pass: config.GMAIL_APP_PASSWORD },
  });
  return {
    async send(message) {
      await transport.sendMail({ from: `"${APP_NAME}" <${config.GMAIL_USER}>`, ...message });
    },
  };
}

import { OAuth2Client } from 'google-auth-library';
import type { OidcVerifier } from './cron';

const client = new OAuth2Client();

/** Checks a Google-signed ID token: signature against Google's keys, expiry, issuer and audience. */
export const googleOidcVerifier: OidcVerifier = {
  async verify(token, audience) {
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience });
      const payload = ticket.getPayload();
      if (!payload?.email) return null;
      return { email: payload.email, emailVerified: payload.email_verified === true };
    } catch {
      return null;
    }
  },
};

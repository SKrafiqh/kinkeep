import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { PASSCODE_LENGTH } from '@/lib/constants';

const KEY_BYTES = 32;

function scryptAsync(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * scrypt(HMAC-SHA256(pepper, passcode), salt). The pepper lives outside the database, so a
 * database leak alone is not enough to brute-force six digits.
 */
export async function hashPasscode(passcode: string, salt: string, pepper: string): Promise<string> {
  const keyed = createHmac('sha256', pepper).update(passcode).digest();
  return (await scryptAsync(keyed, Buffer.from(salt, 'hex'))).toString('hex');
}

/** Hash and fresh salt for a new passcode. */
export async function newPasscodeFields(
  passcode: string,
  pepper: string,
): Promise<{ passcodeHash: string; passcodeSalt: string }> {
  const passcodeSalt = randomBytes(16).toString('hex');
  return { passcodeHash: await hashPasscode(passcode, passcodeSalt, pepper), passcodeSalt };
}

/** Constant-time check of a passcode against a stored hash. */
export async function verifyPasscode(
  passcode: string,
  salt: string,
  expectedHash: string,
  pepper: string,
): Promise<boolean> {
  const actual = Buffer.from(await hashPasscode(passcode, salt, pepper), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A random six-digit passcode for setup, from the system's secure generator. */
export function randomPasscode(): string {
  return String(randomInt(0, 10 ** PASSCODE_LENGTH)).padStart(PASSCODE_LENGTH, '0');
}

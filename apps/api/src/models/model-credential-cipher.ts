import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedCredential {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialEncryptionError';
  }
}

export class ModelCredentialCipher {
  constructor(
    private readonly masterKey: Buffer,
    private readonly keyVersion: number,
  ) {
    if (masterKey.length !== 32) {
      throw new CredentialEncryptionError('Model credential key must be 32 bytes');
    }
    if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 32767) {
      throw new CredentialEncryptionError('Model credential key version is invalid');
    }
  }

  encrypt(secret: string): EncryptedCredential {
    if (!secret) {
      throw new CredentialEncryptionError('Model credential cannot be empty');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return {
      ciphertext,
      iv,
      authTag: cipher.getAuthTag(),
      keyVersion: this.keyVersion,
    };
  }

  decrypt(encrypted: EncryptedCredential): string {
    if (
      encrypted.iv.length !== IV_LENGTH ||
      encrypted.authTag.length !== AUTH_TAG_LENGTH ||
      encrypted.keyVersion !== this.keyVersion
    ) {
      throw new CredentialEncryptionError('Model credential metadata is invalid');
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.masterKey, encrypted.iv);
      decipher.setAuthTag(encrypted.authTag);
      return Buffer.concat([
        decipher.update(encrypted.ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new CredentialEncryptionError('Model credential decryption failed');
    }
  }

  static createSecretHint(secret: string): string | null {
    return secret ? `…${secret.slice(-4)}` : null;
  }
}

export function createModelCredentialCipherFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ModelCredentialCipher {
  const encodedKey = env.MODEL_CREDENTIAL_MASTER_KEY;
  if (!encodedKey) {
    throw new CredentialEncryptionError('MODEL_CREDENTIAL_MASTER_KEY is not configured');
  }

  let key: Buffer;
  try {
    key = Buffer.from(encodedKey, 'base64');
  } catch {
    throw new CredentialEncryptionError('MODEL_CREDENTIAL_MASTER_KEY is invalid');
  }

  const keyVersion = Number(env.MODEL_CREDENTIAL_KEY_VERSION ?? 1);
  return new ModelCredentialCipher(key, keyVersion);
}

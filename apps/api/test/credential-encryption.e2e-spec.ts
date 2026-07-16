import {
  CredentialEncryptionError,
  ModelCredentialCipher,
  createModelCredentialCipherFromEnv,
} from '../src/models/model-credential-cipher';

describe('model credential encryption', () => {
  const masterKey = Buffer.alloc(32, 7);

  it('encrypts and decrypts credentials with AES-256-GCM', () => {
    const cipher = new ModelCredentialCipher(masterKey, 3);
    const encrypted = cipher.encrypt('sk-test-secret');

    expect(encrypted.ciphertext).not.toEqual(Buffer.from('sk-test-secret'));
    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(encrypted.keyVersion).toBe(3);
    expect(cipher.decrypt(encrypted)).toBe('sk-test-secret');
  });

  it('uses a fresh IV for every encryption', () => {
    const cipher = new ModelCredentialCipher(masterKey, 1);
    const first = cipher.encrypt('same-secret');
    const second = cipher.encrypt('same-secret');

    expect(first.iv).not.toEqual(second.iv);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it('rejects tampered ciphertext and invalid master keys', () => {
    const cipher = new ModelCredentialCipher(masterKey, 1);
    const encrypted = cipher.encrypt('secret');
    encrypted.ciphertext[0] ^= 1;

    expect(() => cipher.decrypt(encrypted)).toThrow(CredentialEncryptionError);
    expect(() => new ModelCredentialCipher(Buffer.alloc(16), 1)).toThrow(
      CredentialEncryptionError,
    );
  });

  it('loads a versioned base64 key from the environment and creates a safe hint', () => {
    const cipher = createModelCredentialCipherFromEnv({
      MODEL_CREDENTIAL_MASTER_KEY: masterKey.toString('base64'),
      MODEL_CREDENTIAL_KEY_VERSION: '9',
    });
    const encrypted = cipher.encrypt('abcd-secret');

    expect(encrypted.keyVersion).toBe(9);
    expect(ModelCredentialCipher.createSecretHint('abcd-secret')).toBe('…cret');
    expect(ModelCredentialCipher.createSecretHint('')).toBeNull();
  });
});

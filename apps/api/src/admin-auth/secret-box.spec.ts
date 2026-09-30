import { randomBytes } from 'crypto';
import { openSecret, sealSecret } from './secret-box';

describe('secret box (AES-256-GCM for TOTP secrets)', () => {
  const key = randomBytes(32);

  it('round-trips and never stores plaintext', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', key);
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(openSecret(sealed, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV each time', () => {
    expect(sealSecret('same', key)).not.toBe(sealSecret('same', key));
  });

  it('rejects tampered ciphertext and the wrong key', () => {
    const sealed = sealSecret('secret', key);
    const parts = sealed.split('.');
    const ct = Buffer.from(parts[3], 'base64url');
    ct[0] ^= 1;
    parts[3] = ct.toString('base64url');
    expect(() => openSecret(parts.join('.'), key)).toThrow();
    expect(() => openSecret(sealed, randomBytes(32))).toThrow();
  });
});

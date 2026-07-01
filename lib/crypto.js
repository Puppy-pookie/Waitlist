const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.WAITLIST_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'WAITLIST_ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

// Returns a single string "iv:authTag:ciphertext" (all hex) safe to store in a text column.
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

function decrypt(stored) {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

// A deterministic hash of the email, used only to check for duplicate signups
// without ever storing or comparing plaintext.
function emailLookupHash(email) {
  const key = getKey();
  return crypto.createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex');
}

module.exports = { encrypt, decrypt, emailLookupHash };

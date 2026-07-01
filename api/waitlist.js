const { OAuth2Client } = require('google-auth-library');
const { encrypt, emailLookupHash } = require('../lib/crypto');
const { getPool } = require('../lib/db');

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const SCHOOL_TYPES = new Set(['independent', 'state', 'international']);

async function verifyGoogleCredential(credential) {
  if (!googleClient) return null;
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return payload && payload.email ? payload.email : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { school_name, email, school_type, country, google_credential } = req.body || {};

    let verifiedEmail = email;

    // If a Google credential was supplied, verify it server-side and prefer that email
    // over whatever the client sent, so a tampered form field can't spoof the address.
    if (google_credential) {
      const googleEmail = await verifyGoogleCredential(google_credential);
      if (googleEmail) verifiedEmail = googleEmail;
    }

    if (!school_name || typeof school_name !== 'string' || school_name.trim().length < 2) {
      return res.status(400).json({ error: 'A valid school name is required.' });
    }
    if (!verifiedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!SCHOOL_TYPES.has(school_type)) {
      return res.status(400).json({ error: 'A valid school type is required.' });
    }
    if (!country || typeof country !== 'string' || country.trim().length < 2) {
      return res.status(400).json({ error: 'A valid country is required.' });
    }

    const pool = getPool();
    const lookupHash = emailLookupHash(verifiedEmail);

    const existing = await pool.query(
      'SELECT id FROM waitlist_entries WHERE email_lookup_hash = $1 LIMIT 1',
      [lookupHash]
    );
    if (existing.rows.length > 0) {
      // Already on the list — respond success without creating a duplicate row.
      return res.status(200).json({ ok: true, already_registered: true });
    }

    const encryptedEmail = encrypt(verifiedEmail);

    await pool.query(
      `INSERT INTO waitlist_entries (school_name, email_encrypted, email_lookup_hash, school_type, country, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        school_name.trim(),
        encryptedEmail,
        lookupHash,
        school_type,
        country.trim(),
        google_credential ? 'google' : 'manual'
      ]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('waitlist submit error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

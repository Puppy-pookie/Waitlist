// Run locally with your production DATABASE_URL and WAITLIST_ENCRYPTION_KEY set:
//   DATABASE_URL=... WAITLIST_ENCRYPTION_KEY=... node scripts/decrypt-entries.js
//
// Prints a CSV of all waitlist entries with emails decrypted, to stdout.
// Redirect to a file if you want to save it: `node scripts/decrypt-entries.js > waitlist.csv`

const { getPool } = require('../lib/db');
const { decrypt } = require('../lib/crypto');

(async () => {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT school_name, email_encrypted, school_type, country, source, created_at FROM waitlist_entries ORDER BY created_at ASC'
  );

  console.log('school_name,email,school_type,country,source,created_at');
  for (const row of rows) {
    let email;
    try {
      email = decrypt(row.email_encrypted);
    } catch (e) {
      email = '[decryption failed]';
    }
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    console.log(
      [esc(row.school_name), esc(email), esc(row.school_type), esc(row.country), esc(row.source), esc(row.created_at.toISOString())].join(',')
    );
  }

  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

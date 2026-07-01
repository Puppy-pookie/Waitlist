# SchoolGrid waitlist

Minimal, premium waitlist landing page for the SchoolGrid UK pilot cohort. Static
front end + one serverless API route + Postgres, emails encrypted at rest.

## What's in here

```
public/           the site itself (static HTML/CSS/JS — deploy as-is)
  index.html
  styles.css
  script.js        lattice animation + form + Google Sign-In wiring
  config.js        put your Google Client ID here (safe to expose client-side)
api/waitlist.js    serverless function: validates, verifies Google token, encrypts, stores
lib/crypto.js      AES-256-GCM encrypt/decrypt helpers
lib/db.js          Postgres connection
schema.sql         run this once against your database
scripts/decrypt-entries.js   exports the waitlist as CSV with emails decrypted
```

## 1. Database — Neon (serverless Postgres, free tier)

1. Create a project at https://neon.tech
2. Copy the connection string it gives you (starts `postgresql://...`)
3. Run `schema.sql` against it — easiest via Neon's SQL editor in the dashboard, or:
   ```
   psql "$DATABASE_URL" -f schema.sql
   ```

This matches your existing Postgres setup for SchoolGrid itself, so it'll be a
straightforward merge later if you consolidate the two.

## 2. Google Sign-In

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID, type "Web application"
3. Add your deployed domain (e.g. `https://waitlist.schoolgrid.com`) under
   **Authorized JavaScript origins** — Google Sign-In will not work on a domain
   that isn't listed here, including Vercel's default `*.vercel.app` preview URLs
   if you want previews to work too
4. Copy the Client ID into **both**:
   - `public/config.js` (`window.GOOGLE_CLIENT_ID = "..."`)
   - your deployment's `GOOGLE_CLIENT_ID` environment variable (used server-side to verify tokens)

The manual form (school name / email / type / country) still works without this
configured — Google Sign-In is an optional faster path, not a requirement.

## 3. Encryption key

Generate a 32-byte key once, and never regenerate it (doing so makes existing
encrypted emails unreadable):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it as `WAITLIST_ENCRYPTION_KEY` in your deployment environment. Never commit
it to git.

## 4. Deploy — Vercel

```
npm install
vercel
```

Then in the Vercel dashboard, add the three environment variables from
`.env.example` (`DATABASE_URL`, `WAITLIST_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`)
under Project Settings → Environment Variables, and redeploy.

## Alternative — Cloudflare Pages

Cloudflare Pages is a reasonable alternative if you want the API running at the
edge globally (relevant since you're not targeting one region) and cheaper
scaling. The move over is small:

- `public/` deploys as-is as the Pages static output
- `api/waitlist.js` becomes `functions/api/waitlist.js`, using the Pages
  Functions signature (`export async function onRequestPost(context) {}`)
  instead of `module.exports = (req, res) => {}` — the validation/encryption
  logic in `lib/crypto.js` and `lib/db.js` carries over almost unchanged
- Postgres (Neon) still works fine from Cloudflare Workers/Pages via the `pg`
  package, or you can switch to Neon's HTTP driver (`@neondatabase/serverless`)
  which is built for edge runtimes

Not built out here to keep this deliverable to one deploy path — say the word
if you want the Cloudflare version built out too.

## Exporting the list

You'll never see plaintext emails in the database — only you can decrypt them,
and only with the key:

```
DATABASE_URL=... WAITLIST_ENCRYPTION_KEY=... npm run decrypt-entries > waitlist.csv
```

## Notes

- Duplicate signups (same email) are silently deduplicated server-side via a
  keyed hash — no plaintext email comparison happens anywhere.
- The form is intentionally short: school name, email, type, country. Resist
  adding more fields here — better to follow up with a short call once someone's
  on the list than to lose signups to form fatigue.
- Add a one-line privacy note near the form before this goes live publicly —
  worth having even informally, given you're collecting data from UK-based
  schools (GDPR territory).

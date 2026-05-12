# Agent Safety Rules

Agents working in this repo must not read, print, edit, stage, commit, or upload:

- `.env`, `.env.*`, secret files, credentials, key files, browser cookies, or provider dashboard exports
- Supabase service-role keys, Clerk secrets, Groq/Anthropic/OpenAI keys, Google Maps keys, or Vercel tokens
- Production database rows or backups unless explicitly requested for a narrow, read-only audit

Agents must not run destructive commands without explicit approval:

- `git reset --hard`, `git checkout --`, force pushes, branch deletion
- Supabase migrations, SQL writes, table truncation, or production DB mutations
- Bulk deletes such as `rm -rf`

Default safety posture:

- Use `.env.example` and source references instead of `.env*`.
- Treat all API routes as authenticated unless a public route is explicitly documented.
- Run `npm run typecheck`, `npm test`, `npm run build`, and `npm audit` before shipping security-sensitive changes.

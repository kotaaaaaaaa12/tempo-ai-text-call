# tempo

`tempo` is a mobile-first live AI text-call app. The user types without a send button, the current turn is submitted after a short pause, and the reply streams in through the OpenAI Responses API.

The frontend and API run from one Cloudflare Worker. Google sign-in and synchronized personalization use Supabase Auth and Postgres Row Level Security.

## Features

- Minimal mobile interface with light and dark themes
- Send-button-free text calls with a 900 ms pause detector
- Japanese IME handling with a 1,100 ms fallback for iOS Safari
- A persistent live draft that stays editable until the user clears it
- OpenAI Responses API streaming over server-sent events
- Optional Google sign-in with PKCE
- Guest settings stored only on the device
- Signed-in settings synchronized between devices
- Personalized user name, AI name, tone, reply length, and remembered context
- Conversation transcripts kept only in memory and never uploaded to Supabase
- Row Level Security so each account can access only its own profile

## Local setup

Requirements: Node.js 20 or newer and an OpenAI API key.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Set `OPENAI_API_KEY` in `.dev.vars`, then run:

```bash
npm run dev
```

Google login is optional. The app continues to work in guest mode until Supabase is configured.

## Google sign-in setup

### 1. Create the profile table

Create a Supabase project. Open its SQL Editor, paste the entire contents of `supabase/schema.sql`, and run it. The included policies allow signed-in users to access only their own profile row.

### 2. Configure Google

In Google Auth Platform:

1. Create an OAuth client with the **Web application** type.
2. Add the deployed Worker origin under **Authorized JavaScript origins**. Example: `https://tempo-ai-text-call.example.workers.dev`.
3. Add the Supabase callback shown on the Supabase Google provider page under **Authorized redirect URIs**. It normally looks like `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Copy the Google Client ID and Client Secret into **Supabase > Authentication > Sign In / Providers > Google**, then enable the provider.

In **Supabase > Authentication > URL Configuration**:

- Set **Site URL** to the deployed Worker URL.
- Add the same deployed Worker URL to **Redirect URLs**.
- Add the local Wrangler URL only when testing Google login locally.

### 3. Add Cloudflare runtime variables

Copy the Project URL and publishable key from the Supabase project settings. In **Cloudflare > Worker > Settings > Variables and Secrets**, add:

- `SUPABASE_URL` — for example `https://YOUR_PROJECT_REF.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` — starts with `sb_publishable_` on new projects

These two values are public browser configuration, not private server secrets. Keep `OPENAI_API_KEY` as an encrypted secret. Redeploy after adding the values.

After redeploying, open `/api/health` on the deployed domain. `authReady` must be `true`. If it is `false`, open `/api/config`; its `missing` list shows the exact runtime variable name Cloudflare did not provide.

The older Supabase anonymous key also works under `SUPABASE_ANON_KEY`, but the publishable key is preferred.

## Checks

```bash
npm run check
```

## Deploy from GitHub

This repository is ready for Cloudflare Workers Builds.

1. Put the extracted project files at the GitHub repository root.
2. In Cloudflare, connect the repository to a Worker.
3. Use these build settings:
   - Production branch: `main`
   - Build command: leave blank
   - Deploy command: `npm run deploy`
   - Non-production deploy command: `npx wrangler versions upload`
   - Root directory: `/`
4. Keep the Worker name as `tempo-ai-text-call`, or update `name` in `wrangler.jsonc`.
5. Add `OPENAI_API_KEY` as an encrypted runtime secret.
6. Add the two Supabase runtime variables described above.
7. Trigger another deployment.

The committed browser bundle allows the previous `npx wrangler deploy` command to work too. `npm run deploy` is recommended because it rebuilds the browser bundle before deployment.

## Personalization behavior

- Guests keep settings in browser storage.
- Google users synchronize settings through the `profiles` table.
- The current settings are sent with each OpenAI request so the server can set the AI name, tone, reply length, and relevant user context.
- Remembered text is treated as untrusted user background, not as system instructions.
- Calls and transcripts are not stored in Supabase or OpenAI by this project. OpenAI requests use `store: false`.

## Production notes

The included rate limit is intentionally small and in memory. Before a public launch, add a durable limiter, usage budgets, abuse monitoring, and an appropriate moderation strategy for streamed output. Login is optional in this version, so it does not yet protect API spending by itself.

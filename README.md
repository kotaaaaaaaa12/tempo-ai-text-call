# tempo

`tempo` is a mobile-first live AI text-call app. The user types without a send button, the current turn is submitted after a short pause, and the reply streams in through the OpenAI Responses API.

The frontend and API run from one Cloudflare Worker. Google or email/password sign-in and synchronized personalization use Supabase Auth and Postgres Row Level Security.

## Project structure

```text
src/
  client/              Browser application source
  server/              Cloudflare Worker and API protocol
  shared/              Browser-safe shared stream utilities
public/
  assets/css/          Styles
  assets/icons/        PWA and browser icons
  assets/js/           Generated browser bundle
  index.html            Application shell
  manifest.webmanifest PWA manifest
  sw.js                 Service worker
supabase/
  schema.sql            Idempotent database schema and policies
tests/                  Protocol, DOM, schema, and stream tests
```

Keep `public/assets/js/app.js` committed for direct Worker deploys, but edit `src/client/app.js` instead and regenerate the bundle with `npm run build`.

## Features

- Minimal mobile interface with light and dark themes
- Default, coral, blue, violet, and green accent choices while preserving the original look for existing users
- Small, standard, and large interface text sizes with iOS input zoom protection
- Auto, full, reduced, and disabled animation settings with system reduced-motion support
- English and Japanese UI with Auto, English, and Japanese language settings
- Adjustable send timing: 0.9 seconds, 1.5 seconds, 2.5 seconds, or Enter only
- Japanese IME handling with an extra composition delay for iOS Safari
- A persistent live draft that stays editable until the user clears it
- OpenAI Responses API streaming over server-sent events
- Optional AI-generated reply and memory action chips between the two speaker panels
- General, Study, English practice, Brainstorm, Advice, and Custom conversation modes
- Optional Google sign-in with PKCE and email/password sign-up
- Guest settings stored only on the device
- Signed-in settings synchronized between devices
- Standing personalization instructions included in every call
- Explicit memory approval: suggested details are remembered only after the user taps the action
- One settings hub with General, AI, Memory, History, and Account tabs
- Saved memories shown as individual entries that can be added or removed
- Optional signed-in conversation history, disabled by default
- History resume/delete, personalization reset, and permanent account deletion with reusable confirmation modals
- Safari-friendly modal focus that opens on a non-interactive heading instead of a close button
- Confirmation dialogs restore focus to an invisible passive heading instead of the settings dialog container
- Unsaved settings confirmation before closing with the close button or Escape
- Saving settings keeps the current tab and scroll position open for continued adjustments
- An inline saved status above the save button remains visible until another setting is changed
- The call summary returns to the home screen instead of immediately starting another call
- Fixed settings footer with only the active tab panel scrolling vertically
- Installable PWA shell with offline launch and an in-app update action
- Row Level Security so each account can access only its own profile and conversations

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

Sign-in is optional. The app continues to work in guest mode until Supabase is configured.

## Sign-in setup

### 1. Create the profile table

Create a Supabase project. Open its SQL Editor, paste the entire contents of `supabase/schema.sql`, and run it. The included policies allow signed-in users to access only their own profile and conversation rows.

Run the same file again after updating an existing deployment. It safely adds the new settings columns, private conversation history, and the authenticated account-deletion function without replacing existing rows.

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

### 3. Configure email and password

In **Supabase > Authentication > Sign In / Providers > Email**, enable the Email provider and keep **Confirm email** enabled for public use.

Supabase's built-in mailer is limited and intended only for testing. For production, connect Cloudflare Email Sending to Supabase as custom SMTP:

- Host: `smtp.mx.cloudflare.net`
- Port: `465`
- Username: `api_token`
- Password: a Cloudflare API token with **Email Sending: Edit** permission
- Sender email: an address on the onboarded domain, such as `welcome@what-the-fuck.men`
- Sender name: `tempo`

Configure these values in **Supabase > Authentication > SMTP Settings**. Do not add the SMTP token to the repository or browser code. Email Routing is only for incoming mail and is not required for sign-up confirmations.

### 4. Add Cloudflare runtime variables

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
- Signed-in users synchronize settings through the `profiles` table.
- Auto language uses Japanese only when the browser's primary language is Japanese. Every other browser language uses English.
- The current settings are sent with each OpenAI request so the server can set the AI name, tone, reply length, conversation mode, standing personalization, and relevant user context. Interface-only appearance settings are ignored by the AI.
- Remembered text is treated as untrusted user background, not as system instructions.
- Suggested memories are never saved automatically; the user must tap the clearly labeled memory action. A safe client-side fallback adds that approval action when the model omits it after a direct remember request.
- Conversation history is off by default and requires sign-in. When enabled, the app saves only to the signed-in user's RLS-protected rows in Supabase.
- OpenAI requests use `store: false` regardless of the history setting.

## PWA updates

The app registers `public/sw.js`. API requests are never cached. The static app shell uses network-first loading and falls back to the cached shell when offline. When a new worker is waiting, Settings shows **Update app**. On iPhone, use Safari's Share menu and **Add to Home Screen**.

## Production notes

The included rate limit is intentionally small and in memory. Before a public launch, add a durable limiter, usage budgets, abuse monitoring, and an appropriate moderation strategy for streamed output. Login is optional in this version, so it does not yet protect API spending by itself.

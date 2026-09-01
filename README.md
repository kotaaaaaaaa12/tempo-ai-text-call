# tempoo

`tempo` is a mobile-first AI text-call web app. The user types without a send button, the current turn is submitted after a short pause, and the AI reply appears incrementally through the OpenAI Responses API.

The frontend and API run from one Cloudflare Worker deployment. The OpenAI API key remains in a Worker secret and is never sent to the browser.

## Features

- Send-button-free text calls with a 900 ms pause detector
- OpenAI Responses API streaming over server-sent events
- Japanese IME composition handling with a 1,100 ms fallback for iOS Safari
- A persistent live draft that stays editable until the user clears it
- Interruption support with `AbortController`
- Mobile Safari viewport and safe-area handling
- Auto, light, and dark themes
- Three conversation tones
- In-memory transcript with copy support
- Same-origin checks, input validation, security headers, a safety identifier, and a basic per-isolate rate limit
- No service worker, which avoids stale CSS and JavaScript after a deployment

## Local setup

Requirements: Node.js 20 or newer and an OpenAI API key.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set `OPENAI_API_KEY`, then start the Worker:

```bash
npm run dev
```

Open the local URL printed by Wrangler. The default model is `gpt-5.6-luna`; override it with `OPENAI_MODEL` if needed.

## Checks

```bash
npm run check
```

## Deploy from GitHub

This repository is ready for Cloudflare Workers Builds. No GitHub Actions workflow or local Wrangler login is required.

1. Create a GitHub repository and put the extracted project files at its root.
2. In Cloudflare, open **Workers & Pages**, create a Worker, and connect the GitHub repository.
3. Use these build settings:
   - Production branch: `main`
   - Build command: leave blank
   - Deploy command: `npx wrangler deploy`
   - Non-production deploy command: `npx wrangler versions upload`
   - Root directory: `/`
4. Keep the Worker name as `tempo-ai-text-call`, or change the `name` value in `wrangler.jsonc` to match it.
5. Open the Worker's **Settings > Variables & Secrets** and add `OPENAI_API_KEY` as an encrypted runtime secret.
6. Trigger another deployment after adding the secret.

Do not add `OPENAI_API_KEY` as a build variable. Cloudflare build variables are unavailable to the Worker at runtime.

The default model is already configured in the code. To override it, add `OPENAI_MODEL` under runtime variables and secrets.

Every push to `main` will deploy the production Worker. Non-production branches can produce preview versions when branch builds are enabled.

## Architecture

1. The browser keeps the current call and transcript in memory.
2. After the user stops typing for 900 ms, the browser posts up to 12 recent turns to `/api/respond`. Active Japanese composition uses a 1,100 ms fallback so iOS Safari cannot block the request indefinitely.
3. The Worker validates the request and calls `POST /v1/responses` with `stream: true`.
4. The Worker passes the SSE stream through to the browser.
5. The browser renders `response.output_text.delta` events as they arrive.
6. The typed text remains in the input. Continuing to type updates the same user turn and replaces its earlier AI response instead of duplicating partial drafts in history.
7. Clearing the input marks the start of a new user turn. New input also aborts an active response, which creates text-call-style interruption.

## Production notes

The included rate limit is intentionally small and in memory. Before a public launch, add authentication and a durable limiter with Cloudflare Durable Objects or KV. Also add usage budgets, abuse monitoring, and a moderation approach appropriate for streamed output. OpenAI notes that partial streamed output is harder to moderate than a completed response.

The transcript is not persisted by this project. If history is added later, clearly disclose retention and deletion behavior before storing any conversation.

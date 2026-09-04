import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every element requested by the app exists in the document", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);

  const documentIds = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
  const requestedIds = new Set(Array.from(app.matchAll(/querySelector\("#([^"]+)"\)/g), (match) => match[1]));

  assert.equal(documentIds.size, Array.from(html.matchAll(/\bid="([^"]+)"/g)).length, "Document IDs must be unique");
  for (const id of requestedIds) {
    assert.ok(documentIds.has(id), `Missing element #${id}`);
  }
});

test("the web app manifest is valid JSON", async () => {
  const source = await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
  const manifest = JSON.parse(source);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("the application shell uses organized versioned asset paths", async () => {
  const [html, worker] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /\/assets\/css\/app\.css\?v=23/);
  assert.match(html, /\/assets\/js\/app\.js\?v=23/);
  assert.match(html, /\/assets\/icons\/favicon\.svg/);
  assert.match(worker, /tempo-shell-v23/);
  assert.doesNotMatch(worker, /"\/sse\.js"/);
});

test("the hang-up control uses a filled handset icon", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/css/app.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="end-call"[\s\S]*?<svg[^>]*viewBox="0 0 24 24"[\s\S]*?<path d="M12 7C7\.44 7/);
  assert.match(css, /\.hangup-button svg\s*\{[^}]*fill:\s*currentColor/s);
  assert.doesNotMatch(css, /\.hangup-button svg\s*\{[^}]*fill:\s*none/s);
});

test("the call summary returns home instead of offering an immediate call again", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="back-home"[^>]+data-i18n="backHome">Back to home<\/button>/);
  assert.doesNotMatch(html, /id="call-again"|data-i18n="callAgain"/);
  assert.match(app, /function backHome\(\)\s*\{\s*setScreen\("start"\)/);
  assert.match(app, /backHome: "ホームに戻る"/);
  assert.match(app, /elements\.backHome\.addEventListener\("click", backHome\)/);
});

test("new controls include central actions, tabbed settings, memory, history, and PWA update UI", async () => {
  const [html, serviceWorker] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /class="assistant-actions is-hidden" id="assistant-actions"/);
  assert.ok(html.indexOf('id="assistant-actions"') < html.indexOf('id="user-panel"'));
  assert.match(html, /id="send-delay-select"/);
  assert.match(html, /id="mode-select"/);
  assert.match(html, /id="save-history-input"/);
  assert.match(html, /id="settings-panel-history"/);
  assert.match(html, /id="settings-panel-memory"/);
  assert.match(html, /id="memory-list"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="delete-account"/);
  assert.match(html, /id="confirm-dialog"/);
  assert.doesNotMatch(html, /id="account-dialog"/);
  assert.doesNotMatch(html, /id="history-dialog"/);
  assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /SKIP_WAITING/);
});

test("Google sign-in remains actionable and dialogs focus passive headings on Safari", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/css/app.css", import.meta.url), "utf8")
  ]);

  for (const titleId of ["settings-title", "confirm-title"]) {
    assert.match(html, new RegExp(`id="${titleId}"[^>]+data-dialog-focus[^>]+tabindex="-1"`));
  }
  assert.doesNotMatch(html, /<dialog[^>]+tabindex=/);
  assert.match(app, /dialog\.querySelector\("\[data-dialog-focus\]"\)/);
  assert.doesNotMatch(app, /dialog\.focus\(/);
  assert.match(app, /function settleFocusAfterConfirmation\(\)/);
  assert.match(app, /settingsDialog\.querySelector\("\[data-dialog-focus\]"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /queueMicrotask\(settle\)/);
  assert.match(app, /requestAnimationFrame\(settle\)/);
  assert.match(css, /\.app-dialog:focus,[\s\S]*?\.app-dialog:focus-visible\s*\{\s*outline:\s*none/);
  assert.doesNotMatch(html, /id="google-sign-in"[^>]+disabled/);
  assert.doesNotMatch(app, /googleSignIn\.disabled\s*=/);
});

test("all destructive confirmations use the reusable dialog instead of browser alerts", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="cancel-confirm"/);
  assert.match(html, /id="confirm-action"/);
  assert.match(app, /deleteAccount\.addEventListener\("click", requestAccountDeletion\)/);
  assert.match(app, /clearHistory\.addEventListener\("click", requestHistoryClear\)/);
  assert.match(app, /requestConversationDeletion\(record\.id, item\)/);
  assert.match(app, /resetPersonalization\.addEventListener\("click", requestPersonalizationReset\)/);
  assert.doesNotMatch(app, /window\.confirm/);
  assert.doesNotMatch(app, /deleteAccountConfirm/);
});

test("closing edited settings opens the reusable unsaved-changes dialog", async () => {
  const app = await readFile(new URL("../src/client/app.js", import.meta.url), "utf8");
  assert.match(app, /function hasUnsavedSettings\(\)/);
  assert.match(app, /titleKey: "unsavedChangesTitle"/);
  assert.match(app, /confirmKey: "discardChanges"/);
  assert.match(app, /cancelKey: "keepEditing"/);
  assert.match(app, /settingsDialog\.addEventListener\("cancel"/);
  assert.match(app, /closeSettings\.addEventListener\("click", \(\) => closeSettings\(\)\)/);
});

test("saving settings keeps the dialog open and resets the dirty snapshot", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/css/app.css", import.meta.url), "utf8")
  ]);
  const saveFunction = app.match(/async function saveSettings\(event\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(saveFunction, /state\.formDraft = \{ \.\.\.state\.settings \}/);
  assert.match(saveFunction, /showSettingsSaveStatus/);
  assert.doesNotMatch(saveFunction, /closeSettings/);
  assert.ok(html.indexOf('id="settings-save-status"') < html.indexOf('id="save-settings"'));
  assert.match(html, /id="settings-save-status"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(css, /\.settings-save-status\.is-visible/);
  assert.match(app, /settingsForm\.addEventListener\("input", clearSettingsSaveStatus\)/);
  assert.match(html, /id="settings-form"[^>]+novalidate/);
  assert.match(html, /id="save-settings"[^>]+formnovalidate/);
  assert.doesNotMatch(html, /id="auth-(?:email|password)"[^>]+required/);
});

test("settings tabs fit without horizontal scrolling and only the panel scrolls", async () => {
  const css = await readFile(new URL("../public/assets/css/app.css", import.meta.url), "utf8");
  assert.match(css, /\.settings-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.settings-tabs\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.settings-panels\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.settings-form\s*\{[^}]*overflow:\s*hidden/s);
});

test("appearance settings provide accents, text sizing, and motion without a density control", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/css/app.css", import.meta.url), "utf8")
  ]);

  for (const id of ["accent-control", "font-size-select", "motion-select"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /density|表示間隔/i);
  assert.match(app, /VALID_ACCENTS/);
  assert.match(app, /VALID_FONT_SIZES/);
  assert.match(app, /VALID_MOTION/);
  assert.match(app, /applyAccent\(state\.settings\.accent, state\.settings\.customAccent\)/);
  assert.match(app, /dataset\.fontSize = state\.settings\.fontSize/);
  assert.match(app, /dataset\.motion = state\.settings\.motion/);
  assert.match(css, /:root\[data-accent="blue"\]/);
  for (const accent of ["blue", "green", "yellow", "pink", "orange", "purple", "default", "custom"]) {
    assert.match(html, new RegExp(`data-accent="${accent}"`));
  }
  assert.match(html, /id="custom-accent-input"[^>]+type="color"/);
  assert.match(app, /function updateCustomAccentDraft\(\)/);
  assert.match(app, /readableTextColor\(color\)/);
  assert.doesNotMatch(html, /data-accent="(?:coral|violet)"/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /:root\[data-font-size="large"\]/);
  assert.match(css, /:root\[data-font-size="small"\]\s*\{\s*font-size:\s*0\.875rem/);
  assert.match(css, /:root\[data-font-size="large"\]\s*\{\s*font-size:\s*1\.1875rem/);
  assert.match(css, /:root\[data-motion="none"\]/);
  assert.match(css, /font-size:\s*max\(1rem, 16px\)/);
});

test("Japanese interface copy is friendly in conversation and clear for actions", async () => {
  const app = await readFile(new URL("../src/client/app.js", import.meta.url), "utf8");
  assert.match(app, /talkTo: "\{name\}と話そう。"/);
  assert.match(app, /startTyping: "ここに入力…"/);
  assert.match(app, /openingNamed: "\{name\}さん、こんにちは。今日は何を話そうか？"/);
  assert.match(app, /chooseAction: "選択肢を押すか、そのまま入力してください。"/);
  assert.match(app, /historySignIn: "履歴を利用するにはログインしてください。"/);
  assert.doesNotMatch(app, /話しましょう|入力してみましょう|何を話しますか/);
});

test("account and settings open the unified settings hub with three language choices", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);

  assert.match(app, /accountButton\.addEventListener\("click", \(\) => openSettings\("account"\)\)/);
  assert.match(app, /settingsButton\.addEventListener\("click", \(\) => openSettings\("general"\)\)/);
  assert.match(app, /selectSettingsTab\(tabName\)/);
  assert.match(html, /<option value="auto">Auto<\/option>/);
  assert.match(html, /<option value="en">English<\/option>/);
  assert.match(html, /<option value="ja">日本語<\/option>/);
  assert.match(app, /startsWith\("ja"\) \? "ja" : "en"/);
});

test("account settings support Google and email password authentication", async () => {
  const [html, app, workerConfig] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
  ]);

  for (const id of ["auth-options", "google-sign-in", "email-auth", "auth-email", "auth-password", "email-auth-submit"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-auth-mode="signIn"[^>]+aria-pressed="true"/);
  assert.match(html, /data-auth-mode="signUp"[^>]+aria-pressed="false"/);
  assert.match(html, /id="auth-password"[^>]+autocomplete="current-password"[^>]+minlength="8"/);
  assert.match(app, /supabase\.auth\.signInWithPassword\(\{ email, password \}\)/);
  assert.match(app, /supabase\.auth\.signUp\(\{[\s\S]*?emailRedirectTo: `\$\{window\.location\.origin\}\//);
  assert.match(app, /emailAuth\.addEventListener\("keydown"/);
  assert.match(app, /event\.preventDefault\(\);\s*void submitEmailAuth\(\)/);
  assert.match(app, /authOptions\.classList\.add\("is-hidden"\)/);
  assert.doesNotMatch(workerConfig, /send_email|"EMAIL"/);
});

test("standing personalization is editable, synchronized, and sent with every response", async () => {
  const [html, app, protocol] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/server/protocol.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="personalization-input"[^>]+maxlength="1000"/);
  assert.match(app, /personalization: elements\.personalizationInput\.value/);
  assert.match(app, /body: JSON\.stringify\(\{ messages: state\.messages, profile: state\.settings \}\)/);
  assert.match(app, /personalization: state\.settings\.personalization/);
  assert.match(protocol, /Standing personalization preferences supplied by the user and included in every conversation/);
});

test("remember requests receive a client-side approval action fallback", async () => {
  const app = await readFile(new URL("../src/client/app.js", import.meta.url), "utf8");
  assert.match(app, /ensureRememberAction\(parsedActions, latestUserText, translate\("rememberThis"\)\)/);
  assert.match(app, /if \(type === "remember"\)/);
});

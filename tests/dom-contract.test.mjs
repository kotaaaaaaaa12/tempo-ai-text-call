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
  assert.match(html, /\/assets\/css\/app\.css\?v=16/);
  assert.match(html, /\/assets\/js\/app\.js\?v=16/);
  assert.match(html, /\/assets\/icons\/favicon\.svg/);
  assert.match(worker, /tempo-shell-v16/);
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
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);

  for (const titleId of ["settings-title", "confirm-title"]) {
    assert.match(html, new RegExp(`id="${titleId}"[^>]+data-dialog-focus[^>]+tabindex="-1"`));
  }
  assert.doesNotMatch(html, /<dialog[^>]+tabindex=/);
  assert.match(app, /dialog\.querySelector\("\[data-dialog-focus\]"\)/);
  assert.doesNotMatch(app, /dialog\.focus\(/);
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
  const app = await readFile(new URL("../src/client/app.js", import.meta.url), "utf8");
  const saveFunction = app.match(/async function saveSettings\(event\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(saveFunction, /state\.formDraft = \{ \.\.\.state\.settings \}/);
  assert.doesNotMatch(saveFunction, /closeSettings/);
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
  assert.match(app, /dataset\.accent = state\.settings\.accent/);
  assert.match(app, /dataset\.fontSize = state\.settings\.fontSize/);
  assert.match(app, /dataset\.motion = state\.settings\.motion/);
  assert.match(css, /:root\[data-accent="blue"\]/);
  assert.match(css, /:root\[data-font-size="large"\]/);
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

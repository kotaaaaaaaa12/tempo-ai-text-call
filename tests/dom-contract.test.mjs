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
  assert.match(html, /\/assets\/css\/app\.css\?v=11/);
  assert.match(html, /\/assets\/js\/app\.js\?v=11/);
  assert.match(html, /\/assets\/icons\/favicon\.svg/);
  assert.match(worker, /tempo-shell-v11/);
  assert.doesNotMatch(worker, /"\/sse\.js"/);
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

test("account and settings open the unified settings hub with three language choices", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/client/app.js", import.meta.url), "utf8")
  ]);

  assert.match(app, /accountButton\.addEventListener\("click", \(\) => openSettings\("account"\)\)/);
  assert.match(app, /settingsButton\.addEventListener\("click", openSettings\)/);
  assert.match(app, /selectSettingsTab\(tabName\)/);
  assert.match(html, /<option value="auto">Auto<\/option>/);
  assert.match(html, /<option value="en">English<\/option>/);
  assert.match(html, /<option value="ja">日本語<\/option>/);
  assert.match(app, /startsWith\("ja"\) \? "ja" : "en"/);
});

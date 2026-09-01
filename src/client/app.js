import { createClient } from "@supabase/supabase-js";
import { completedText, eventError, parseSseBuffer, textDelta } from "../../public/sse.js";

const SEND_DELAY_MS = 900;
const COMPOSITION_SEND_DELAY_MS = 1100;
const MAX_INPUT_CHARS = 280;
const HISTORY_LIMIT = 12;
const SETTINGS_KEY = "tempo-settings-v2";
const VALID_TONES = new Set(["casual", "thoughtful", "direct"]);
const VALID_LENGTHS = new Set(["short", "balanced", "detailed"]);
const VALID_THEMES = new Set(["auto", "light", "dark"]);
const VALID_LANGUAGES = new Set(["auto", "en", "ja"]);

const DEFAULT_SETTINGS = Object.freeze({
  displayName: "",
  aiName: "Nova",
  tone: "casual",
  replyLength: "short",
  memory: "",
  theme: "auto",
  language: "auto"
});

const TRANSLATIONS = {
  en: {
    documentTitle: "tempo — AI text calls",
    metaDescription: "A live AI text call that replies as you pause.",
    liveCall: "Live AI text call",
    talkTo: "Talk to {name}.",
    homeLede: "Just type. Your AI replies when you pause.",
    startCall: "Start call",
    notSaved: "Conversations are not saved.",
    openSettings: "Open settings",
    endCall: "End call",
    you: "You",
    startTyping: "Start typing…",
    yourMessage: "Your message",
    updatesAfterPause: "Updates after you pause",
    callEnded: "Call ended",
    wrapTitle: "That’s a wrap.",
    duration: "Duration",
    turns: "Turns",
    transcript: "Transcript",
    callAgain: "Call again",
    copyTranscript: "Copy transcript",
    accountEyebrow: "Account",
    accountTitle: "Sign in",
    accountPanelTitle: "Account",
    closeAccount: "Close account",
    continueGoogle: "Continue with Google",
    signOut: "Sign out",
    accountNote: "Sign in to sync personalization between devices.",
    personalize: "Personalize",
    settings: "Settings",
    closeSettings: "Close settings",
    callYou: "What should the AI call you?",
    yourName: "Your name",
    aiName: "AI name",
    tone: "Tone",
    casual: "Casual",
    thoughtful: "Thoughtful",
    direct: "Direct",
    replyLength: "Reply length",
    short: "Short",
    balanced: "Balanced",
    detailed: "Detailed",
    remember: "Things to remember",
    memoryPlaceholder: "Interests, goals, preferences…",
    memoryNote: "Only saved when you choose Save. Conversation transcripts are never included.",
    language: "Language",
    appearance: "Appearance",
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    saveSettings: "Save settings",
    connected: "Connected",
    connectionLost: "Connection lost",
    openingNamed: "Hey {name} — what’s on your mind?",
    opening: "Hey — what’s on your mind?",
    guest: "Guest",
    deviceOnly: "Settings stay on this device",
    checkingSignIn: "Checking Google sign-in…",
    syncOn: "Personalization sync is on",
    googleAccount: "Google account",
    signedInNeedsSchema: "Signed in; run supabase/schema.sql to sync",
    localSaved: "Settings saved on this device",
    synced: "Settings synced",
    cloudFailed: "Saved on this device; cloud sync failed",
    signedOut: "Signed out",
    transcriptCopied: "Transcript copied",
    transcriptCopyFailed: "Could not copy the transcript",
    apiMissing: "The API key is not connected to this Worker yet.",
    apiMissingToast: "Add OPENAI_API_KEY under this Worker's runtime secrets, then redeploy.",
    workerUnavailable: "I could not reach the Worker API.",
    replyConnectionLost: "I lost the connection. Keep typing to try again.",
    responseUnavailable: "The response service is unavailable.",
    typingFast: "You are typing a little too fast. Try again in a moment.",
    callConnected: "Call connected",
    connectionRestored: "Connection restored",
    thinking: "{name} is thinking",
    replying: "{name} is replying",
    stopped: "{name} stopped replying",
    finished: "{name} finished replying",
    authMissing: "Missing Cloudflare runtime variable: {names}",
    authSetupError: "Google sign-in setup error: {message}",
    authLoadError: "Google sign-in setup could not be loaded"
  },
  ja: {
    documentTitle: "tempo — AI文字通話",
    metaDescription: "入力が止まるとAIが返事するリアルタイム文字通話。",
    liveCall: "リアルタイムAI文字通話",
    talkTo: "{name}と話そう。",
    homeLede: "文字を打つだけ。入力が止まるとAIが返事します。",
    startCall: "通話を始める",
    notSaved: "会話内容は保存されません。",
    openSettings: "設定を開く",
    endCall: "通話を終了",
    you: "あなた",
    startTyping: "入力してみよう…",
    yourMessage: "あなたのメッセージ",
    updatesAfterPause: "入力が止まると更新します",
    callEnded: "通話終了",
    wrapTitle: "おつかれさま。",
    duration: "通話時間",
    turns: "ターン数",
    transcript: "会話ログ",
    callAgain: "もう一度話す",
    copyTranscript: "会話ログをコピー",
    accountEyebrow: "アカウント",
    accountTitle: "ログイン",
    accountPanelTitle: "アカウント",
    closeAccount: "アカウント画面を閉じる",
    continueGoogle: "Googleで続ける",
    signOut: "ログアウト",
    accountNote: "ログインすると端末間でパーソナライズ設定を同期できます。",
    personalize: "パーソナライズ",
    settings: "設定",
    closeSettings: "設定を閉じる",
    callYou: "AIから何と呼ばれたい？",
    yourName: "あなたの名前",
    aiName: "AIの名前",
    tone: "話し方",
    casual: "カジュアル",
    thoughtful: "落ち着き",
    direct: "率直",
    replyLength: "返答の長さ",
    short: "短め",
    balanced: "ふつう",
    detailed: "詳しく",
    remember: "覚えてほしいこと",
    memoryPlaceholder: "興味、目標、好みなど…",
    memoryNote: "「設定を保存」を押した時だけ保存します。会話ログは含まれません。",
    language: "言語",
    appearance: "外観",
    auto: "自動",
    light: "ライト",
    dark: "ダーク",
    saveSettings: "設定を保存",
    connected: "接続済み",
    connectionLost: "接続が切れました",
    openingNamed: "やあ、{name}。今日は何を話す？",
    opening: "やあ。今日は何を話す？",
    guest: "ゲスト",
    deviceOnly: "設定はこの端末に保存されます",
    checkingSignIn: "Googleログインを確認中…",
    syncOn: "パーソナライズ設定を同期中",
    googleAccount: "Googleアカウント",
    signedInNeedsSchema: "ログイン済み。同期にはsupabase/schema.sqlの実行が必要です",
    localSaved: "この端末に設定を保存しました",
    synced: "設定を同期しました",
    cloudFailed: "端末には保存しましたが、同期に失敗しました",
    signedOut: "ログアウトしました",
    transcriptCopied: "会話ログをコピーしました",
    transcriptCopyFailed: "会話ログをコピーできませんでした",
    apiMissing: "このWorkerにAPIキーが接続されていません。",
    apiMissingToast: "WorkerのランタイムSecretにOPENAI_API_KEYを追加して再デプロイしてください。",
    workerUnavailable: "Worker APIに接続できませんでした。",
    replyConnectionLost: "接続が切れました。入力を続けると再試行します。",
    responseUnavailable: "現在、応答サービスを利用できません。",
    typingFast: "入力が少し速すぎます。少し待って試してください。",
    callConnected: "通話に接続しました",
    connectionRestored: "接続が戻りました",
    thinking: "{name}が考えています",
    replying: "{name}が返答しています",
    stopped: "{name}が返答を停止しました",
    finished: "{name}が返答しました",
    authMissing: "Cloudflareのランタイム変数が見つかりません: {names}",
    authSetupError: "Googleログインの設定エラー: {message}",
    authLoadError: "Googleログイン設定を読み込めませんでした"
  }
};

const elements = {
  screens: {
    start: document.querySelector("#start-screen"),
    call: document.querySelector("#call-screen"),
    end: document.querySelector("#end-screen")
  },
  accountButton: document.querySelector("#account-button"),
  accountDialog: document.querySelector("#account-dialog"),
  accountTitle: document.querySelector("#account-title"),
  closeAccount: document.querySelector("#close-account"),
  settingsButton: document.querySelector("#settings-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  settingsForm: document.querySelector("#settings-form"),
  closeSettings: document.querySelector("#close-settings"),
  googleSignIn: document.querySelector("#google-sign-in"),
  signOut: document.querySelector("#sign-out"),
  accountName: document.querySelector("#account-name"),
  accountStatus: document.querySelector("#account-status"),
  displayNameInput: document.querySelector("#display-name-input"),
  aiNameInput: document.querySelector("#ai-name-input"),
  memoryInput: document.querySelector("#memory-input"),
  languageSelect: document.querySelector("#language-select"),
  themeSelect: document.querySelector("#theme-select"),
  toneControl: document.querySelector("#tone-control"),
  lengthControl: document.querySelector("#length-control"),
  aiNameLabels: document.querySelectorAll("[data-ai-name]"),
  startTitle: document.querySelector("#start-title"),
  startCall: document.querySelector("#start-call"),
  endCall: document.querySelector("#end-call"),
  callAgain: document.querySelector("#call-again"),
  copyTranscript: document.querySelector("#copy-transcript"),
  userPanel: document.querySelector("#user-panel"),
  messageInput: document.querySelector("#message-input"),
  aiCopy: document.querySelector("#ai-copy"),
  characterCount: document.querySelector("#character-count"),
  sendHint: document.querySelector("#send-hint"),
  connectionLabel: document.querySelector("#connection-label"),
  srStatus: document.querySelector("#sr-status"),
  callTimer: document.querySelector("#call-timer"),
  finalDuration: document.querySelector("#final-duration"),
  finalTurns: document.querySelector("#final-turns"),
  transcript: document.querySelector("#transcript"),
  toast: document.querySelector("#toast")
};

const state = {
  screen: "start",
  settings: readSettings(),
  formDraft: null,
  composing: false,
  sendTimer: 0,
  callStartedAt: 0,
  timerInterval: 0,
  durationSeconds: 0,
  messages: [],
  liveUserIndex: -1,
  liveAssistantIndex: -1,
  lastSubmittedText: "",
  deletingCurrentTurn: false,
  activeRequest: null,
  toastTimer: 0,
  clientId: getClientId(),
  supabase: null,
  authUser: null,
  loadedProfileFor: "",
  authConfigured: false,
  authInitializing: false,
  authProblem: null,
  locale: "en"
};

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
}

function normalizeSettings(value) {
  const candidate = value && typeof value === "object" ? value : {};
  return {
    displayName: typeof candidate.displayName === "string" ? candidate.displayName.trim().slice(0, 40) : "",
    aiName: typeof candidate.aiName === "string" && candidate.aiName.trim()
      ? candidate.aiName.trim().slice(0, 40)
      : DEFAULT_SETTINGS.aiName,
    tone: VALID_TONES.has(candidate.tone) ? candidate.tone : DEFAULT_SETTINGS.tone,
    replyLength: VALID_LENGTHS.has(candidate.replyLength) ? candidate.replyLength : DEFAULT_SETTINGS.replyLength,
    memory: typeof candidate.memory === "string" ? candidate.memory.trim().slice(0, 500) : "",
    theme: VALID_THEMES.has(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme,
    language: VALID_LANGUAGES.has(candidate.language) ? candidate.language : DEFAULT_SETTINGS.language
  };
}

function readSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(stored ? JSON.parse(stored) : DEFAULT_SETTINGS);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function storeSettings() {
  writePreference(SETTINGS_KEY, JSON.stringify(state.settings));
}

function getClientId() {
  const existing = readPreference("tempo-client-id", "");
  if (existing) return existing;
  const value = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writePreference("tempo-client-id", value);
  return value;
}

function resolveLocale(language) {
  if (language === "ja") return "ja";
  if (language === "en") return "en";
  const browserLanguage = navigator.languages?.[0] || navigator.language || "en";
  return String(browserLanguage).toLowerCase().startsWith("ja") ? "ja" : "en";
}

function translate(key, variables = {}) {
  const template = TRANSLATIONS[state.locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(variables[name] ?? ""));
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = translate("documentTitle");
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute("content", translate("metaDescription"));

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = translate(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", translate(element.dataset.i18nPlaceholder));
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  }

  elements.startTitle.textContent = translate("talkTo", { name: aiName() });
  const status = elements.screens.call.dataset.status;
  elements.connectionLabel.textContent = translate(status === "offline" ? "connectionLost" : "connected");
}

function aiName() {
  return state.settings.aiName || DEFAULT_SETTINGS.aiName;
}

function openingLine() {
  return state.settings.displayName
    ? translate("openingNamed", { name: state.settings.displayName })
    : translate("opening");
}

function setScreen(name) {
  state.screen = name;
  for (const [screenName, screen] of Object.entries(elements.screens)) {
    const active = screenName === name;
    screen.classList.toggle("is-active", active);
    screen.toggleAttribute("inert", !active);
    screen.setAttribute("aria-hidden", String(!active));
  }
}

function setStatus(status, announcement) {
  elements.screens.call.dataset.status = status;
  elements.connectionLabel.textContent = translate(status === "offline" ? "connectionLost" : "connected");
  if (announcement) elements.srStatus.textContent = announcement;
}

function applySettings() {
  state.locale = resolveLocale(state.settings.language);
  if (state.settings.theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = state.settings.theme;
  }
  applyTranslations();
  for (const label of elements.aiNameLabels) label.textContent = aiName();
  elements.startTitle.textContent = translate("talkTo", { name: aiName() });
  renderAccount();
}

function fillSettingsForm() {
  state.formDraft = { ...state.settings };
  elements.displayNameInput.value = state.formDraft.displayName;
  elements.aiNameInput.value = state.formDraft.aiName;
  elements.memoryInput.value = state.formDraft.memory;
  elements.languageSelect.value = state.formDraft.language;
  elements.themeSelect.value = state.formDraft.theme;
  applyChoiceState(elements.toneControl, "tone", state.formDraft.tone);
  applyChoiceState(elements.lengthControl, "length", state.formDraft.replyLength);
}

function applyChoiceState(control, key, value) {
  for (const button of control.querySelectorAll(`[data-${key}]`)) {
    button.setAttribute("aria-pressed", String(button.dataset[key] === value));
  }
}

function selectChoice(event, key) {
  const button = event.target.closest(`[data-${key}]`);
  if (!button || !state.formDraft) return;
  const value = button.dataset[key];
  if (key === "tone" && VALID_TONES.has(value)) state.formDraft.tone = value;
  if (key === "length" && VALID_LENGTHS.has(value)) state.formDraft.replyLength = value;
  applyChoiceState(event.currentTarget, key, value);
}

function showDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  dialog.focus({ preventScroll: true });
  window.requestAnimationFrame(() => dialog.focus({ preventScroll: true }));
}

function openAccount() {
  renderAccount();
  showDialog(elements.accountDialog);
}

function openSettings() {
  fillSettingsForm();
  showDialog(elements.settingsDialog);
}

function closeAccount() {
  if (elements.accountDialog.open) elements.accountDialog.close();
}

function closeSettings() {
  if (elements.settingsDialog.open) elements.settingsDialog.close();
}

async function saveSettings(event) {
  event.preventDefault();
  const next = normalizeSettings({
    ...state.formDraft,
    displayName: elements.displayNameInput.value,
    aiName: elements.aiNameInput.value,
    memory: elements.memoryInput.value,
    language: elements.languageSelect.value,
    theme: elements.themeSelect.value
  });
  state.settings = next;
  storeSettings();
  applySettings();

  if (state.authUser && state.supabase) {
    const saved = await saveCloudProfile();
    showToast(translate(saved ? "synced" : "cloudFailed"));
  } else {
    showToast(translate("localSaved"));
  }
  closeSettings();
}

async function initAuth(showProblem = false) {
  if (state.supabase) return true;
  if (state.authInitializing) return false;
  state.authInitializing = true;
  elements.googleSignIn.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json();
    const auth = config?.auth;
    if (!response.ok || !auth?.ready || !auth.url || !auth.publishableKey) {
      state.authConfigured = false;
      const missing = Array.isArray(auth?.missing) ? auth.missing.join(" and ") : "Supabase configuration";
      state.authProblem = { key: "authMissing", variables: { names: missing } };
      if (showProblem) showToast(translate(state.authProblem.key, state.authProblem.variables));
      return false;
    }

    state.authConfigured = true;
    state.authProblem = null;
    state.supabase = createClient(auth.url, auth.publishableKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    });

    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    await handleSession(data.session);
    cleanAuthCallbackUrl();

    state.supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void handleSession(session), 0);
    });
    return true;
  } catch (error) {
    state.authConfigured = false;
    state.authProblem = error instanceof Error
      ? { key: "authSetupError", variables: { message: error.message } }
      : { key: "authLoadError", variables: {} };
    if (showProblem) showToast(translate(state.authProblem.key, state.authProblem.variables));
    state.supabase = null;
    return false;
  } finally {
    state.authInitializing = false;
    elements.googleSignIn.removeAttribute("aria-busy");
    renderAccount();
  }
}

function cleanAuthCallbackUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code")) return;
  url.searchParams.delete("code");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

async function handleSession(session) {
  const previousUserId = state.authUser?.id || "";
  state.authUser = session?.user || null;
  renderAccount();

  if (!state.authUser) {
    state.loadedProfileFor = "";
    return;
  }

  if (state.loadedProfileFor === state.authUser.id && previousUserId === state.authUser.id) return;
  state.loadedProfileFor = state.authUser.id;
  await loadCloudProfile();
}

function renderAccount() {
  if (state.authUser) {
    const metadataName = state.authUser.user_metadata?.full_name || state.authUser.user_metadata?.name;
    const label = state.settings.displayName || metadataName || state.authUser.email || "Account";
    elements.accountButton.textContent = String(label).split(/\s+/)[0].slice(0, 14);
    elements.accountTitle.textContent = translate("accountPanelTitle");
    elements.accountName.textContent = String(metadataName || state.authUser.email || translate("googleAccount"));
    elements.accountStatus.textContent = translate("syncOn");
    elements.googleSignIn.classList.add("is-hidden");
    elements.signOut.classList.remove("is-hidden");
    return;
  }

  elements.accountButton.textContent = translate("accountTitle");
  elements.accountTitle.textContent = translate("accountTitle");
  elements.accountName.textContent = translate("guest");
  elements.accountStatus.textContent = state.authConfigured
    ? translate("deviceOnly")
    : state.authProblem
      ? translate(state.authProblem.key, state.authProblem.variables)
      : translate("checkingSignIn");
  elements.googleSignIn.classList.remove("is-hidden");
  elements.signOut.classList.add("is-hidden");
}

async function signInWithGoogle() {
  if (!state.supabase) {
    const ready = await initAuth(true);
    if (!ready || !state.supabase) return;
  }

  const { error } = await state.supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/` }
  });
  if (error) showToast(error.message);
}

async function signOut() {
  if (!state.supabase) return;
  const { error } = await state.supabase.auth.signOut();
  if (error) {
    showToast(error.message);
    return;
  }
  state.authUser = null;
  state.loadedProfileFor = "";
  renderAccount();
  showToast(translate("signedOut"));
}

async function loadCloudProfile() {
  if (!state.supabase || !state.authUser) return;
  let { data, error } = await state.supabase
    .from("profiles")
    .select("display_name,ai_name,tone,reply_length,memory,theme,language")
    .eq("id", state.authUser.id)
    .maybeSingle();

  if (error && /language/i.test(error.message || "")) {
    const fallback = await state.supabase
      .from("profiles")
      .select("display_name,ai_name,tone,reply_length,memory,theme")
      .eq("id", state.authUser.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    elements.accountStatus.textContent = translate("signedInNeedsSchema");
    return;
  }

  if (data) {
    state.settings = normalizeSettings({
      displayName: data.display_name,
      aiName: data.ai_name,
      tone: data.tone,
      replyLength: data.reply_length,
      memory: data.memory,
      theme: data.theme,
      language: data.language ?? state.settings.language
    });
    storeSettings();
    applySettings();
    renderAccount();
    return;
  }

  const googleName = state.authUser.user_metadata?.full_name || state.authUser.user_metadata?.name || "";
  if (!state.settings.displayName && googleName) {
    state.settings.displayName = String(googleName).split(/\s+/)[0].slice(0, 40);
    storeSettings();
    applySettings();
  }
  await saveCloudProfile();
  renderAccount();
}

async function saveCloudProfile() {
  if (!state.supabase || !state.authUser) return false;
  const { error } = await state.supabase.from("profiles").upsert({
    id: state.authUser.id,
    display_name: state.settings.displayName,
    ai_name: state.settings.aiName,
    tone: state.settings.tone,
    reply_length: state.settings.replyLength,
    memory: state.settings.memory,
    theme: state.settings.theme,
    language: state.settings.language,
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  return !error;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateTimer() {
  state.durationSeconds = Math.max(0, Math.floor((Date.now() - state.callStartedAt) / 1000));
  const formatted = formatDuration(state.durationSeconds);
  elements.callTimer.textContent = formatted;
  elements.callTimer.dateTime = `PT${state.durationSeconds}S`;
}

function startCall() {
  clearTimeout(state.sendTimer);
  abortActiveResponse(false);
  state.messages = [{ role: "assistant", content: openingLine() }];
  state.liveUserIndex = -1;
  state.liveAssistantIndex = -1;
  state.lastSubmittedText = "";
  state.deletingCurrentTurn = false;
  state.callStartedAt = Date.now();
  state.durationSeconds = 0;
  elements.aiCopy.textContent = state.messages[0].content;
  elements.aiCopy.classList.remove("is-streaming");
  elements.messageInput.value = "";
  updateInputState();
  updateTimer();
  clearInterval(state.timerInterval);
  state.timerInterval = window.setInterval(updateTimer, 1000);
  setStatus("ready", translate("callConnected"));
  setScreen("call");
  elements.messageInput.focus({ preventScroll: true });
  void verifyApiConnection();
  window.requestAnimationFrame(() => elements.messageInput.focus({ preventScroll: true }));
}

async function verifyApiConnection() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const health = await response.json();
    if (!response.ok || !health.ready) {
      elements.aiCopy.textContent = translate("apiMissing");
      setStatus("offline", translate("apiMissing"));
      showToast(translate("apiMissingToast"));
    }
  } catch {
    elements.aiCopy.textContent = translate("workerUnavailable");
    setStatus("offline", translate("workerUnavailable"));
  }
}

function endCall() {
  clearTimeout(state.sendTimer);
  clearInterval(state.timerInterval);
  abortActiveResponse(true);
  updateTimer();
  renderTranscript();
  elements.finalDuration.textContent = formatDuration(state.durationSeconds);
  elements.finalTurns.textContent = String(state.messages.filter((message) => message.role === "user").length);
  setScreen("end");
}

function callAgain() {
  setScreen("start");
  window.setTimeout(() => elements.startCall.focus(), 100);
}

function updateInputState() {
  const length = Array.from(elements.messageInput.value).length;
  const content = elements.messageInput.value.trim();
  elements.characterCount.textContent = `${length} / ${MAX_INPUT_CHARS}`;
  elements.sendHint.classList.toggle("is-counting", Boolean(content) && content !== state.lastSubmittedText);
}

function scheduleSend() {
  clearTimeout(state.sendTimer);
  if (!elements.messageInput.value.trim()) return;
  const delay = state.composing ? COMPOSITION_SEND_DELAY_MS : SEND_DELAY_MS;
  state.sendTimer = window.setTimeout(sendDraft, delay);
}

function handleInput() {
  updateInputState();
  if (state.activeRequest) abortActiveResponse(true);

  const content = elements.messageInput.value.trim();
  if (!content) {
    clearTimeout(state.sendTimer);
    state.liveUserIndex = -1;
    state.liveAssistantIndex = -1;
    state.lastSubmittedText = "";
    state.deletingCurrentTurn = false;
    return;
  }

  if (state.lastSubmittedText && content.length < state.lastSubmittedText.length && state.lastSubmittedText.startsWith(content)) {
    clearTimeout(state.sendTimer);
    state.deletingCurrentTurn = true;
    return;
  }

  state.deletingCurrentTurn = false;
  scheduleSend();
}

function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey && !state.composing) {
    event.preventDefault();
    clearTimeout(state.sendTimer);
    void sendDraft();
  }
}

function beginComposition() {
  state.composing = true;
  clearTimeout(state.sendTimer);
  scheduleSend();
}

function endComposition() {
  state.composing = false;
  window.requestAnimationFrame(() => {
    updateInputState();
    scheduleSend();
  });
}

async function sendDraft() {
  if (state.screen !== "call" || state.activeRequest) return;
  const content = elements.messageInput.value.trim();
  if (!content || content === state.lastSubmittedText || state.deletingCurrentTurn) return;

  updateLiveUserSnapshot(content);
  updateInputState();

  const controller = new AbortController();
  const requestState = { controller, text: "", settled: false };
  state.activeRequest = requestState;
  elements.aiCopy.textContent = "";
  elements.aiCopy.classList.add("is-streaming");
  setStatus("thinking", translate("thinking", { name: aiName() }));

  try {
    const response = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Id": state.clientId },
      body: JSON.stringify({ messages: state.messages, profile: state.settings }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) throw new Error(await safeErrorMessage(response));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.rest;

      for (const streamEvent of parsed.events) {
        const streamError = eventError(streamEvent);
        if (streamError) throw new Error(streamError);
        const delta = textDelta(streamEvent);
        const finalText = requestState.text ? "" : completedText(streamEvent);
        const nextText = delta || finalText;
        if (!nextText) continue;
        requestState.text += nextText;
        elements.aiCopy.textContent = requestState.text;
        elements.aiCopy.scrollTop = elements.aiCopy.scrollHeight;
        setStatus("replying", translate("replying", { name: aiName() }));
      }

      if (done) {
        const tail = parseSseBuffer(`${buffer}\n\n`);
        for (const streamEvent of tail.events) {
          const streamError = eventError(streamEvent);
          if (streamError) throw new Error(streamError);
          const delta = textDelta(streamEvent);
          const finalText = requestState.text ? "" : completedText(streamEvent);
          requestState.text += delta || finalText;
        }
        if (requestState.text) elements.aiCopy.textContent = requestState.text;
        break;
      }
    }

    settleResponse(requestState, false);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      settleResponse(requestState, true);
      return;
    }
    settleResponse(requestState, true);
    elements.aiCopy.textContent = translate("replyConnectionLost");
    setStatus("offline", translate("connectionLost"));
    showToast(error instanceof Error ? error.message : translate("replyConnectionLost"));
  }
}

function settleResponse(requestState, interrupted) {
  if (requestState.settled) return;
  requestState.settled = true;
  if (requestState.text.trim()) {
    const content = requestState.text.trim();
    if (state.liveAssistantIndex >= 0 && state.messages[state.liveAssistantIndex]) {
      state.messages[state.liveAssistantIndex].content = content;
    } else {
      state.messages.push({ role: "assistant", content });
      state.liveAssistantIndex = state.messages.length - 1;
      trimHistory();
    }
  }
  if (state.activeRequest === requestState) state.activeRequest = null;
  elements.aiCopy.classList.remove("is-streaming");
  setStatus("ready", translate(interrupted ? "stopped" : "finished", { name: aiName() }));
}

function updateLiveUserSnapshot(content) {
  if (state.liveAssistantIndex >= 0 && state.messages[state.liveAssistantIndex]) {
    state.messages.splice(state.liveAssistantIndex, 1);
    if (state.liveUserIndex > state.liveAssistantIndex) state.liveUserIndex -= 1;
    state.liveAssistantIndex = -1;
  }
  if (state.liveUserIndex >= 0 && state.messages[state.liveUserIndex]?.role === "user") {
    state.messages[state.liveUserIndex].content = content;
  } else {
    state.messages.push({ role: "user", content });
    state.liveUserIndex = state.messages.length - 1;
  }
  state.lastSubmittedText = content;
  trimHistory();
}

function trimHistory() {
  const overflow = state.messages.length - HISTORY_LIMIT;
  if (overflow <= 0) return;
  state.messages = state.messages.slice(overflow);
  state.liveUserIndex = Math.max(-1, state.liveUserIndex - overflow);
  state.liveAssistantIndex = Math.max(-1, state.liveAssistantIndex - overflow);
}

function abortActiveResponse(keepPartial) {
  const requestState = state.activeRequest;
  if (!requestState) return;
  requestState.controller.abort();
  if (!keepPartial) requestState.text = "";
  settleResponse(requestState, true);
}

async function safeErrorMessage(response) {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // Fall through to the status-based message.
  }
  return translate(response.status === 429 ? "typingFast" : "responseUnavailable");
}

function renderTranscript() {
  elements.transcript.replaceChildren();
  for (const message of state.messages) {
    const item = document.createElement("div");
    const name = document.createElement("strong");
    const copy = document.createElement("p");
    item.className = "transcript-item";
    name.textContent = message.role === "assistant" ? aiName() : translate("you");
    copy.textContent = message.content;
    item.append(name, copy);
    elements.transcript.append(item);
  }
}

async function copyTranscript() {
  const text = state.messages.map((message) => `${message.role === "assistant" ? aiName() : translate("you")}: ${message.content}`).join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast(translate("transcriptCopied"));
  } catch {
    showToast(translate("transcriptCopyFailed"));
  }
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function updateViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

elements.accountButton.addEventListener("click", openAccount);
elements.closeAccount.addEventListener("click", closeAccount);
elements.settingsButton.addEventListener("click", openSettings);
elements.closeSettings.addEventListener("click", closeSettings);
elements.settingsForm.addEventListener("submit", saveSettings);
elements.googleSignIn.addEventListener("click", signInWithGoogle);
elements.signOut.addEventListener("click", signOut);
elements.toneControl.addEventListener("click", (event) => selectChoice(event, "tone"));
elements.lengthControl.addEventListener("click", (event) => selectChoice(event, "length"));
elements.startCall.addEventListener("click", startCall);
elements.endCall.addEventListener("click", endCall);
elements.callAgain.addEventListener("click", callAgain);
elements.copyTranscript.addEventListener("click", copyTranscript);
elements.userPanel.addEventListener("click", () => elements.messageInput.focus({ preventScroll: true }));
elements.messageInput.addEventListener("input", handleInput);
elements.messageInput.addEventListener("keydown", handleKeyDown);
elements.messageInput.addEventListener("compositionstart", beginComposition);
elements.messageInput.addEventListener("compositionend", endComposition);
window.visualViewport?.addEventListener("resize", updateViewportHeight);
window.visualViewport?.addEventListener("scroll", updateViewportHeight);
window.addEventListener("resize", updateViewportHeight);
window.addEventListener("pagehide", () => abortActiveResponse(false));
window.addEventListener("online", () => state.screen === "call" && setStatus("ready", translate("connectionRestored")));
window.addEventListener("offline", () => state.screen === "call" && setStatus("offline", translate("connectionLost")));

applySettings();
updateViewportHeight();
setScreen("start");
renderAccount();
void initAuth();

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

const DEFAULT_SETTINGS = Object.freeze({
  displayName: "",
  aiName: "Nova",
  tone: "casual",
  replyLength: "short",
  memory: "",
  theme: "auto"
});

const elements = {
  screens: {
    start: document.querySelector("#start-screen"),
    call: document.querySelector("#call-screen"),
    end: document.querySelector("#end-screen")
  },
  accountButton: document.querySelector("#account-button"),
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
  themeSelect: document.querySelector("#theme-select"),
  toneControl: document.querySelector("#tone-control"),
  lengthControl: document.querySelector("#length-control"),
  aiNameLabels: document.querySelectorAll("[data-ai-name]"),
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
  authConfigured: false
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
    theme: VALID_THEMES.has(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme
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

function aiName() {
  return state.settings.aiName || DEFAULT_SETTINGS.aiName;
}

function openingLine() {
  return state.settings.displayName
    ? `Hey ${state.settings.displayName} — what’s on your mind?`
    : "Hey — what’s on your mind?";
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
  elements.connectionLabel.textContent = status === "offline" ? "Connection lost" : "Connected";
  if (announcement) elements.srStatus.textContent = announcement;
}

function applySettings() {
  if (state.settings.theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = state.settings.theme;
  }
  for (const label of elements.aiNameLabels) label.textContent = aiName();
}

function fillSettingsForm() {
  state.formDraft = { ...state.settings };
  elements.displayNameInput.value = state.formDraft.displayName;
  elements.aiNameInput.value = state.formDraft.aiName;
  elements.memoryInput.value = state.formDraft.memory;
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

function openSettings() {
  fillSettingsForm();
  renderAccount();
  if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
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
    theme: elements.themeSelect.value
  });
  state.settings = next;
  storeSettings();
  applySettings();

  if (state.authUser && state.supabase) {
    const saved = await saveCloudProfile();
    showToast(saved ? "Settings synced" : "Saved on this device; cloud sync failed");
  } else {
    showToast("Settings saved on this device");
  }
  closeSettings();
}

async function initAuth() {
  elements.googleSignIn.disabled = true;
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json();
    const auth = config?.auth;
    if (!response.ok || !auth?.ready || !auth.url || !auth.publishableKey) {
      state.authConfigured = false;
      renderAccount();
      return;
    }

    state.authConfigured = true;
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
  } catch {
    state.authConfigured = false;
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
    elements.accountName.textContent = String(metadataName || state.authUser.email || "Google account");
    elements.accountStatus.textContent = "Personalization sync is on";
    elements.googleSignIn.classList.add("is-hidden");
    elements.signOut.classList.remove("is-hidden");
    return;
  }

  elements.accountButton.textContent = "Sign in";
  elements.accountName.textContent = "Guest";
  elements.accountStatus.textContent = state.authConfigured
    ? "Settings stay on this device"
    : "Google sign-in needs Supabase setup";
  elements.googleSignIn.classList.remove("is-hidden");
  elements.googleSignIn.disabled = !state.authConfigured;
  elements.signOut.classList.add("is-hidden");
}

async function signInWithGoogle() {
  if (!state.supabase) {
    showToast("Add the Supabase URL and publishable key first");
    return;
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
  showToast("Signed out");
}

async function loadCloudProfile() {
  if (!state.supabase || !state.authUser) return;
  const { data, error } = await state.supabase
    .from("profiles")
    .select("display_name,ai_name,tone,reply_length,memory,theme")
    .eq("id", state.authUser.id)
    .maybeSingle();

  if (error) {
    elements.accountStatus.textContent = "Signed in; run supabase/schema.sql to sync";
    return;
  }

  if (data) {
    state.settings = normalizeSettings({
      displayName: data.display_name,
      aiName: data.ai_name,
      tone: data.tone,
      replyLength: data.reply_length,
      memory: data.memory,
      theme: data.theme
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
  setStatus("ready", "Call connected");
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
      elements.aiCopy.textContent = "The API key is not connected to this Worker yet.";
      setStatus("offline", "API key not connected");
      showToast("Add OPENAI_API_KEY under this Worker's runtime secrets, then redeploy.");
    }
  } catch {
    elements.aiCopy.textContent = "I could not reach the Worker API.";
    setStatus("offline", "Worker API unavailable");
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
  setStatus("thinking", `${aiName()} is thinking`);

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
        setStatus("replying", `${aiName()} is replying`);
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
    elements.aiCopy.textContent = "I lost the connection. Keep typing to try again.";
    setStatus("offline", "Connection lost");
    showToast(error instanceof Error ? error.message : "The connection failed.");
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
  setStatus("ready", interrupted ? `${aiName()} stopped replying` : `${aiName()} finished replying`);
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
  return response.status === 429 ? "You are typing a little too fast. Try again in a moment." : "The response service is unavailable.";
}

function renderTranscript() {
  elements.transcript.replaceChildren();
  for (const message of state.messages) {
    const item = document.createElement("div");
    const name = document.createElement("strong");
    const copy = document.createElement("p");
    item.className = "transcript-item";
    name.textContent = message.role === "assistant" ? aiName() : "You";
    copy.textContent = message.content;
    item.append(name, copy);
    elements.transcript.append(item);
  }
}

async function copyTranscript() {
  const text = state.messages.map((message) => `${message.role === "assistant" ? aiName() : "You"}: ${message.content}`).join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    showToast("Transcript copied");
  } catch {
    showToast("Could not copy the transcript");
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

elements.accountButton.addEventListener("click", openSettings);
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
window.addEventListener("online", () => state.screen === "call" && setStatus("ready", "Connection restored"));
window.addEventListener("offline", () => state.screen === "call" && setStatus("offline", "Connection lost"));

applySettings();
updateViewportHeight();
setScreen("start");
renderAccount();
void initAuth();

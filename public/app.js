import { completedText, eventError, parseSseBuffer, textDelta } from "./sse.js?v=4";

const SEND_DELAY_MS = 900;
const COMPOSITION_SEND_DELAY_MS = 1100;
const MAX_INPUT_CHARS = 280;
const HISTORY_LIMIT = 12;
const THEME_ORDER = ["auto", "light", "dark"];

const elements = {
  screens: {
    start: document.querySelector("#start-screen"),
    call: document.querySelector("#call-screen"),
    end: document.querySelector("#end-screen")
  },
  themeButton: document.querySelector("#theme-button"),
  toneControl: document.querySelector("#tone-control"),
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
  tone: readPreference("tempo-tone", "casual"),
  theme: readPreference("tempo-theme", "auto"),
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
  clientId: getClientId()
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
    // The app still works when storage is blocked or unavailable.
  }
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

function applyTheme() {
  if (state.theme === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = state.theme;
  }
  elements.themeButton.setAttribute("aria-label", `Theme: ${state.theme}`);
  elements.themeButton.title = `Theme: ${state.theme}`;
}

function cycleTheme() {
  const index = THEME_ORDER.indexOf(state.theme);
  state.theme = THEME_ORDER[(index + 1) % THEME_ORDER.length];
  writePreference("tempo-theme", state.theme);
  applyTheme();
  showToast(`Theme: ${state.theme}`);
}

function applyTone() {
  const buttons = elements.toneControl.querySelectorAll("[data-tone]");
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.tone === state.tone));
  }
}

function selectTone(event) {
  const button = event.target.closest("[data-tone]");
  if (!button) return;
  state.tone = button.dataset.tone;
  writePreference("tempo-tone", state.tone);
  applyTone();
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
  state.messages = [{ role: "assistant", content: "Hey — what’s on your mind?" }];
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
  elements.sendHint.classList.toggle(
    "is-counting",
    Boolean(content) && content !== state.lastSubmittedText
  );
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

  if (
    state.lastSubmittedText
    && content.length < state.lastSubmittedText.length
    && state.lastSubmittedText.startsWith(content)
  ) {
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
  setStatus("thinking", "Nova is thinking");

  try {
    const response = await fetch("/api/respond", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": state.clientId
      },
      body: JSON.stringify({ messages: state.messages, tone: state.tone }),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const error = await safeErrorMessage(response);
      throw new Error(error);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.rest;

      for (const event of parsed.events) {
        const streamError = eventError(event);
        if (streamError) throw new Error(streamError);

        const delta = textDelta(event);
        const finalText = requestState.text ? "" : completedText(event);
        const nextText = delta || finalText;
        if (!nextText) continue;
        requestState.text += nextText;
        elements.aiCopy.textContent = requestState.text;
        elements.aiCopy.scrollTop = elements.aiCopy.scrollHeight;
        setStatus("replying", "Nova is replying");
      }

      if (done) {
        const tail = parseSseBuffer(`${buffer}\n\n`);
        for (const event of tail.events) {
          const streamError = eventError(event);
          if (streamError) throw new Error(streamError);
          const delta = textDelta(event);
          const finalText = requestState.text ? "" : completedText(event);
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
  setStatus("ready", interrupted ? "Nova stopped replying" : "Nova finished replying");
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
  return response.status === 429
    ? "You are typing a little too fast. Try again in a moment."
    : "The response service is unavailable.";
}

function renderTranscript() {
  elements.transcript.replaceChildren();
  for (const message of state.messages) {
    const item = document.createElement("div");
    const name = document.createElement("strong");
    const copy = document.createElement("p");
    item.className = "transcript-item";
    name.textContent = message.role === "assistant" ? "Nova" : "You";
    copy.textContent = message.content;
    item.append(name, copy);
    elements.transcript.append(item);
  }
}

async function copyTranscript() {
  const text = state.messages
    .map((message) => `${message.role === "assistant" ? "Nova" : "You"}: ${message.content}`)
    .join("\n\n");

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
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2200);
}

function updateViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

elements.themeButton.addEventListener("click", cycleTheme);
elements.toneControl.addEventListener("click", selectTone);
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

applyTheme();
applyTone();
updateViewportHeight();
setScreen("start");

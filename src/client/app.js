import { createClient } from "@supabase/supabase-js";
import {
  completedFunctionArguments,
  completedText,
  eventError,
  functionArgumentsDelta,
  parseSseBuffer,
  responseFunctionArguments,
  textDelta
} from "../shared/sse.js";

const MAX_INPUT_CHARS = 280;
const HISTORY_LIMIT = 12;
const SETTINGS_KEY = "tempo-settings-v2";
const VALID_TONES = new Set(["casual", "thoughtful", "direct"]);
const VALID_LENGTHS = new Set(["short", "balanced", "detailed"]);
const VALID_THEMES = new Set(["auto", "light", "dark"]);
const VALID_ACCENTS = new Set(["default", "coral", "blue", "violet", "green"]);
const VALID_FONT_SIZES = new Set(["small", "standard", "large"]);
const VALID_MOTION = new Set(["auto", "full", "reduced", "none"]);
const VALID_LANGUAGES = new Set(["auto", "en", "ja"]);
const VALID_SEND_DELAYS = new Set(["fast", "normal", "slow", "manual"]);
const VALID_MODES = new Set(["general", "study", "english", "brainstorm", "advice", "custom"]);
const SEND_DELAYS_MS = Object.freeze({ fast: 900, normal: 1500, slow: 2500 });

const DEFAULT_SETTINGS = Object.freeze({
  displayName: "",
  aiName: "Nova",
  tone: "casual",
  replyLength: "short",
  memory: "",
  theme: "auto",
  accent: "default",
  fontSize: "standard",
  motion: "auto",
  language: "auto",
  sendDelay: "normal",
  conversationMode: "general",
  customModePrompt: "",
  saveHistory: false
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
    savedWhenSignedIn: "History saves only while you are signed in.",
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
    backHome: "Back to home",
    copyTranscript: "Copy transcript",
    accountEyebrow: "Account",
    accountTitle: "Sign in",
    accountPanelTitle: "Account",
    closeAccount: "Close account",
    continueGoogle: "Continue with Google",
    or: "or",
    emailAuthTitle: "Email and password",
    emailAuthDescription: "Use the same account on any device.",
    emailAuthMode: "Email authentication mode",
    email: "Email",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    passwordHint: "Use at least 8 characters.",
    signIn: "Sign in",
    signUp: "Sign up",
    enterValidEmail: "Enter a valid email address.",
    passwordTooShort: "Password must be at least 8 characters.",
    checkEmail: "Check your email to confirm your account.",
    accountCreated: "Account created and signed in",
    signedIn: "Signed in",
    invalidCredentials: "The email or password is incorrect.",
    emailNotConfirmed: "Confirm your email before signing in.",
    emailAlreadyRegistered: "An account with this email already exists.",
    weakPassword: "Choose a stronger password.",
    emailRateLimited: "Too many email requests. Try again later.",
    signupDisabled: "Email sign-up is currently disabled.",
    emailAuthFailed: "Email authentication failed. Try again.",
    signOut: "Sign out",
    accountNote: "Sign in to sync personalization between devices.",
    personalize: "Personalize",
    settings: "Settings",
    closeSettings: "Close settings",
    settingsSections: "Settings sections",
    tabGeneral: "General",
    tabAI: "AI",
    tabMemory: "Memory",
    tabHistory: "History",
    tabAccount: "Account",
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
    savedMemories: "Saved memories",
    memoryDescription: "Details the AI can use in future calls.",
    memoryEmpty: "Nothing saved yet.",
    addMemory: "Add a memory",
    add: "Add",
    removeMemory: "Remove memory: {memory}",
    memoryNote: "Changes are applied when you save settings. Conversation transcripts are never included.",
    language: "Language",
    appearance: "Appearance",
    appearanceDescription: "Adjust the interface without changing how the AI talks.",
    theme: "Theme",
    accentColor: "Accent color",
    accentDefault: "Default",
    accentCoral: "Coral",
    accentBlue: "Blue",
    accentViolet: "Violet",
    accentGreen: "Green",
    fontSize: "Text size",
    fontSmall: "Small",
    fontStandard: "Standard",
    fontLarge: "Large",
    motion: "Animation",
    motionAuto: "Auto",
    motionFull: "Full",
    motionReduced: "Reduced",
    motionNone: "None",
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    saveSettings: "Save settings",
    settingsSaved: "Settings saved",
    unsavedChangesTitle: "Discard unsaved changes?",
    unsavedChangesDescription: "Your settings changes have not been saved.",
    keepEditing: "Keep editing",
    discardChanges: "Discard changes",
    connected: "Connected",
    connectionLost: "Connection lost",
    openingNamed: "Hey {name} — what’s on your mind?",
    opening: "Hey — what’s on your mind?",
    guest: "Guest",
    deviceOnly: "Settings stay on this device",
    checkingSignIn: "Checking sign-in…",
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
    authSetupError: "Sign-in setup error: {message}",
    authLoadError: "Sign-in setup could not be loaded",
    suggestedActions: "Suggested actions",
    chooseAction: "Choose an option, or keep typing.",
    conversationMode: "Conversation mode",
    modeGeneral: "General",
    modeStudy: "Study",
    modeEnglish: "English practice",
    modeBrainstorm: "Brainstorm",
    modeAdvice: "Advice",
    modeCustom: "Custom",
    customInstructions: "Custom mode instructions",
    customInstructionsPlaceholder: "How should this mode work?",
    sendTiming: "Send timing",
    sendFast: "Fast · 0.9 sec",
    sendNormal: "Normal · 1.5 sec",
    sendSlow: "Slow · 2.5 sec",
    sendManual: "Manual · Enter",
    sendHintFast: "Updates after 0.9 seconds",
    sendHintNormal: "Updates after 1.5 seconds",
    sendHintSlow: "Updates after 2.5 seconds",
    sendHintManual: "Press Enter to send",
    saveHistory: "Save conversation history",
    historyOffNote: "Off by default. Saved only to your signed-in account.",
    history: "History",
    yourCalls: "Your calls",
    closeHistory: "Close history",
    historyEmpty: "No saved calls yet.",
    historyLoading: "Loading saved calls…",
    historySignIn: "Sign in to use history.",
    historySaved: "Call saved to history",
    historySaveFailed: "Could not save this call. Run the latest supabase/schema.sql.",
    clearHistory: "Clear all history",
    clearHistoryConfirm: "Delete all saved calls?",
    clearHistoryDescription: "Every saved call in your account will be permanently deleted.",
    deleteCallConfirm: "Delete this saved call?",
    deleteCallDescription: "This saved call will be permanently deleted.",
    deleteCall: "Delete call",
    resumeCall: "Resume call",
    turnCount: "{count} turns",
    resetPersonalization: "Reset personalization",
    resetConfirm: "Reset AI name, tone, mode, and remembered details?",
    resetDescription: "Your general settings and saved call history will stay unchanged.",
    personalizationReset: "Personalization reset",
    deleteAccount: "Delete account",
    dangerZone: "Danger zone",
    confirm: "Please confirm",
    deleteAccountTitle: "Delete account?",
    deleteAccountDescription: "Your settings and saved calls will be permanently deleted. This cannot be undone.",
    cancel: "Cancel",
    accountDeleted: "Account deleted",
    accountDeleteFailed: "Could not delete the account. Run the latest supabase/schema.sql.",
    remembered: "Added to things to remember",
    memoryFull: "Things to remember is full",
    appInstall: "App install",
    appInstallNote: "Add tempo to your home screen and keep its app shell available offline.",
    installApp: "Add to Home Screen",
    updateApp: "Update app",
    installIos: "In Safari, tap Share, then Add to Home Screen.",
    installUnavailable: "Install is available from your browser menu.",
    appInstalled: "tempo is installed",
    historyNeedsLogin: "Sign in to save conversation history"
  },
  ja: {
    documentTitle: "tempo — AI文字通話",
    metaDescription: "入力が止まるとAIが返事するリアルタイム文字通話。",
    liveCall: "リアルタイムAI文字通話",
    talkTo: "{name}と話そう。",
    homeLede: "文字を打つだけ。入力が止まるとAIが返事します。",
    startCall: "通話を始める",
    notSaved: "会話内容は保存されません。",
    savedWhenSignedIn: "ログイン中だけ会話履歴を保存します。",
    openSettings: "設定を開く",
    endCall: "通話を終了",
    you: "あなた",
    startTyping: "ここに入力…",
    yourMessage: "あなたのメッセージ",
    updatesAfterPause: "入力が止まると更新します",
    callEnded: "通話終了",
    wrapTitle: "おつかれさま。",
    duration: "通話時間",
    turns: "ターン数",
    transcript: "会話ログ",
    backHome: "ホームに戻る",
    copyTranscript: "会話ログをコピー",
    accountEyebrow: "アカウント",
    accountTitle: "ログイン",
    accountPanelTitle: "アカウント",
    closeAccount: "アカウント画面を閉じる",
    continueGoogle: "Googleで続ける",
    or: "または",
    emailAuthTitle: "メールアドレスとパスワード",
    emailAuthDescription: "どの端末でも同じアカウントを利用できます。",
    emailAuthMode: "メール認証の切り替え",
    email: "メールアドレス",
    password: "パスワード",
    passwordPlaceholder: "8文字以上",
    passwordHint: "8文字以上で入力してください。",
    signIn: "ログイン",
    signUp: "新規登録",
    enterValidEmail: "有効なメールアドレスを入力してください。",
    passwordTooShort: "パスワードは8文字以上で入力してください。",
    checkEmail: "確認メールを送信しました。メール内のリンクを開いてください。",
    accountCreated: "アカウントを作成してログインしました",
    signedIn: "ログインしました",
    invalidCredentials: "メールアドレスまたはパスワードが違います。",
    emailNotConfirmed: "メールアドレスの確認後にログインしてください。",
    emailAlreadyRegistered: "このメールアドレスはすでに登録されています。",
    weakPassword: "より強いパスワードを設定してください。",
    emailRateLimited: "メール送信回数が多すぎます。しばらく待ってから試してください。",
    signupDisabled: "現在、メールでの新規登録は無効です。",
    emailAuthFailed: "メール認証に失敗しました。もう一度試してください。",
    signOut: "ログアウト",
    accountNote: "ログインすると端末間でパーソナライズ設定を同期できます。",
    personalize: "パーソナライズ",
    settings: "設定",
    closeSettings: "設定を閉じる",
    settingsSections: "設定項目",
    tabGeneral: "一般",
    tabAI: "AI",
    tabMemory: "メモリ",
    tabHistory: "履歴",
    tabAccount: "アカウント",
    callYou: "AIから何と呼ばれたいですか？",
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
    savedMemories: "保存されたメモリ",
    memoryDescription: "今後の通話でAIが使える情報です。",
    memoryEmpty: "保存されたメモリはまだありません。",
    addMemory: "メモリを追加",
    add: "追加",
    removeMemory: "メモリを削除: {memory}",
    memoryNote: "「設定を保存」を押すと変更されます。会話ログは含まれません。",
    language: "言語",
    appearance: "外観",
    appearanceDescription: "AIの話し方とは別に画面表示を調整できます。",
    theme: "テーマ",
    accentColor: "アクセントカラー",
    accentDefault: "標準",
    accentCoral: "コーラル",
    accentBlue: "ブルー",
    accentViolet: "パープル",
    accentGreen: "グリーン",
    fontSize: "文字サイズ",
    fontSmall: "小",
    fontStandard: "標準",
    fontLarge: "大",
    motion: "アニメーション",
    motionAuto: "自動",
    motionFull: "通常",
    motionReduced: "少なめ",
    motionNone: "なし",
    auto: "自動",
    light: "ライト",
    dark: "ダーク",
    saveSettings: "設定を保存",
    settingsSaved: "設定を保存しました",
    unsavedChangesTitle: "未保存の変更を破棄しますか？",
    unsavedChangesDescription: "設定の変更はまだ保存されていません。",
    keepEditing: "編集を続ける",
    discardChanges: "変更を破棄",
    connected: "接続済み",
    connectionLost: "接続が切れました",
    openingNamed: "{name}さん、こんにちは。今日は何を話そうか？",
    opening: "こんにちは。今日は何を話そうか？",
    guest: "ゲスト",
    deviceOnly: "設定はこの端末に保存されます",
    checkingSignIn: "ログイン状態を確認中…",
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
    authSetupError: "ログイン設定のエラー: {message}",
    authLoadError: "ログイン設定を読み込めませんでした",
    suggestedActions: "提案されたアクション",
    chooseAction: "選択肢を押すか、そのまま入力してください。",
    conversationMode: "会話モード",
    modeGeneral: "ふつう",
    modeStudy: "勉強",
    modeEnglish: "英会話",
    modeBrainstorm: "アイデア出し",
    modeAdvice: "相談",
    modeCustom: "カスタム",
    customInstructions: "カスタムモードの指示",
    customInstructionsPlaceholder: "どのようなモードにしますか？",
    sendTiming: "送信タイミング",
    sendFast: "速い · 0.9秒",
    sendNormal: "ふつう · 1.5秒",
    sendSlow: "ゆっくり · 2.5秒",
    sendManual: "手動 · Enter",
    sendHintFast: "0.9秒止まると更新します",
    sendHintNormal: "1.5秒止まると更新します",
    sendHintSlow: "2.5秒止まると更新します",
    sendHintManual: "Enterで送信します",
    saveHistory: "会話履歴を保存",
    historyOffNote: "初期設定はOFFです。ログイン中のアカウントにのみ保存されます。",
    history: "履歴",
    yourCalls: "あなたの通話",
    closeHistory: "履歴を閉じる",
    historyEmpty: "保存した通話はまだありません。",
    historyLoading: "保存した通話を読み込み中…",
    historySignIn: "履歴を利用するにはログインしてください。",
    historySaved: "会話を履歴に保存しました",
    historySaveFailed: "会話を保存できませんでした。最新のsupabase/schema.sqlを実行してください。",
    clearHistory: "履歴をすべて削除",
    clearHistoryConfirm: "保存した会話をすべて削除しますか？",
    clearHistoryDescription: "アカウントに保存されたすべての会話を完全に削除します。",
    deleteCallConfirm: "この会話を削除しますか？",
    deleteCallDescription: "この保存済み会話を完全に削除します。",
    deleteCall: "会話を削除",
    resumeCall: "通話を再開",
    turnCount: "{count}ターン",
    resetPersonalization: "パーソナライズをリセット",
    resetConfirm: "AIの名前・話し方・モード・覚えた内容をリセットしますか？",
    resetDescription: "一般設定と保存した会話履歴はそのまま残ります。",
    personalizationReset: "パーソナライズをリセットしました",
    deleteAccount: "アカウントを削除",
    dangerZone: "注意",
    confirm: "確認",
    deleteAccountTitle: "アカウントを削除しますか？",
    deleteAccountDescription: "設定と保存した会話を完全に削除します。この操作は元に戻せません。",
    cancel: "キャンセル",
    accountDeleted: "アカウントを削除しました",
    accountDeleteFailed: "アカウントを削除できませんでした。最新のsupabase/schema.sqlを実行してください。",
    remembered: "覚えてほしいことに追加しました",
    memoryFull: "保存できるメモリの上限に達しています",
    appInstall: "アプリとして使う",
    appInstallNote: "ホーム画面に追加して、アプリの画面をオフラインでも開けます。",
    installApp: "ホーム画面に追加",
    updateApp: "アプリを更新",
    installIos: "Safariの共有ボタンから「ホーム画面に追加」を選択してください。",
    installUnavailable: "ブラウザのメニューからインストールできます。",
    appInstalled: "tempoをインストールしました",
    historyNeedsLogin: "会話履歴を保存するにはログインしてください"
  }
};

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
  settingsTabs: document.querySelector(".settings-tabs"),
  settingsTabButtons: document.querySelectorAll("[data-settings-tab]"),
  settingsPanels: document.querySelectorAll("[data-settings-panel]"),
  authOptions: document.querySelector("#auth-options"),
  googleSignIn: document.querySelector("#google-sign-in"),
  emailAuth: document.querySelector("#email-auth"),
  emailAuthMode: document.querySelector("#email-auth-mode"),
  emailAuthModeButtons: document.querySelectorAll("[data-auth-mode]"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  emailAuthStatus: document.querySelector("#email-auth-status"),
  emailAuthSubmit: document.querySelector("#email-auth-submit"),
  signOut: document.querySelector("#sign-out"),
  accountActions: document.querySelector("#account-actions"),
  resetPersonalization: document.querySelector("#reset-personalization"),
  deleteAccount: document.querySelector("#delete-account"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmEyebrow: document.querySelector("#confirm-eyebrow"),
  confirmTitle: document.querySelector("#confirm-title"),
  confirmDescription: document.querySelector("#confirm-description"),
  cancelConfirm: document.querySelector("#cancel-confirm"),
  confirmAction: document.querySelector("#confirm-action"),
  accountName: document.querySelector("#account-name"),
  accountStatus: document.querySelector("#account-status"),
  displayNameInput: document.querySelector("#display-name-input"),
  aiNameInput: document.querySelector("#ai-name-input"),
  memoryList: document.querySelector("#memory-list"),
  memoryEmpty: document.querySelector("#memory-empty"),
  memoryAddInput: document.querySelector("#memory-add-input"),
  addMemory: document.querySelector("#add-memory"),
  modeSelect: document.querySelector("#mode-select"),
  customModeField: document.querySelector("#custom-mode-field"),
  customModeInput: document.querySelector("#custom-mode-input"),
  sendDelaySelect: document.querySelector("#send-delay-select"),
  saveHistoryInput: document.querySelector("#save-history-input"),
  settingsSaveStatus: document.querySelector("#settings-save-status"),
  languageSelect: document.querySelector("#language-select"),
  themeSelect: document.querySelector("#theme-select"),
  accentControl: document.querySelector("#accent-control"),
  fontSizeSelect: document.querySelector("#font-size-select"),
  motionSelect: document.querySelector("#motion-select"),
  toneControl: document.querySelector("#tone-control"),
  lengthControl: document.querySelector("#length-control"),
  aiNameLabels: document.querySelectorAll("[data-ai-name]"),
  startTitle: document.querySelector("#start-title"),
  privacyNote: document.querySelector("#privacy-note"),
  startCall: document.querySelector("#start-call"),
  endCall: document.querySelector("#end-call"),
  backHome: document.querySelector("#back-home"),
  copyTranscript: document.querySelector("#copy-transcript"),
  userPanel: document.querySelector("#user-panel"),
  assistantActions: document.querySelector("#assistant-actions"),
  messageInput: document.querySelector("#message-input"),
  aiCopy: document.querySelector("#ai-copy"),
  characterCount: document.querySelector("#character-count"),
  sendHint: document.querySelector("#send-hint"),
  sendHintLabel: document.querySelector("#send-hint-label"),
  connectionLabel: document.querySelector("#connection-label"),
  srStatus: document.querySelector("#sr-status"),
  callTimer: document.querySelector("#call-timer"),
  finalDuration: document.querySelector("#final-duration"),
  finalTurns: document.querySelector("#final-turns"),
  transcript: document.querySelector("#transcript"),
  historyNote: document.querySelector("#history-note"),
  historyList: document.querySelector("#history-list"),
  clearHistory: document.querySelector("#clear-history"),
  installApp: document.querySelector("#install-app"),
  updateApp: document.querySelector("#update-app"),
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
  authMode: "signIn",
  emailAuthBusy: false,
  authProblem: null,
  locale: "en",
  currentConversationId: null,
  callKey: "",
  historySaveQueue: Promise.resolve(),
  installPrompt: null,
  waitingWorker: null,
  reloadingForUpdate: false,
  historyErrorShown: false,
  profileSchemaReady: true,
  settingsTab: "general",
  pendingConfirmation: null
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
    accent: VALID_ACCENTS.has(candidate.accent) ? candidate.accent : DEFAULT_SETTINGS.accent,
    fontSize: VALID_FONT_SIZES.has(candidate.fontSize) ? candidate.fontSize : DEFAULT_SETTINGS.fontSize,
    motion: VALID_MOTION.has(candidate.motion) ? candidate.motion : DEFAULT_SETTINGS.motion,
    language: VALID_LANGUAGES.has(candidate.language) ? candidate.language : DEFAULT_SETTINGS.language,
    sendDelay: VALID_SEND_DELAYS.has(candidate.sendDelay) ? candidate.sendDelay : DEFAULT_SETTINGS.sendDelay,
    conversationMode: VALID_MODES.has(candidate.conversationMode) ? candidate.conversationMode : DEFAULT_SETTINGS.conversationMode,
    customModePrompt: typeof candidate.customModePrompt === "string" ? candidate.customModePrompt.trim().slice(0, 500) : "",
    saveHistory: candidate.saveHistory === true
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
  elements.emailAuthSubmit.textContent = translate(state.authMode);
  const status = elements.screens.call.dataset.status;
  elements.connectionLabel.textContent = translate(status === "offline" ? "connectionLost" : "connected");
  updateSendHint();
  elements.privacyNote.textContent = translate(state.settings.saveHistory ? "savedWhenSignedIn" : "notSaved");
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
  document.documentElement.dataset.accent = state.settings.accent;
  document.documentElement.dataset.fontSize = state.settings.fontSize;
  document.documentElement.dataset.motion = state.settings.motion;
  applyTranslations();
  for (const label of elements.aiNameLabels) label.textContent = aiName();
  elements.startTitle.textContent = translate("talkTo", { name: aiName() });
  elements.privacyNote.textContent = translate(state.settings.saveHistory ? "savedWhenSignedIn" : "notSaved");
  renderAccount();
}

function updateSendHint() {
  const key = {
    fast: "sendHintFast",
    normal: "sendHintNormal",
    slow: "sendHintSlow",
    manual: "sendHintManual"
  }[state.settings.sendDelay] || "sendHintNormal";
  elements.sendHintLabel.textContent = translate(key);
}

function fillSettingsForm() {
  state.formDraft = { ...state.settings };
  elements.displayNameInput.value = state.formDraft.displayName;
  elements.aiNameInput.value = state.formDraft.aiName;
  elements.memoryAddInput.value = "";
  elements.modeSelect.value = state.formDraft.conversationMode;
  elements.customModeInput.value = state.formDraft.customModePrompt;
  elements.sendDelaySelect.value = state.formDraft.sendDelay;
  elements.saveHistoryInput.checked = state.formDraft.saveHistory;
  elements.languageSelect.value = state.formDraft.language;
  elements.themeSelect.value = state.formDraft.theme;
  elements.fontSizeSelect.value = state.formDraft.fontSize;
  elements.motionSelect.value = state.formDraft.motion;
  updateCustomModeField();
  applyChoiceState(elements.accentControl, "accent", state.formDraft.accent);
  applyChoiceState(elements.toneControl, "tone", state.formDraft.tone);
  applyChoiceState(elements.lengthControl, "length", state.formDraft.replyLength);
  renderMemoryList();
}

function clearSettingsSaveStatus() {
  elements.settingsSaveStatus.textContent = "";
  elements.settingsSaveStatus.classList.remove("is-visible", "is-error");
}

function showSettingsSaveStatus(message, isError = false) {
  elements.settingsSaveStatus.textContent = message;
  elements.settingsSaveStatus.classList.toggle("is-error", isError);
  elements.settingsSaveStatus.classList.add("is-visible");
}

function memoryItems(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderMemoryList() {
  const items = memoryItems(state.formDraft?.memory ?? state.settings.memory);
  elements.memoryList.replaceChildren();
  elements.memoryEmpty.classList.toggle("is-hidden", items.length > 0);

  items.forEach((memory, index) => {
    const item = document.createElement("article");
    const copy = document.createElement("p");
    const remove = document.createElement("button");
    item.className = "memory-item";
    copy.textContent = memory;
    remove.className = "memory-delete";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", translate("removeMemory", { memory }));
    remove.addEventListener("click", () => removeMemoryDraft(index));
    item.append(copy, remove);
    elements.memoryList.append(item);
  });
}

function addMemoryDraft() {
  if (!state.formDraft) return;
  const memory = elements.memoryAddInput.value.trim();
  if (!memory) return;
  const items = memoryItems(state.formDraft.memory);
  if (items.some((item) => item.toLocaleLowerCase() === memory.toLocaleLowerCase())) {
    elements.memoryAddInput.value = "";
    return;
  }
  const combined = [...items, memory].join("\n");
  if (combined.length > 500) {
    showToast(translate("memoryFull"));
    return;
  }
  state.formDraft.memory = combined;
  elements.memoryAddInput.value = "";
  clearSettingsSaveStatus();
  renderMemoryList();
}

function removeMemoryDraft(index) {
  if (!state.formDraft) return;
  const items = memoryItems(state.formDraft.memory);
  items.splice(index, 1);
  state.formDraft.memory = items.join("\n");
  clearSettingsSaveStatus();
  renderMemoryList();
}

function updateCustomModeField() {
  const custom = elements.modeSelect.value === "custom";
  elements.customModeField.classList.toggle("is-hidden", !custom);
  elements.customModeInput.disabled = !custom;
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
  if (key === "accent" && VALID_ACCENTS.has(value)) state.formDraft.accent = value;
  clearSettingsSaveStatus();
  applyChoiceState(event.currentTarget, key, value);
}

function showDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  const focusHeading = () => dialog.querySelector("[data-dialog-focus]")?.focus({ preventScroll: true });
  focusHeading();
  window.requestAnimationFrame(focusHeading);
}

function selectSettingsTab(name) {
  const selected = Array.from(elements.settingsTabButtons).find((button) => button.dataset.settingsTab === name);
  if (!selected) return;
  state.settingsTab = name;
  for (const button of elements.settingsTabButtons) {
    const active = button === selected;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  for (const panel of elements.settingsPanels) {
    panel.classList.toggle("is-hidden", panel.dataset.settingsPanel !== name);
  }
  if (name === "memory") renderMemoryList();
  if (name === "history") void loadHistory();
}

function openSettings(tabName = "general") {
  fillSettingsForm();
  clearSettingsSaveStatus();
  renderAccount();
  showDialog(elements.settingsDialog);
  selectSettingsTab(tabName);
}

function handleSettingsTabClick(event) {
  const button = event.target.closest("[data-settings-tab]");
  if (button) selectSettingsTab(button.dataset.settingsTab);
}

function handleSettingsTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = Array.from(elements.settingsTabButtons);
  const current = Math.max(0, tabs.indexOf(event.target));
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  selectSettingsTab(tabs[next].dataset.settingsTab);
  tabs[next].focus({ preventScroll: true });
}

function collectSettingsForm() {
  return normalizeSettings({
    ...(state.formDraft || state.settings),
    displayName: elements.displayNameInput.value,
    aiName: elements.aiNameInput.value,
    memory: state.formDraft?.memory ?? state.settings.memory,
    conversationMode: elements.modeSelect.value,
    customModePrompt: elements.customModeInput.value,
    sendDelay: elements.sendDelaySelect.value,
    saveHistory: elements.saveHistoryInput.checked,
    language: elements.languageSelect.value,
    theme: elements.themeSelect.value,
    accent: state.formDraft?.accent ?? state.settings.accent,
    fontSize: elements.fontSizeSelect.value,
    motion: elements.motionSelect.value
  });
}

function hasUnsavedSettings() {
  return Boolean(
    elements.settingsDialog.open
    && state.formDraft
    && JSON.stringify(collectSettingsForm()) !== JSON.stringify(state.settings)
  );
}

function requestSettingsClose(afterClose = null) {
  if (!elements.settingsDialog.open) {
    if (afterClose) afterClose();
    return;
  }
  if (!hasUnsavedSettings()) {
    closeSettings(true);
    if (afterClose) afterClose();
    return;
  }
  openConfirmation({
    titleKey: "unsavedChangesTitle",
    descriptionKey: "unsavedChangesDescription",
    confirmKey: "discardChanges",
    cancelKey: "keepEditing",
    action: async () => {
      closeSettings(true);
      if (afterClose) afterClose();
      return true;
    },
    eyebrowKey: "confirm"
  });
}

function closeSettings(force = false) {
  if (!elements.settingsDialog.open) return;
  if (!force && hasUnsavedSettings()) {
    requestSettingsClose();
    return;
  }
  elements.settingsDialog.close();
  state.formDraft = null;
}

async function saveSettings(event) {
  event.preventDefault();
  const next = collectSettingsForm();
  state.settings = next;
  storeSettings();
  applySettings();
  state.formDraft = { ...state.settings };

  if (state.authUser && state.supabase) {
    const saved = await saveCloudProfile();
    showSettingsSaveStatus(translate(saved ? "settingsSaved" : "cloudFailed"), !saved);
  } else {
    showSettingsSaveStatus(translate("settingsSaved"));
  }
}

async function initAuth(showProblem = false) {
  if (state.supabase) return true;
  if (state.authInitializing) return false;
  state.authInitializing = true;
  elements.authOptions.setAttribute("aria-busy", "true");
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
    elements.authOptions.removeAttribute("aria-busy");
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
    elements.accountName.textContent = String(metadataName || state.authUser.email || translate("googleAccount"));
    elements.accountStatus.textContent = translate(state.profileSchemaReady ? "syncOn" : "signedInNeedsSchema");
    elements.authOptions.classList.add("is-hidden");
    elements.accountActions.classList.remove("is-hidden");
    return;
  }

  elements.accountButton.textContent = translate("accountTitle");
  elements.accountName.textContent = translate("guest");
  elements.accountStatus.textContent = state.authConfigured
    ? translate("deviceOnly")
    : state.authProblem
      ? translate(state.authProblem.key, state.authProblem.variables)
      : translate("checkingSignIn");
  elements.authOptions.classList.remove("is-hidden");
  elements.accountActions.classList.add("is-hidden");
}

function showEmailAuthStatus(message = "", isError = false) {
  elements.emailAuthStatus.textContent = message;
  elements.emailAuthStatus.classList.toggle("is-error", isError);
}

function setEmailAuthMode(mode) {
  if (mode !== "signIn" && mode !== "signUp") return;
  state.authMode = mode;
  for (const button of elements.emailAuthModeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.authMode === mode));
  }
  elements.authPassword.autocomplete = mode === "signUp" ? "new-password" : "current-password";
  elements.emailAuthSubmit.textContent = translate(mode);
  showEmailAuthStatus();
}

function setEmailAuthBusy(isBusy) {
  state.emailAuthBusy = isBusy;
  elements.emailAuthSubmit.disabled = isBusy;
  elements.authEmail.readOnly = isBusy;
  elements.authPassword.readOnly = isBusy;
  elements.emailAuth.setAttribute("aria-busy", String(isBusy));
}

function emailAuthErrorKey(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const errorKeys = {
    invalid_credentials: "invalidCredentials",
    email_not_confirmed: "emailNotConfirmed",
    user_already_exists: "emailAlreadyRegistered",
    email_exists: "emailAlreadyRegistered",
    weak_password: "weakPassword",
    over_email_send_rate_limit: "emailRateLimited",
    signup_disabled: "signupDisabled",
    email_provider_disabled: "signupDisabled"
  };
  return errorKeys[code] || "emailAuthFailed";
}

async function submitEmailAuth() {
  if (state.emailAuthBusy) return;
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !elements.authEmail.validity.valid) {
    showEmailAuthStatus(translate("enterValidEmail"), true);
    elements.authEmail.focus({ preventScroll: true });
    return;
  }
  if (password.length < 8) {
    showEmailAuthStatus(translate("passwordTooShort"), true);
    elements.authPassword.focus({ preventScroll: true });
    return;
  }

  if (!state.supabase) {
    const ready = await initAuth(true);
    if (!ready || !state.supabase) return;
  }

  setEmailAuthBusy(true);
  showEmailAuthStatus();
  try {
    if (state.authMode === "signUp") {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` }
      });
      if (error) throw error;
      elements.authPassword.value = "";
      if (data.session) {
        await handleSession(data.session);
        showToast(translate("accountCreated"));
      } else {
        showEmailAuthStatus(translate("checkEmail"));
      }
      return;
    }

    const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    elements.authPassword.value = "";
    await handleSession(data.session);
    showToast(translate("signedIn"));
  } catch (error) {
    showEmailAuthStatus(translate(emailAuthErrorKey(error)), true);
  } finally {
    setEmailAuthBusy(false);
  }
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
  elements.authPassword.value = "";
  renderAccount();
  showToast(translate("signedOut"));
}

async function resetPersonalization() {
  state.settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    displayName: state.settings.displayName,
    theme: state.settings.theme,
    accent: state.settings.accent,
    fontSize: state.settings.fontSize,
    motion: state.settings.motion,
    language: state.settings.language,
    sendDelay: state.settings.sendDelay,
    saveHistory: state.settings.saveHistory
  });
  storeSettings();
  applySettings();
  if (state.authUser && state.supabase) await saveCloudProfile();
  fillSettingsForm();
  selectSettingsTab("account");
  showToast(translate("personalizationReset"));
  return true;
}

async function deleteAccount() {
  if (!state.supabase || !state.authUser) return false;
  let error = null;
  try {
    ({ error } = await state.supabase.rpc("delete_current_user"));
  } catch {
    error = new Error("Account deletion request failed");
  }
  if (error) {
    showToast(translate("accountDeleteFailed"));
    return false;
  }
  await state.supabase.auth.signOut({ scope: "local" });
  state.authUser = null;
  state.loadedProfileFor = "";
  state.settings = { ...DEFAULT_SETTINGS };
  storeSettings();
  applySettings();
  closeSettings(true);
  showToast(translate("accountDeleted"));
  return true;
}

function openConfirmation({ titleKey, descriptionKey, confirmKey, action, eyebrowKey = "dangerZone", cancelKey = "cancel" }) {
  state.pendingConfirmation = { action };
  elements.confirmEyebrow.textContent = translate(eyebrowKey);
  elements.confirmEyebrow.classList.toggle("danger-text", eyebrowKey === "dangerZone");
  elements.confirmTitle.textContent = translate(titleKey);
  elements.confirmDescription.textContent = translate(descriptionKey);
  elements.cancelConfirm.textContent = translate(cancelKey);
  elements.confirmAction.textContent = translate(confirmKey);
  showDialog(elements.confirmDialog);
}

function closeConfirmation() {
  if (elements.confirmDialog.open) elements.confirmDialog.close();
  state.pendingConfirmation = null;
  settleFocusAfterConfirmation();
}

function settleFocusAfterConfirmation() {
  const settle = () => {
    if (elements.settingsDialog.open) {
      elements.settingsDialog.querySelector("[data-dialog-focus]")?.focus({ preventScroll: true });
      return;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  queueMicrotask(settle);
  window.requestAnimationFrame(settle);
}

async function confirmPendingAction() {
  const pending = state.pendingConfirmation;
  if (!pending) return;
  elements.confirmAction.disabled = true;
  elements.confirmAction.setAttribute("aria-busy", "true");
  let succeeded = false;
  try {
    succeeded = await pending.action();
  } catch (error) {
    showToast(error instanceof Error ? error.message : translate("responseUnavailable"));
  } finally {
    elements.confirmAction.disabled = false;
    elements.confirmAction.removeAttribute("aria-busy");
  }
  if (succeeded) closeConfirmation();
}

function requestPersonalizationReset() {
  openConfirmation({
    titleKey: "resetConfirm",
    descriptionKey: "resetDescription",
    confirmKey: "resetPersonalization",
    action: resetPersonalization,
    eyebrowKey: "confirm"
  });
}

function requestAccountDeletion() {
  if (!state.supabase || !state.authUser) return;
  openConfirmation({
    titleKey: "deleteAccountTitle",
    descriptionKey: "deleteAccountDescription",
    confirmKey: "deleteAccount",
    action: deleteAccount
  });
}

async function loadHistory() {
  elements.historyList.replaceChildren();
  elements.clearHistory.classList.add("is-hidden");
  elements.historyNote.classList.remove("is-hidden");
  elements.historyNote.textContent = translate(state.authUser ? "historyLoading" : "historySignIn");
  if (!state.supabase || !state.authUser) return;

  const { data, error } = await state.supabase
    .from("conversations")
    .select("id,title,messages,updated_at")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) {
    elements.historyNote.textContent = translate("historySaveFailed");
    return;
  }
  renderHistory(data || []);
}

function safeConversationMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 600) }))
    .filter((message) => message.content)
    .slice(-HISTORY_LIMIT);
}

function renderHistory(records) {
  elements.historyList.replaceChildren();
  elements.historyNote.classList.toggle("is-hidden", records.length > 0);
  elements.historyNote.textContent = translate("historyEmpty");
  elements.clearHistory.classList.toggle("is-hidden", records.length === 0);

  for (const record of records) {
    const item = document.createElement("article");
    const resume = document.createElement("button");
    const title = document.createElement("strong");
    const details = document.createElement("span");
    const remove = document.createElement("button");
    const messages = safeConversationMessages(record.messages);
    const turns = messages.filter((message) => message.role === "user").length;
    const date = new Intl.DateTimeFormat(state.locale === "ja" ? "ja-JP" : "en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(record.updated_at));

    item.className = "history-item";
    resume.className = "history-main";
    resume.type = "button";
    resume.title = translate("resumeCall");
    title.textContent = String(record.title || messages.find((message) => message.role === "user")?.content || aiName()).slice(0, 80);
    details.textContent = `${date} · ${translate("turnCount", { count: turns })}`;
    resume.append(title, details);
    resume.addEventListener("click", () => resumeConversation(record.id, messages));

    remove.className = "history-delete";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", translate("deleteCallConfirm"));
    remove.addEventListener("click", () => requestConversationDeletion(record.id, item));
    item.append(resume, remove);
    elements.historyList.append(item);
  }
}

function resumeConversation(id, messages) {
  if (!messages.length) return;
  requestSettingsClose(() => beginCall(messages, id));
}

async function deleteConversation(id, item) {
  if (!state.supabase || !state.authUser) return false;
  const { error } = await state.supabase.from("conversations").delete().eq("id", id);
  if (error) {
    showToast(error.message);
    return false;
  }
  item.remove();
  if (!elements.historyList.children.length) renderHistory([]);
  return true;
}

async function clearHistory() {
  if (!state.supabase || !state.authUser) return false;
  const { error } = await state.supabase.from("conversations").delete().eq("user_id", state.authUser.id);
  if (error) {
    showToast(error.message);
    return false;
  }
  renderHistory([]);
  return true;
}

function requestConversationDeletion(id, item) {
  openConfirmation({
    titleKey: "deleteCallConfirm",
    descriptionKey: "deleteCallDescription",
    confirmKey: "deleteCall",
    action: () => deleteConversation(id, item)
  });
}

function requestHistoryClear() {
  if (!state.supabase || !state.authUser) return;
  openConfirmation({
    titleKey: "clearHistoryConfirm",
    descriptionKey: "clearHistoryDescription",
    confirmKey: "clearHistory",
    action: clearHistory
  });
}

async function loadCloudProfile() {
  if (!state.supabase || !state.authUser) return;
  state.profileSchemaReady = true;
  let { data, error } = await state.supabase
    .from("profiles")
    .select("display_name,ai_name,tone,reply_length,memory,theme,accent,font_size,motion,language,send_delay,conversation_mode,custom_mode_prompt,save_history")
    .eq("id", state.authUser.id)
    .maybeSingle();

  if (error && /(accent|font_size|motion)/i.test(error.message || "")) {
    state.profileSchemaReady = false;
    const fallback = await state.supabase
      .from("profiles")
      .select("display_name,ai_name,tone,reply_length,memory,theme,language,send_delay,conversation_mode,custom_mode_prompt,save_history")
      .eq("id", state.authUser.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error && /(language|send_delay|conversation_mode|custom_mode_prompt|save_history)/i.test(error.message || "")) {
    state.profileSchemaReady = false;
    const fallback = await state.supabase
      .from("profiles")
      .select("display_name,ai_name,tone,reply_length,memory,theme")
      .eq("id", state.authUser.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    state.profileSchemaReady = false;
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
      accent: data.accent ?? state.settings.accent,
      fontSize: data.font_size ?? state.settings.fontSize,
      motion: data.motion ?? state.settings.motion,
      language: data.language ?? state.settings.language,
      sendDelay: data.send_delay ?? state.settings.sendDelay,
      conversationMode: data.conversation_mode ?? state.settings.conversationMode,
      customModePrompt: data.custom_mode_prompt ?? state.settings.customModePrompt,
      saveHistory: data.save_history ?? state.settings.saveHistory
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
    accent: state.settings.accent,
    font_size: state.settings.fontSize,
    motion: state.settings.motion,
    language: state.settings.language,
    send_delay: state.settings.sendDelay,
    conversation_mode: state.settings.conversationMode,
    custom_mode_prompt: state.settings.customModePrompt,
    save_history: state.settings.saveHistory,
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  state.profileSchemaReady = !error;
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
  beginCall();
}

function beginCall(initialMessages = null, conversationId = null) {
  clearTimeout(state.sendTimer);
  abortActiveResponse(false);
  const restored = safeConversationMessages(initialMessages);
  state.messages = restored.length ? restored : [{ role: "assistant", content: openingLine() }];
  state.liveUserIndex = -1;
  state.liveAssistantIndex = -1;
  state.lastSubmittedText = "";
  state.deletingCurrentTurn = false;
  state.currentConversationId = conversationId;
  state.callKey = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
  state.callStartedAt = Date.now();
  state.durationSeconds = 0;
  elements.aiCopy.textContent = [...state.messages].reverse().find((message) => message.role === "assistant")?.content || openingLine();
  elements.aiCopy.classList.remove("is-streaming");
  renderActions([]);
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
  queueHistorySave();
}

function backHome() {
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
  if (state.settings.sendDelay === "manual") return;
  const baseDelay = SEND_DELAYS_MS[state.settings.sendDelay] || SEND_DELAYS_MS.normal;
  const delay = state.composing ? baseDelay + 300 : baseDelay;
  state.sendTimer = window.setTimeout(sendDraft, delay);
}

function handleInput() {
  updateInputState();
  if (state.activeRequest) abortActiveResponse(true);

  const content = elements.messageInput.value.trim();
  if (content !== state.lastSubmittedText) renderActions([]);
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
  const requestState = { controller, text: "", actionJson: "", settled: false };
  state.activeRequest = requestState;
  renderActions([]);
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
        processStreamEvent(streamEvent, requestState);
      }

      if (done) {
        const tail = parseSseBuffer(`${buffer}\n\n`);
        for (const streamEvent of tail.events) {
          const streamError = eventError(streamEvent);
          if (streamError) throw new Error(streamError);
          processStreamEvent(streamEvent, requestState);
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

function processStreamEvent(streamEvent, requestState) {
  const argumentDelta = functionArgumentsDelta(streamEvent);
  if (argumentDelta) requestState.actionJson += argumentDelta;
  if (!requestState.actionJson) {
    requestState.actionJson = completedFunctionArguments(streamEvent) || responseFunctionArguments(streamEvent);
  }

  const delta = textDelta(streamEvent);
  const finalText = requestState.text ? "" : completedText(streamEvent);
  const nextText = delta || finalText;
  if (!nextText) return;
  requestState.text += nextText;
  elements.aiCopy.textContent = requestState.text;
  elements.aiCopy.scrollTop = elements.aiCopy.scrollHeight;
  setStatus("replying", translate("replying", { name: aiName() }));
}

function parseActions(source) {
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed?.actions)) return [];
    return parsed.actions
      .filter((action) => action && (action.type === "reply" || action.type === "remember")
        && typeof action.label === "string" && typeof action.value === "string")
      .map((action) => ({
        type: action.type,
        label: action.label.trim().slice(0, 40),
        value: action.value.trim().slice(0, action.type === "reply" ? MAX_INPUT_CHARS : 280)
      }))
      .filter((action) => action.label && action.value)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function renderActions(actions) {
  elements.assistantActions.replaceChildren();
  elements.assistantActions.classList.toggle("is-hidden", actions.length === 0);
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.actionType = action.type;
    button.dataset.actionValue = action.value;
    button.textContent = action.label;
    elements.assistantActions.append(button);
  }
}

async function handleAssistantAction(event) {
  const button = event.target.closest("button[data-action-type]");
  if (!button) return;
  const type = button.dataset.actionType;
  const value = button.dataset.actionValue?.trim() || "";
  if (!value) return;
  renderActions([]);

  if (type === "remember") {
    const existing = state.settings.memory;
    if (existing.toLocaleLowerCase().includes(value.toLocaleLowerCase())) {
      showToast(translate("remembered"));
      return;
    }
    const combined = [existing, value].filter(Boolean).join("\n").slice(0, 500);
    if (combined.length <= existing.length) {
      showToast(translate("memoryFull"));
      return;
    }
    state.settings = normalizeSettings({ ...state.settings, memory: combined });
    storeSettings();
    if (state.authUser && state.supabase) await saveCloudProfile();
    showToast(translate("remembered"));
    return;
  }

  clearTimeout(state.sendTimer);
  abortActiveResponse(true);
  state.liveUserIndex = -1;
  state.liveAssistantIndex = -1;
  state.lastSubmittedText = "";
  state.deletingCurrentTurn = false;
  elements.messageInput.value = value.slice(0, MAX_INPUT_CHARS);
  updateInputState();
  elements.messageInput.focus({ preventScroll: true });
  await sendDraft();
}

function settleResponse(requestState, interrupted) {
  if (requestState.settled) return;
  requestState.settled = true;
  const actions = interrupted ? [] : parseActions(requestState.actionJson);
  if (!requestState.text.trim() && actions.length) requestState.text = translate("chooseAction");
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
  renderActions(actions);
  if (state.activeRequest === requestState) state.activeRequest = null;
  elements.aiCopy.classList.remove("is-streaming");
  setStatus("ready", translate(interrupted ? "stopped" : "finished", { name: aiName() }));
  if (!interrupted) queueHistorySave();
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

function queueHistorySave() {
  if (!state.settings.saveHistory || !state.supabase || !state.authUser) return;
  const messages = state.messages.map((message) => ({ ...message }));
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return;
  const payload = {
    callKey: state.callKey,
    conversationId: state.currentConversationId,
    userId: state.authUser.id,
    title: firstUser.content.slice(0, 80),
    messages
  };
  state.historySaveQueue = state.historySaveQueue
    .then(() => persistConversation(payload))
    .catch(() => showHistorySaveError());
}

async function persistConversation(payload) {
  if (!state.supabase) return;
  const isCurrentCall = payload.callKey === state.callKey;
  const conversationId = isCurrentCall ? state.currentConversationId : payload.conversationId;
  const values = {
    user_id: payload.userId,
    title: payload.title,
    messages: payload.messages,
    updated_at: new Date().toISOString()
  };

  if (conversationId) {
    const { error } = await state.supabase.from("conversations").update(values).eq("id", conversationId);
    if (error) throw error;
  } else {
    const { data, error } = await state.supabase.from("conversations").insert(values).select("id").single();
    if (error) throw error;
    if (isCurrentCall) state.currentConversationId = data.id;
  }
  state.historyErrorShown = false;
}

function showHistorySaveError() {
  if (state.historyErrorShown) return;
  state.historyErrorShown = true;
  showToast(translate("historySaveFailed"));
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

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function installApp() {
  if (isStandalone()) {
    showToast(translate("appInstalled"));
    return;
  }
  if (state.installPrompt) {
    await state.installPrompt.prompt();
    const choice = await state.installPrompt.userChoice;
    state.installPrompt = null;
    if (choice.outcome === "accepted") elements.installApp.classList.add("is-hidden");
    return;
  }
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  showToast(translate(isiOS ? "installIos" : "installUnavailable"));
}

function offerAppUpdate(worker) {
  state.waitingWorker = worker;
  elements.updateApp.classList.remove("is-hidden");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (registration.waiting) offerAppUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) offerAppUpdate(installing);
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!state.reloadingForUpdate) return;
      window.location.reload();
    });
  } catch {
    // A service worker is an enhancement; the live call remains usable without it.
  }
}

function updateApp() {
  if (!state.waitingWorker) return;
  state.reloadingForUpdate = true;
  state.waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

function updateViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

elements.accountButton.addEventListener("click", () => openSettings("account"));
elements.settingsButton.addEventListener("click", () => openSettings("general"));
elements.closeSettings.addEventListener("click", () => closeSettings());
elements.settingsDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettings();
});
elements.settingsForm.addEventListener("submit", saveSettings);
elements.settingsForm.addEventListener("input", clearSettingsSaveStatus);
elements.settingsForm.addEventListener("change", clearSettingsSaveStatus);
elements.settingsTabs.addEventListener("click", handleSettingsTabClick);
elements.settingsTabs.addEventListener("keydown", handleSettingsTabKeydown);
elements.addMemory.addEventListener("click", addMemoryDraft);
elements.memoryAddInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addMemoryDraft();
});
elements.googleSignIn.addEventListener("click", signInWithGoogle);
elements.emailAuthMode.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-mode]");
  if (button) setEmailAuthMode(button.dataset.authMode);
});
elements.emailAuth.addEventListener("input", () => showEmailAuthStatus());
elements.emailAuth.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches("input")) return;
  event.preventDefault();
  void submitEmailAuth();
});
elements.emailAuthSubmit.addEventListener("click", submitEmailAuth);
elements.signOut.addEventListener("click", signOut);
elements.clearHistory.addEventListener("click", requestHistoryClear);
elements.resetPersonalization.addEventListener("click", requestPersonalizationReset);
elements.deleteAccount.addEventListener("click", requestAccountDeletion);
elements.cancelConfirm.addEventListener("click", () => closeConfirmation());
elements.confirmAction.addEventListener("click", confirmPendingAction);
elements.confirmDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeConfirmation();
});
elements.accentControl.addEventListener("click", (event) => selectChoice(event, "accent"));
elements.toneControl.addEventListener("click", (event) => selectChoice(event, "tone"));
elements.lengthControl.addEventListener("click", (event) => selectChoice(event, "length"));
elements.modeSelect.addEventListener("change", updateCustomModeField);
elements.startCall.addEventListener("click", startCall);
elements.endCall.addEventListener("click", endCall);
elements.backHome.addEventListener("click", backHome);
elements.copyTranscript.addEventListener("click", copyTranscript);
elements.userPanel.addEventListener("click", () => elements.messageInput.focus({ preventScroll: true }));
elements.assistantActions.addEventListener("click", handleAssistantAction);
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
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
});
window.addEventListener("appinstalled", () => {
  state.installPrompt = null;
  elements.installApp.classList.add("is-hidden");
  showToast(translate("appInstalled"));
});
elements.installApp.addEventListener("click", installApp);
elements.updateApp.addEventListener("click", updateApp);

applySettings();
updateViewportHeight();
setScreen("start");
renderAccount();
void initAuth();
if (isStandalone()) elements.installApp.classList.add("is-hidden");
void registerServiceWorker();

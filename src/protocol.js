export const MAX_MESSAGE_CHARS = 600;
export const MAX_MESSAGES = 12;

const VALID_ROLES = new Set(["user", "assistant"]);
const VALID_TONES = new Set(["casual", "thoughtful", "direct"]);

const TONE_INSTRUCTIONS = {
  casual: "Keep the tone casual, energetic, and natural.",
  thoughtful: "Keep the tone calm, attentive, and reflective.",
  direct: "Keep the tone clear, practical, and direct."
};

const BASE_INSTRUCTIONS = [
  "You are Nova, an AI text-call partner inside a live typing interface.",
  "Match the user's language.",
  "Reply like a quick turn in a real conversation, usually one or two short sentences.",
  "Use plain text only. Do not use Markdown, headings, or lists.",
  "Do not repeat the user's message unless clarification is necessary.",
  "Ask at most one natural follow-up question, and only when it helps the conversation.",
  "Be transparent that you are AI if identity becomes relevant.",
  "Never claim to have a body, private life, human feelings, or an exclusive relationship with the user.",
  "Do not encourage secrecy, dependency, or withdrawal from real people.",
  "Keep responses age-appropriate and avoid graphic detail."
];

/**
 * @typedef {{ role: "user" | "assistant", content: string }} ChatMessage
 * @typedef {{ messages: ChatMessage[], tone: "casual" | "thoughtful" | "direct" }} ValidChatBody
 */

/**
 * Validate and normalize a browser request body.
 * @param {unknown} value
 * @returns {{ ok: true, value: ValidChatBody } | { ok: false, error: string }}
 */
export function validateChatBody(value) {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Request body must be an object." };
  }

  const body = /** @type {{ messages?: unknown, tone?: unknown }} */ (value);
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "At least one message is required." };
  }

  if (body.messages.length > MAX_MESSAGES) {
    return { ok: false, error: `A maximum of ${MAX_MESSAGES} messages is allowed.` };
  }

  /** @type {ChatMessage[]} */
  const messages = [];

  for (const candidate of body.messages) {
    if (!candidate || typeof candidate !== "object") {
      return { ok: false, error: "Every message must be an object." };
    }

    const message = /** @type {{ role?: unknown, content?: unknown }} */ (candidate);
    if (typeof message.role !== "string" || !VALID_ROLES.has(message.role)) {
      return { ok: false, error: "Message roles must be user or assistant." };
    }

    if (typeof message.content !== "string") {
      return { ok: false, error: "Message content must be text." };
    }

    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error: `Messages must contain 1 to ${MAX_MESSAGE_CHARS} characters.`
      };
    }

    messages.push({
      role: /** @type {"user" | "assistant"} */ (message.role),
      content
    });
  }

  if (messages.at(-1)?.role !== "user") {
    return { ok: false, error: "The final message must be from the user." };
  }

  const tone = typeof body.tone === "string" && VALID_TONES.has(body.tone)
    ? /** @type {"casual" | "thoughtful" | "direct"} */ (body.tone)
    : "casual";

  return { ok: true, value: { messages, tone } };
}

/**
 * Build a Responses API payload.
 * @param {ValidChatBody} chat
 * @param {string} model
 */
export function buildOpenAIRequest(chat, model) {
  const request = {
    model,
    instructions: [...BASE_INSTRUCTIONS, TONE_INSTRUCTIONS[chat.tone]].join(" "),
    input: chat.messages,
    max_output_tokens: 120,
    stream: true,
    store: false
  };

  if (model.startsWith("gpt-5.6")) {
    return { ...request, reasoning: { effort: "none" } };
  }

  return request;
}

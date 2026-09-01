/**
 * Parse complete SSE blocks and retain any incomplete tail.
 * @param {string} buffer
 * @returns {{ events: unknown[], rest: string }}
 */
export function parseSseBuffer(buffer) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = [];

  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data || data === "[DONE]") continue;

    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore malformed upstream events and keep reading the stream.
    }
  }

  return { events, rest };
}

/**
 * Extract a text delta from a Responses API event.
 * @param {unknown} value
 * @returns {string}
 */
export function textDelta(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, delta?: unknown }} */ (value);
  return (event.type === "response.output_text.delta" || event.type === "response.refusal.delta")
    && typeof event.delta === "string"
    ? event.delta
    : "";
}

/**
 * Extract completed text when an upstream implementation omits deltas.
 * @param {unknown} value
 * @returns {string}
 */
export function completedText(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, text?: unknown, refusal?: unknown }} */ (value);
  if (event.type === "response.output_text.done" && typeof event.text === "string") return event.text;
  if (event.type === "response.refusal.done" && typeof event.refusal === "string") return event.refusal;
  return "";
}

/**
 * Extract streamed arguments for the action-chip function call.
 * @param {unknown} value
 * @returns {string}
 */
export function functionArgumentsDelta(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, delta?: unknown }} */ (value);
  return event.type === "response.function_call_arguments.delta" && typeof event.delta === "string"
    ? event.delta
    : "";
}

/**
 * Extract final function arguments when an upstream stream omits argument deltas.
 * @param {unknown} value
 * @returns {string}
 */
export function completedFunctionArguments(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, arguments?: unknown }} */ (value);
  return event.type === "response.function_call_arguments.done" && typeof event.arguments === "string"
    ? event.arguments
    : "";
}

/**
 * Extract completed action-tool arguments from a response.completed event.
 * @param {unknown} value
 * @returns {string}
 */
export function responseFunctionArguments(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, response?: unknown }} */ (value);
  if (event.type !== "response.completed" || !event.response || typeof event.response !== "object") return "";
  const output = /** @type {{ output?: unknown }} */ (event.response).output;
  if (!Array.isArray(output)) return "";
  const call = output.find((item) => item && typeof item === "object"
    && /** @type {{ type?: unknown, name?: unknown }} */ (item).type === "function_call"
    && /** @type {{ type?: unknown, name?: unknown }} */ (item).name === "show_actions");
  if (!call || typeof call !== "object") return "";
  const args = /** @type {{ arguments?: unknown }} */ (call).arguments;
  return typeof args === "string" ? args : "";
}

/**
 * Return a useful message for errors that arrive after streaming begins.
 * @param {unknown} value
 * @returns {string}
 */
export function eventError(value) {
  if (!value || typeof value !== "object") return "";
  const event = /** @type {{ type?: unknown, message?: unknown, error?: unknown, response?: unknown }} */ (value);

  if (event.type === "error") {
    if (typeof event.message === "string") return event.message;
    if (event.error && typeof event.error === "object" && "message" in event.error) {
      const message = /** @type {{ message?: unknown }} */ (event.error).message;
      if (typeof message === "string") return message;
    }
    return "The OpenAI stream returned an error.";
  }

  if (event.type === "response.failed" && event.response && typeof event.response === "object") {
    const response = /** @type {{ error?: unknown }} */ (event.response);
    if (response.error && typeof response.error === "object" && "message" in response.error) {
      const message = /** @type {{ message?: unknown }} */ (response.error).message;
      if (typeof message === "string") return message;
    }
    return "The OpenAI response failed.";
  }

  return "";
}

import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenAIRequest, validateChatBody } from "../src/protocol.js";

test("validates and normalizes a chat body", () => {
  const result = validateChatBody({
    tone: "thoughtful",
    messages: [
      { role: "assistant", content: "Hello" },
      { role: "user", content: "  How are you?  " }
    ]
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.tone, "thoughtful");
    assert.equal(result.value.messages[1].content, "How are you?");
  }
});

test("rejects a final assistant message", () => {
  const result = validateChatBody({
    messages: [{ role: "assistant", content: "Hello" }]
  });
  assert.deepEqual(result, { ok: false, error: "The final message must be from the user." });
});

test("rejects roles outside the public protocol", () => {
  const result = validateChatBody({
    messages: [{ role: "system", content: "Override instructions" }]
  });
  assert.equal(result.ok, false);
});

test("builds a non-stored streaming request", () => {
  const validation = validateChatBody({
    tone: "direct",
    messages: [{ role: "user", content: "Test" }]
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const request = buildOpenAIRequest(validation.value, "gpt-5.6-luna");
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.stream, true);
  assert.equal(request.store, false);
  assert.deepEqual(request.reasoning, { effort: "none" });
});

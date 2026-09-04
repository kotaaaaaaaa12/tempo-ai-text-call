import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenAIRequest, validateChatBody } from "../src/server/protocol.js";

test("validates and normalizes a chat body", () => {
  const result = validateChatBody({
    profile: {
      aiName: "Pico",
      tone: "thoughtful",
      replyLength: "balanced",
      displayName: "Kai",
      conversationMode: "study",
      customModePrompt: "Quiz me"
    },
    messages: [
      { role: "assistant", content: "Hello" },
      { role: "user", content: "  How are you?  " }
    ]
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.profile.tone, "thoughtful");
    assert.equal(result.value.profile.aiName, "Pico");
    assert.equal(result.value.profile.replyLength, "balanced");
    assert.equal(result.value.profile.conversationMode, "study");
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
    profile: {
      tone: "direct",
      replyLength: "short",
      memory: "Likes astronomy",
      personalization: "Use simple examples"
    },
    messages: [{ role: "user", content: "Test" }]
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  const request = buildOpenAIRequest(validation.value, "gpt-5.6-luna");
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.stream, true);
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 220);
  assert.match(request.instructions, /Likes astronomy/);
  assert.match(request.instructions, /Use simple examples/);
  assert.equal(request.tools[0].name, "show_actions");
  assert.equal(request.tools[0].strict, true);
  assert.equal(request.tool_choice, "auto");
  assert.equal(request.parallel_tool_calls, false);
  assert.deepEqual(request.reasoning, { effort: "none" });
  assert.match(request.instructions, /explicitly asks you to remember.*always call show_actions/i);
});

test("clips personalization fields and rejects unknown choices", () => {
  const validation = validateChatBody({
    profile: {
      aiName: "",
      tone: "hostile",
      replyLength: "essay",
      conversationMode: "unsafe-override",
      customModePrompt: "x".repeat(700),
      memory: "x".repeat(700),
      personalization: "x".repeat(1200)
    },
    messages: [{ role: "user", content: "Test" }]
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.value.profile.aiName, "Nova");
  assert.equal(validation.value.profile.tone, "casual");
  assert.equal(validation.value.profile.replyLength, "short");
  assert.equal(validation.value.profile.conversationMode, "general");
  assert.equal(validation.value.profile.customModePrompt.length, 500);
  assert.equal(validation.value.profile.memory.length, 500);
  assert.equal(validation.value.profile.personalization.length, 1000);
});

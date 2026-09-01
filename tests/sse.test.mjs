import assert from "node:assert/strict";
import test from "node:test";
import {
  completedFunctionArguments,
  completedText,
  eventError,
  functionArgumentsDelta,
  parseSseBuffer,
  responseFunctionArguments,
  textDelta
} from "../src/shared/sse.js";

test("parses complete SSE blocks and retains an incomplete tail", () => {
  const source = [
    "event: response.output_text.delta",
    "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Hel\"}",
    "",
    "data: {\"type\":\"response.output_text.delta\",\"delta\":\"lo\"}",
    "",
    "data: {\"type\":\"response.output_text.delta\""
  ].join("\n");

  const result = parseSseBuffer(source);
  assert.equal(result.events.length, 2);
  assert.equal(result.rest, "data: {\"type\":\"response.output_text.delta\"");
  assert.equal(textDelta(result.events[0]), "Hel");
  assert.equal(textDelta(result.events[1]), "lo");
});

test("ignores malformed events and DONE markers", () => {
  const result = parseSseBuffer("data: nope\n\ndata: [DONE]\n\n");
  assert.deepEqual(result.events, []);
  assert.equal(result.rest, "");
});

test("extracts refusal deltas and completed text", () => {
  assert.equal(textDelta({ type: "response.refusal.delta", delta: "Sorry" }), "Sorry");
  assert.equal(completedText({ type: "response.output_text.done", text: "Finished" }), "Finished");
});

test("extracts errors that arrive inside a successful stream", () => {
  assert.equal(eventError({ type: "error", error: { message: "Bad request" } }), "Bad request");
  assert.equal(
    eventError({ type: "response.failed", response: { error: { message: "Model unavailable" } } }),
    "Model unavailable"
  );
});

test("extracts streamed and completed action function arguments", () => {
  assert.equal(functionArgumentsDelta({
    type: "response.function_call_arguments.delta",
    delta: "{\"actions\":["
  }), "{\"actions\":[");
  assert.equal(completedFunctionArguments({
    type: "response.function_call_arguments.done",
    arguments: "{\"actions\":[]}"
  }), "{\"actions\":[]}");
  assert.equal(responseFunctionArguments({
    type: "response.completed",
    response: { output: [{ type: "function_call", name: "show_actions", arguments: "{\"actions\":[]}" }] }
  }), "{\"actions\":[]}");
});

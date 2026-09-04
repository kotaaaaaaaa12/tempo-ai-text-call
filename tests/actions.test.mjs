import assert from "node:assert/strict";
import test from "node:test";
import { ensureRememberAction, rememberedValue } from "../src/shared/actions.js";

test("extracts Japanese and English remember requests", () => {
  assert.equal(rememberedValue("猫が好きって覚えて"), "猫が好き");
  assert.equal(rememberedValue("Remember that I prefer short replies"), "I prefer short replies");
});

test("adds a remember approval action when the model omits it", () => {
  const actions = ensureRememberAction(
    [{ type: "reply", label: "Continue", value: "Continue" }],
    "天体観測が好きって覚えておいて",
    "これを覚える"
  );
  assert.deepEqual(actions.at(-1), {
    type: "remember",
    label: "これを覚える",
    value: "天体観測が好き"
  });
});

test("does not duplicate remember actions or suggest saving sensitive details", () => {
  const existing = [{ type: "remember", label: "Save", value: "Likes cats" }];
  assert.equal(ensureRememberAction(existing, "猫が好きって覚えて", "Remember this"), existing);
  assert.deepEqual(ensureRememberAction([], "パスワードはexample123って覚えて", "Remember this"), []);
});

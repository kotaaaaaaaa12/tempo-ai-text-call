import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the profile migration adds a constrained language setting without replacing the table", async () => {
  const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists language/i);
  assert.match(sql, /language in \('auto', 'en', 'ja'\)/i);
  assert.match(sql, /enable row level security/i);
});

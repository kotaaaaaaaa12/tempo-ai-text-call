import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the profile migration adds a constrained language setting without replacing the table", async () => {
  const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists language/i);
  assert.match(sql, /language in \('auto', 'en', 'ja'\)/i);
  assert.match(sql, /enable row level security/i);
});

test("the schema adds private history, personalization fields, and self-service account deletion", async () => {
  const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists send_delay/i);
  assert.match(sql, /add column if not exists conversation_mode/i);
  assert.match(sql, /add column if not exists save_history/i);
  assert.match(sql, /create table if not exists public\.conversations/i);
  assert.match(sql, /alter table public\.conversations enable row level security/i);
  assert.match(sql, /auth\.uid\(\)\) = user_id/i);
  assert.match(sql, /function public\.delete_current_user\(\)/i);
  assert.match(sql, /revoke all on function public\.delete_current_user\(\) from anon/i);
});

test("the profile migration adds synchronized appearance preferences", async () => {
  const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists accent/i);
  assert.match(sql, /accent in \('default', 'coral', 'blue', 'violet', 'green'\)/i);
  assert.match(sql, /add column if not exists font_size/i);
  assert.match(sql, /font_size in \('small', 'standard', 'large'\)/i);
  assert.match(sql, /add column if not exists motion/i);
  assert.match(sql, /motion in \('auto', 'full', 'reduced', 'none'\)/i);
});

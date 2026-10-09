import test from "node:test";
import assert from "node:assert/strict";

import { mapPlaceholders } from "./postgres";

test("mapPlaceholders numbers each positional parameter", () => {
  assert.equal(
    mapPlaceholders("SELECT * FROM t WHERE a = ? AND b = ?"),
    "SELECT * FROM t WHERE a = $1 AND b = $2",
  );
});

test("mapPlaceholders leaves question marks inside string literals alone", () => {
  assert.equal(
    mapPlaceholders("SELECT 'a?b' AS q WHERE x = ?"),
    "SELECT 'a?b' AS q WHERE x = $1",
  );
});

test("mapPlaceholders understands escaped quotes", () => {
  assert.equal(
    mapPlaceholders("SELECT 'it''s ?' AS q WHERE x = ?"),
    "SELECT 'it''s ?' AS q WHERE x = $1",
  );
});

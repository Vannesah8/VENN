import test from "node:test";
import assert from "node:assert/strict";

import { EscrowError } from "./escrow";
import { parseAmountToCents } from "./money";

test("parseAmountToCents converts user input to whole cents", () => {
  assert.equal(parseAmountToCents("1240"), 124_000);
  assert.equal(parseAmountToCents("1240.00"), 124_000);
  assert.equal(parseAmountToCents("$1,240.55"), 124_055);
  assert.equal(parseAmountToCents("0.01"), 1);
  assert.equal(parseAmountToCents(" 49.99 "), 4_999);
  assert.equal(parseAmountToCents("19.995"), 2_000);
});

test("parseAmountToCents rejects junk and non-positive amounts", () => {
  for (const raw of ["", "abc", "0", "0.00", "-5", "NaN", "."]) {
    assert.throws(
      () => parseAmountToCents(raw),
      (error: unknown) => {
        assert.ok(error instanceof EscrowError);
        assert.equal(error.code, "invalid_input");
        return true;
      },
      `expected "${raw}" to be rejected`,
    );
  }
});

test("parseAmountToCents refuses values beyond safe integers", () => {
  assert.throws(() => parseAmountToCents("99999999999999999999999999"), EscrowError);
});

test("parseAmountToCents rejects exponent notation instead of silently truncating it", () => {
  assert.throws(() => parseAmountToCents("1e30"), EscrowError);
  assert.throws(() => parseAmountToCents("12.5.1"), EscrowError);
});
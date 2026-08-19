import { noWidenThenAssertRule } from "./no-widen-then-assert.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-widen-then-assert", noWidenThenAssertRule, {
  valid: [
    // A single assertion of an external `unknown` parameter is a boundary, not a widen-then-assert.
    `function f(raw: unknown): { id: string } {
      // SAFETY: raw passed schema validation at the port.
      return raw as { id: string };
    }`,
    // `satisfies` is never recovered — it keeps the original type.
    `const value = JSON.parse(text) as unknown;
     const ok = value satisfies unknown;`,
    // Recovery into a named type is not reported (could be a genuine contract).
    `function g(raw: unknown): { id: string } {
      const prepared: unknown = raw;
      return prepared as Parsed;
    }`,
    // No assertion at all.
    'function h(raw: unknown): { id: string } { return { id: String(raw) }; }',
    // Asserting a precise known value without widening first — a single `as T` is fine.
    `const x = { id: "1" };
     const y = x as { id: string };`,
    // `as const` is never a recovery.
    `const v = { id: "1" } as unknown;
     const w = v as const;`,
  ],
  invalid: [
    {
      // Widened local binding of a known value, then asserted back within the same function.
      code: `function f(): { id: string } {
        const parsed: unknown = { id: "1" };
        return parsed as { id: string };
      }`,
      errors: [{ messageId: "wideningThenAsserting" }],
    },
    {
      // Explicitly widened then asserted.
      code: `function f(): { id: string } {
        const parsed = { id: "1" } as unknown;
        return parsed as { id: string };
      }`,
      errors: [{ messageId: "wideningThenAsserting" }],
    },
  ],
});
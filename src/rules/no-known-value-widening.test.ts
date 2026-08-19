import { noKnownValueWideningRule } from "./no-known-value-widening.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-known-value-widening", noKnownValueWideningRule, {
  valid: [
    // Inference is the recommended path — no explicit annotation.
    'const config = { id: "1", count: 2 };',
    // `satisfies` preserves inference.
    'const shape = { id: "1" } satisfies { id: string };',
    // Precise named owner types are fine.
    'const user: User = { id: "1" };',
    // Widening an *empty* object into a dictionary accumulator is fine (no evidence lost).
    'const acc: Record<string, number> = {};',
    // A runtime-constructed value has no syntactic known shape — left alone.
    'const result: unknown = compute();',
    // Identifier source without a known literal initializer — left alone.
    'const copy: SomeType = original;',
  ],
  invalid: [
    {
      // Object literal annotated `unknown` discards all member evidence.
      code: 'const user: unknown = { id: "1", name: "Ana" };',
      errors: [{ messageId: "widening" }],
    },
    {
      // Annotated dict loses key/type evidence.
      code: 'const payload: Record<string, number> = { count: 2 };',
      errors: [{ messageId: "widening" }],
    },
    {
      // Anonymous structural annotations discard literal/extra-member evidence.
      code: 'const point: { x: number; y: number } = { x: 1, y: 2 };',
      errors: [{ messageId: "widening" }],
    },
    {
      // Anonymous object annotation with *new* members not in the expression is still flagged.
      code: 'const point: { x: number } = { x: 1, y: 2 };',
      errors: [{ messageId: "widening" }],
    },
    {
      // Property definition widened.
      code: 'class C { prop: unknown = { id: "1" }; }',
      errors: [{ messageId: "widening" }],
    },
    {
      // Return annotation widened.
      code: 'function f(): unknown { return { id: "1" }; }',
      errors: [{ messageId: "widening" }],
    },
    {
      // Assertion widening.
      code: 'const user = { id: "1" } as unknown;',
      errors: [{ messageId: "widening" }],
    },
  ],
});
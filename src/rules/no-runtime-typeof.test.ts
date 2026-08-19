import { noRuntimeTypeofRule } from "./no-runtime-typeof.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-runtime-typeof", noRuntimeTypeofRule, {
  valid: [
    // No typeof checks: nothing to flag.
    'const isString = (x: string) => x.length > 0;',
    // With allowInTypeGuards, typeof inside explicit type guards is allowed.
    {
      code: 'function isString(x: unknown): x is string { return typeof x === "string"; }',
      options: [{ allowInTypeGuards: true }],
    },
    {
      code: 'const isNumber = (x: unknown): x is number => typeof x === "number";',
      options: [{ allowInTypeGuards: true }],
    },
  ],
  invalid: [
    {
      // `typeof` on an already-typed value is still a redundant representation check.
      code: 'function fn(x: string): void { if (typeof x === "string") console.log(x); }',
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // Default option: type guards are still flagged.
      code: 'function isString(x: unknown): x is string { return typeof x === "string"; }',
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: 'const isNumber = (x: unknown): x is number => typeof x === "number";',
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: 'function fn(x: unknown): void { console.log(typeof x); }',
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],
});
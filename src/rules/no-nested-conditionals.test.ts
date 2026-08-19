import { noNestedConditionalsRule } from "./no-nested-conditionals.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-nested-conditionals", noNestedConditionalsRule, {
  valid: [
    // else-if chains are idiomatic.
    `
function f(a: boolean, b: boolean): void {
  if (a) { work(); } else if (b) { other(); }
}`,
    // Outer if has an else: not flattenable with an early return alone.
    `
function f(a: boolean, b: boolean): void {
  if (a) {
    if (b) { work(); }
  } else {
    other();
  }
}`,
    // Consequent has more than just the inner if.
    `
function f(a: boolean, b: boolean): void {
  if (a) {
    work();
    if (b) { other(); }
  }
}`,
    // Nesting at top level: no early return available.
    `
if (a) {
  if (b) { work(); }
}`,
    // Already-guarded flattening is fine.
    `
function f(a: boolean, b: boolean): void {
  if (!a) return;
  if (b) { work(); }
}`,
  ],
  invalid: [
    // An if whose whole body is another if can be flattened with a guard.
    {
      code: `
function f(a: boolean, b: boolean): void {
  if (a) {
    if (b) {
      work();
    }
  }
}`,
      errors: [{ messageId: "nestedConditional" }],
    },
    // Blockless form.
    {
      code: `
function f(a: boolean, b: boolean): void {
  if (a)
    if (b) work();
}`,
      errors: [{ messageId: "nestedConditional" }],
    },
    // Arrow function bodies.
    {
      code: `
const f = (a: boolean, b: boolean): void => {
  if (a) { if (b) { work(); } }
};`,
      errors: [{ messageId: "nestedConditional" }],
    },
  ],
});

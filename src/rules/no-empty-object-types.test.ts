import { noEmptyObjectTypesRule } from "./no-empty-object-types.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-empty-object-types", noEmptyObjectTypesRule, {
  valid: [
    // Non-empty object type literals are fine.
    'type Payload = { id: string };',
    'function log(p: { id: string }): void {}',
    // Interfaces with members are fine.
    'interface User { id: string; }',
    // `unknown` is not `{}` and is allowed where a boundary is intended.
    'type Blob = unknown;',
    // Intersections that add real members are fine.
    'type Combined = { a: string } & { b: number };',
  ],
  invalid: [
    {
      code: 'type Empty = {};',
      errors: [{ messageId: "emptyObject" }],
    },
    {
      code: 'function f(p: {}): void {}',
      errors: [{ messageId: "emptyObject" }],
    },
    {
      code: 'type Combined = { a: string } & {};',
      errors: [{ messageId: "redundantIntersection" }],
    },
    {
      code: 'type Combined = {} & { b: number };',
      errors: [{ messageId: "redundantIntersection" }],
    },
  ],
});
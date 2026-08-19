import { noRedundantOptionalUndefinedRule } from "./no-redundant-optional-undefined.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-redundant-optional-undefined", noRedundantOptionalUndefinedRule, {
  valid: [
    // Optional without explicit undefined union.
    'interface Props { id?: string; }',
    // MaybeUndefined without `?`.
    'type MaybeUndefined<T> = T | undefined; interface Props { id: MaybeUndefined<string>; }',
    // Explicit undefined union without `?`.
    'interface Props { id: string | undefined; }',
    // Function params and non-property uses are untouched.
    'function f(x?: string): void {}',
    // Computed / literal keys are fine when not marked optional or no explicit absence.
    'interface Props { [key: string]: string | undefined; }',
  ],
  invalid: [
    {
      code: 'interface Props { id?: string | undefined; }',
      errors: [{ messageId: "redundantOptional" }],
    },
    {
      code: 'type MaybeUndefined<T> = T | undefined; interface Props { id?: MaybeUndefined<string>; }',
      errors: [{ messageId: "redundantOptional" }],
    },
  ],
});
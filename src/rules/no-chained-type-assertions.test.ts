import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-chained-type-assertions", noChainedTypeAssertionsRule, {
  valid: [
    // Single `as` assertion is allowed.
    'const id = value as string;',
    // `as const` chains preserve inference and are exempt.
    'const tuple = ["a", 1] as const;',
    'const config = { a: "x", b: 1 } as const;',
    // Single angle-bracket assertion without a chain.
    'const n = <number>value;',
    // Non-assertion wrappers around a single assertion.
    'const v = (value as string);',
    'const w = value! as string;',
    // A parenthesized chain of only `as const` is still allowed.
    'const pair = (["x", 2] as const) as const;',
    // Chained assertions through a member expression are not a chain of the same value.
    'const a = obj as Foo;',
    'const b = a!.value as Bar;',
  ],
  invalid: [
    {
      code: 'const x = {} as object as { id: string };',
      errors: [{ messageId: "chained" }],
    },
    {
      code: 'const x = value as string as number;',
      errors: [{ messageId: "chained" }],
    },
    {
      code: 'const x = (value as string) as number;',
      errors: [{ messageId: "chained" }],
    },
    {
      code: 'const x = <number>value as string;',
      errors: [{ messageId: "chained" }],
    },
    {
      code: 'const x = value as unknown as T;',
      errors: [{ messageId: "chained" }],
    },
    {
      // Chain nested under parens, still a chain.
      code: 'const x = ((value as string) as number);',
      errors: [{ messageId: "chained" }],
    },
  ],
});
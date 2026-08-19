import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-unknown-type-aliases", noUnknownTypeAliasesRule, {
  valid: [
    // Aliases that resolve to domain types are fine.
    'type UserId = string;',
    'type Payload = { id: string; name: string };',
    'type Callback = (err: Error | null, value: string) => void;',
    // Generic aliases are ignored.
    'type Box<T> = { value: T };',
    // Aliases referencing `unknown` inside a union with known members are fine.
    'type Result = { ok: true; value: string } | { ok: false; error: unknown };',
    // Aliased chains ending in a known type.
    'type A = string; type B = A;',
  ],
  invalid: [
    {
      code: 'type Blob = unknown;',
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      // Wrapped in parens is still a trivial unknown alias.
      code: 'type Blob = (unknown);',
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      // Alias chain to unknown.
      code: 'type Data = unknown; type Payload = Data;',
      errors: [{ messageId: "unknownAlias" }, { messageId: "unknownAlias" }],
    },
  ],
});
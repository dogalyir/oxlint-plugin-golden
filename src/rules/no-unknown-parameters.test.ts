import { noUnknownParametersRule } from "./no-unknown-parameters.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-unknown-parameters", noUnknownParametersRule, {
  valid: [
    // Parsed domain types are welcome.
    "function greet(user: { id: string }): void {}",
    // The `cause` parameter is the explicit exception.
    "function fail(error: Error, cause: unknown): void {}",
    "(error: Error, cause: unknown): void => {}",
    // Type variables and structural params are fine.
    "function ident<T>(value: T): T { return value; }",
    "function log(options?: { verbose: boolean }): void {}",
    // No annotation: nothing to check.
    "function implicit(value): void {}",
    // Class parameter property on a precise type.
    "class Store { constructor(public items: string[]) {} }",
    // Must avoid flagging references to `unknown` as parameters of calls.
    "type Unknown = unknown;",
  ],
  invalid: [
    {
      code: "function parse(data: unknown): void {}",
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      code: "const run = (payload: unknown): void => {};",
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      code: "type Fn = (input: unknown) => void;",
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      code: "interface Svc { run(input: unknown): void; }",
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      code: "class Worker { handle(data: unknown): void {} }",
      errors: [{ messageId: "unknownParameter" }],
    },
  ],
});
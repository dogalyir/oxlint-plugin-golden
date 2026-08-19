import { noBooleanParametersRule } from "./no-boolean-parameters.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-boolean-parameters", noBooleanParametersRule, {
  valid: [
    // Boolean-prefixed names state their meaning.
    "function render(isActive: boolean): void {}",
    "function retry(shouldRetry: boolean): void {}",
    "function fetch(hasPermission: boolean): void {}",
    "function send(allowRetry: boolean): void {}",
    "function init(enableLogging: boolean): void {}",
    "function run(isForce: boolean, isDryRun: boolean): void {}",
    // Non-boolean types and absent annotations are untouched.
    "function plain(force: string): void {}",
    "function noAnnotation(force): void {}",
    // Destructured options and rest arrays are untouched.
    "function opts({ force }: { force: boolean }): void {}",
    "const f = (...flags: boolean[]): void => {};",
    // Custom prefixes: "force" reads clearly with this configuration.
    {
      code: "function run(force: boolean): void {}",
      options: [{ allowedNamePrefixes: ["force"] }],
    },
  ],
  invalid: [
    // Bare boolean parameters hide which behavior they select.
    {
      code: "function run(force: boolean): void {}",
      errors: [{ messageId: "booleanParameter" }],
    },
    {
      code: "const f = (fast: boolean): void => {};",
      errors: [{ messageId: "booleanParameter" }],
    },
    {
      code: "function query(cache: boolean, id: string): void {}",
      errors: [{ messageId: "booleanParameter" }],
    },
    {
      code: "function run(force: boolean = false): void {}",
      errors: [{ messageId: "booleanParameter" }],
    },
    {
      code: "const run = function (debug: boolean): void {};",
      errors: [{ messageId: "booleanParameter" }],
    },
    // Custom prefixes: a boolean-prefixed name is no longer exempt.
    {
      code: "function run(isForce: boolean): void {}",
      options: [{ allowedNamePrefixes: ["force"] }],
      errors: [{ messageId: "booleanParameter" }],
    },
  ],
});

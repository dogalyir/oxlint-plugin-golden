import { noObjectParametersRule } from "./no-object-parameters.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-object-parameters", noObjectParametersRule, {
  valid: [
    // Named owner types are the recommended replacement.
    'function log(detail: { id: string; message: string }): void {}',
    'function render(props: ReactProps): void {}',
    // Structured parameters are fine.
    'function set({ x, y }: { x: number; y: number }): void {}',
    'function read(rows: string[]): void {}',
    // Object method call signatures.
    'interface Logger { info(event: { level: number }): void; }',
    'type Handler = (event: unknown) => void;',
  ],
  invalid: [
    {
      code: 'function log(detail: object): void {}',
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: 'const fn = (payload: object) => {};',
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: 'type Fn = (input: object) => void;',
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: 'interface Svc { run(input: object): void; }',
      errors: [{ messageId: "objectParameter" }],
    },
    {
      code: 'class Worker { handle(data: object): void {} }',
      errors: [{ messageId: "objectParameter" }],
    },
    // Aliased object parameter.
    {
      code: 'type Blob = object; function f(x: Blob): void {}',
      errors: [{ messageId: "objectParameter" }],
    },
  ],
});
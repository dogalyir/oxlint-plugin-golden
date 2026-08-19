import { noUnknownReturnsRule } from "./no-unknown-returns.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-unknown-returns", noUnknownReturnsRule, {
  valid: [
    // Named domain or primitive returns are fine.
    'function parse(raw: string): { id: string } { return { id: raw }; }',
    'const f = (): number => 42;',
    // Promise of a known type is fine.
    'async function load(): Promise<string> { return "ok"; }',
    // Void functions and no annotation are fine.
    'function log(): void {}',
    'const g = () => 1;',
    // Interface call signatures and function types with known returns.
    'interface Svc { call(): string; }',
    'type Fn = (x: number) => number;',
    // Constructor signatures with precise returns.
    'type Ctor = new () => { id: string };',
  ],
  invalid: [
    {
      code: 'function load(): unknown { return JSON.parse(raw); }',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: 'async function get(): Promise<unknown> { return await fetchJson(); }',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: 'const f = (): unknown => null;',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: 'interface Svc { run(): unknown; }',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: 'type Fn = () => Promise<unknown>;',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      code: 'class Parser { parse(): unknown { return {}; } }',
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      // A union containing `unknown` still leaks the unparsed value.
      code: 'declare function pick(key: string): unknown | null;',
      errors: [{ messageId: "unknownReturn" }],
    },
    // Aliased unknown return.
    {
      code: 'type Blob = unknown; function fetchBlob(): Blob { return raw; }',
      errors: [{ messageId: "unknownReturn" }],
    },
  ],
});
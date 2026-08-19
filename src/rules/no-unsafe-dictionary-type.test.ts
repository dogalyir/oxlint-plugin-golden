import { noUnsafeDictionaryTypeRule } from "./no-unsafe-dictionary-type.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-unsafe-dictionary-type", noUnsafeDictionaryTypeRule, {
  valid: [
    // Concrete value types are fine.
    'const map: Record<string, number> = {};',
    'type Registry = Record<string, { id: string }>;',
    'interface Config { [key: string]: boolean; }',
    // A dictionary of known domain values is fine.
    'type PayloadMap = Map<string, { id: string }>;',
    // Aliases that ultimately resolve to known value types.
    'type Counts = Record<string, number>;',
    // `unknown` values inside a union with a concrete member are allowed.
    'type Nurse = Record<string, string | number>;',
  ],
  invalid: [
    {
      code: 'const map: Record<string, unknown> = {};',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: 'interface Cache { [key: string]: any; }',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      code: 'type Dict = Record<string, object>;',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      // Empty object literal value type.
      code: 'type Dict = Record<string, {}>;',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      // Mapped type with unknown value.
      code: 'type Mapped = { [K in keyof T]: unknown };',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      // Union containing unknown as the value type.
      code: 'type Dict = Record<string, unknown | string>;',
      errors: [{ messageId: "unsafeDictionary" }],
    },
    {
      // Aliased unsafe value type.
      code: 'type Blob = unknown; type Store = Record<string, Blob>; const s: Store = {};',
      errors: [{ messageId: "unsafeDictionary" }],
    },
  ],
});
import { noRuntimeTypeofRule } from "./no-runtime-typeof.ts";
import { noUnknownParametersRule } from "./no-unknown-parameters.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.ts";
import { createTypeScriptJsxRuleTester } from "../test/rule-tester.ts";

/**
 * Smoke coverage for `.tsx` sources: the rules must parse and fire identically
 * under JSX parsing (the config applies them to TypeScript and TSX files).
 */
const tester = createTypeScriptJsxRuleTester();

tester.run("golden/tsx-smoke (no-unknown-parameters)", noUnknownParametersRule, {
  valid: [
    // JSX content must not confuse parameter analysis.
    `export function View(props: { title: string }): ReactNode {
       return <h1>{props.title}</h1>;
     }`,
  ],
  invalid: [
    {
      // Unknown param still reported inside a .tsx file.
      code: `export function View(props: unknown): ReactNode {
         return <h1>hi</h1>;
       }`,
      errors: [{ messageId: "unknownParameter" }],
    },
  ],
});

tester.run(
  "golden/tsx-smoke (require-safety-comment-for-type-assertion)",
  requireSafetyCommentForTypeAssertionRule,
  {
    valid: [
      `export function View(raw: string): ReactNode {
         // SAFETY: raw is a server-rendered trusted fragment.
         const node = raw as React.ReactNode;
         return <div>{node}</div>;
       }`,
    ],
    invalid: [
      {
        code: `export function View(raw: string): ReactNode {
           const node = raw as React.ReactNode;
           return <div>{node}</div>;
         }`,
        errors: [{ messageId: "missingSafetyComment" }],
      },
    ],
  },
);

tester.run("golden/tsx-smoke (no-runtime-typeof)", noRuntimeTypeofRule, {
  valid: [
    `export function View(x: unknown): x is string {
       return typeof x === "string";
     }`,
  ].map((code) => ({ code, options: [{ allowInTypeGuards: true }] })),
  invalid: [
    {
      code: `export function View(x: unknown): void {
        if (typeof x === "string") console.log(x);
      }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],
});
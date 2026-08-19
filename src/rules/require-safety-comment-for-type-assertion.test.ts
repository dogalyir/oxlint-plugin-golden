import { requireSafetyCommentForTypeAssertionRule } from "./require-safety-comment-for-type-assertion.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run(
  "golden/require-safety-comment-for-type-assertion",
  requireSafetyCommentForTypeAssertionRule,
  {
    valid: [
      // `as const` assertions are exempt.
      'const x = ["a", 1] as const;',
      // A SAFETY: comment immediately before the assertion.
      `const value = JSON.parse(raw);
// SAFETY: raw passed a JSON schema validator at the I/O boundary.
const parsed = value as { id: string };`,
      // SAFETY: comment attached to the outer source statement completes the exemption.
      `const value = JSON.parse(raw);
// SAFETY: invariant checked by owner before insertion.
const entry = value as { id: string };`,
      // SAFETY: comment directly above a variable declaration that owns the assertion.
      `// SAFETY: validated upstream, see handler.attach.
const response: Payload = fetchData() as Payload;`,
    ],
    invalid: [
      {
        code: 'const parsed = value as { id: string };',
        errors: [{ messageId: "missingSafetyComment" }],
      },
      {
        code: 'const parsed = <{ id: string }>value;',
        errors: [{ messageId: "missingSafetyComment" }],
      },
      {
        // A comment without the SAFETY: marker does not count.
        code: `// Just a plain explanation.
const parsed = value as { id: string };`,
        errors: [{ messageId: "missingSafetyComment" }],
      },
    ],
  },
);
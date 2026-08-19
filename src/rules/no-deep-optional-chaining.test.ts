import { noDeepOptionalChainingRule } from "./no-deep-optional-chaining.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-deep-optional-chaining", noDeepOptionalChainingRule, {
  valid: [
    // A single optional link is allowed: it may be genuinely optional.
    "const raw = example?.raw;",
    "const first = items?.[0];",
    // Non-optional members and parens break the chain.
    "const v = a.b?.c;",
    "const v = a?.b.c;",
    "const v = a.b.c;",
    "const v = (a?.b).c;",
    "const v = a?.b!;",
    "const v = a?.b;",
    // Custom maxLinks: three links are fine with maxLinks: 3.
    {
      code: "const raw = obj?.a?.b?.c;",
      options: [{ maxLinks: 3 }],
    },
  ],
  invalid: [
    // Chains with two or more optional links hide which value is uncertain.
    {
      code: "const id = messages?.[0]?.id;",
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: "const raw = obj?.a?.b?.c;",
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: "const v = a?.b?.();",
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: "const v = a?.b.c?.d;",
      errors: [{ messageId: "deepChain" }],
    },
    // Custom maxLinks: four links exceed maxLinks: 3.
    {
      code: "const raw = obj?.a?.b?.c?.d;",
      options: [{ maxLinks: 3 }],
      errors: [{ messageId: "deepChain" }],
    },
    // maxLinks: 0 forbids even a single optional link.
    {
      code: "const raw = example?.raw;",
      options: [{ maxLinks: 0 }],
      errors: [{ messageId: "deepChain" }],
    },
  ],
});

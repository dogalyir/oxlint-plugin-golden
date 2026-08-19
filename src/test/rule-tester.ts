import { RuleTester } from "oxlint/plugins-dev";;

/**
 * A `RuleTester` configured for TypeScript sources.
 *
 * `oxlint/plugins-dev`'s RuleTester rejects the Bun runtime; these tests run
 * under vitest (Node), which the harness supports.
 */
export function createTypeScriptRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parserOptions: { lang: "ts" },
    },
  });
}

/** A `RuleTester` configured for TypeScript with JSX (`tsx`). */
export function createTypeScriptJsxRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parserOptions: { lang: "tsx" },
    },
  });
}
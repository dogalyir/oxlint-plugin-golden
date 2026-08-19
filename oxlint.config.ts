import { defineConfig } from "oxlint";

/**
 * Golden Rules — local TypeScript plugin derived from `CodingStandards.md`.
 *
 * Every rule is activated as `error` for TypeScript sources. The plugin loads
 * from `./src/index.ts` with no extra parser: oxlint's built-in TypeScript
 * support provides the `ESTree` AST the rules inspect.
 */
export default defineConfig({
  plugins: ["typescript", "import"],
  jsPlugins: [{ name: "golden", specifier: "./src/index.ts" }],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        "golden/no-boolean-parameters": "error",
        "golden/no-chained-type-assertions": "error",
        "golden/no-deep-optional-chaining": "error",
        "golden/no-empty-object-types": "error",
        "golden/no-generic-names": "error",
        "golden/no-known-value-widening": "error",
        "golden/no-nested-conditionals": "error",
        "golden/no-object-parameters": "error",
        "golden/no-redundant-optional-undefined": "error",
        "golden/no-runtime-typeof": "error",
        "golden/no-unknown-parameters": "error",
        "golden/no-unknown-returns": "error",
        "golden/no-unknown-type-aliases": "error",
        "golden/no-unsafe-dictionary-type": "error",
        "golden/no-widen-then-assert": "error",
        "golden/require-safety-comment-for-type-assertion": "error",
        // Native oxlint rules covering CodingStandards.md policies that are
        // provable from syntax but are not custom plugin rules (all verified
        // to exist in oxlint 1.79).
        "no-empty": "error",
        "no-useless-catch": "error",
        // Practical magic-number policy: allow conventional 0/1/-1, array
        // indices, and default values; repeated domain constants still flagged.
        "no-magic-numbers": [
          "error",
          {
            ignore: [0, 1, -1],
            ignoreArrayIndexes: true,
            ignoreDefaultValues: true,
          },
        ],
        "no-nested-ternary": "error",
        "no-unneeded-ternary": "error",
        "no-lonely-if": "error",
        "no-param-reassign": ["error", { props: true }],
        "require-await": "error",
        "no-cycle": "error",
        "no-duplicate-imports": "error",
      },
    },
  ],
});
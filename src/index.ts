import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";

import { noBooleanParametersRule } from "./rules/no-boolean-parameters.ts";
import { noChainedTypeAssertionsRule } from "./rules/no-chained-type-assertions.ts";
import { noDeepOptionalChainingRule } from "./rules/no-deep-optional-chaining.ts";
import { noEmptyObjectTypesRule } from "./rules/no-empty-object-types.ts";
import { noGenericNamesRule } from "./rules/no-generic-names.ts";
import { noKnownValueWideningRule } from "./rules/no-known-value-widening.ts";
import { noNestedConditionalsRule } from "./rules/no-nested-conditionals.ts";
import { noObjectParametersRule } from "./rules/no-object-parameters.ts";
import { noRedundantOptionalUndefinedRule } from "./rules/no-redundant-optional-undefined.ts";
import { noRuntimeTypeofRule } from "./rules/no-runtime-typeof.ts";
import { noUnknownParametersRule } from "./rules/no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./rules/no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./rules/no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./rules/no-unsafe-dictionary-type.ts";
import { noWidenThenAssertRule } from "./rules/no-widen-then-assert.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./rules/require-safety-comment-for-type-assertion.ts";

/**
 * The Golden Rules plugin: TypeScript safety rules derived from
 * `CodingStandards.md`. Loaded through `eslintCompatPlugin` so every rule is
 * exposed under the `golden/` namespace in `oxlint.config.ts`.
 */
export const golden = definePlugin({
  meta: { name: "golden" },
  rules: {
    "no-boolean-parameters": noBooleanParametersRule,
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-deep-optional-chaining": noDeepOptionalChainingRule,
    "no-empty-object-types": noEmptyObjectTypesRule,
    "no-generic-names": noGenericNamesRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-nested-conditionals": noNestedConditionalsRule,
    "no-object-parameters": noObjectParametersRule,
    "no-redundant-optional-undefined": noRedundantOptionalUndefinedRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment-for-type-assertion":
      requireSafetyCommentForTypeAssertionRule,
  },
});

/**
 * ESLint-compatible plugin object for `oxlint.config.ts`'s `jsPlugins`:
 *
 * ```ts
 * import golden from "./src/index.ts";
 * defineConfig({ jsPlugins: [golden] });
 * ```
 */
export default eslintCompatPlugin(golden);
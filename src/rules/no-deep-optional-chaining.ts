import { defineRule, type ESTree, type Options } from "@oxlint/plugins";;

;

function countOptionalLinks(chain: ESTree.ChainExpression): number {
  let current: ESTree.Expression | null = chain.expression;
  let links = 0;
  while (current !== null) {
    switch (current.type) {
      case "MemberExpression":
        if (current.optional) links += 1;
        current = current.object;
        break;
      case "CallExpression":
        if (current.optional) links += 1;
        current = current.callee;
        break;
      case "TSNonNullExpression":
        current = current.expression;
        break;
      default:
        current = null;
    }
  }
  return links;
}

/** Default maximum number of `?.` links allowed in one chain. */
const DEFAULT_MAX_LINKS = 1;

/**
 * True when `candidate` is a real (finite, integer) number — but not a numeric
 * string, boolean, or null. Avoids `typeof` so the rule stays compatible with
 * `golden/no-runtime-typeof` when the plugin lints itself.
 */
function isFiniteInteger(
  candidate: Options[number] | undefined,
): candidate is number {
  return (
    candidate === Number(candidate) &&
    Number.isInteger(candidate) &&
    Number.isFinite(candidate)
  );
}

/**
 * Disallow deep optional chaining (`obj?.a?.b?.c`, `messages?.[0]?.id`).
 *
 * A chain with more than one optional link hides which value is uncertain.
 * Validate each required value with an explicit check and an early return
 * instead. A single `?.` is allowed: it may be a genuinely optional value
 * that is explicitly handled.
 */
export const noDeepOptionalChainingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow deep optional chaining (2+ `?.` links); require explicit validation of each required value.",
    },
    messages: {
      deepChain:
        "Deep optional chaining hides which value is uncertain. Validate each required value with an explicit check and an early return; keep at most one `?.` per chain.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxLinks: { type: "number", minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxLinks: DEFAULT_MAX_LINKS }],
  },
  createOnce(context) {
    return {
      ChainExpression(node) {
        const option = context.options?.[0];
        const rawMax =
          option instanceof Object && "maxLinks" in option
            ? option.maxLinks
            : undefined;
        const maxLinks =
          isFiniteInteger(rawMax) && rawMax >= 0
            ? rawMax
            : DEFAULT_MAX_LINKS;
        if (countOptionalLinks(node) > maxLinks) {
          context.report({ node, messageId: "deepChain" });
        }
      },
    };
  },
});

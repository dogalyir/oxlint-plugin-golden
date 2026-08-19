import { defineRule, type ESTree } from "@oxlint/plugins";;

import { unwrapExpressionParentheses, unwrapTypeParentheses } from "../shared/types.ts";;

;

type TypeAssertionExpression = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

function isTypeAssertionExpression(node: ESTree.Node): node is TypeAssertionExpression {
  return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}

function isConstAssertion(node: TypeAssertionExpression): boolean {
  const unwrapped = unwrapTypeParentheses(node.typeAnnotation);
  return (
    unwrapped.type === "TSTypeReference" &&
    unwrapped.typeName.type === "Identifier" &&
    unwrapped.typeName.name === "const"
  );
}

/**
 * True when this assertion is the outermost node of a chain, i.e. not nested
 * as the expression of a parent assertion (possibly through parentheses).
 */
function isOutermostAssertionInChain(node: TypeAssertionExpression): boolean {
  let current: ESTree.Expression = node;
  let parent = node.parent;

  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }

  return !isTypeAssertionExpression(parent) || parent.expression !== current;
}

/**
 * True when the chain contains more than one assertion and at least one of
 * them is not `as const`.
 */
function isForbiddenAssertionChain(node: TypeAssertionExpression): boolean {
  let assertionCount = 0;
  let hasNonConstAssertion = false;
  let current: ESTree.Expression = node;

  while (isTypeAssertionExpression(current)) {
    assertionCount += 1;
    hasNonConstAssertion ||= !isConstAssertion(current);
    current = unwrapExpressionParentheses(current.expression);
  }

  return assertionCount > 1 && hasNonConstAssertion;
}

/**
 * Disallow chained TypeScript type assertions (`as` chains and angle-bracket
 * assertions), including parenthesized chains.
 *
 * Chains only form when a non-const assertion is involved. A chain made
 * exclusively of `as const` assertions preserves inference and is allowed.
 */
export const noChainedTypeAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow chained `as`/angle-bracket type assertions (including parenthesized chains); allow chains made only of `as const`.",
    },
    messages: {
      chained:
        "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.",
    },
  },
  createOnce(context) {
    const checkTypeAssertion = (node: TypeAssertionExpression) => {
      if (!isOutermostAssertionInChain(node) || !isForbiddenAssertionChain(node)) return;
      context.report({ node, messageId: "chained" });
    };

    return {
      TSAsExpression: checkTypeAssertion,
      TSTypeAssertion: checkTypeAssertion,
    };
  },
});
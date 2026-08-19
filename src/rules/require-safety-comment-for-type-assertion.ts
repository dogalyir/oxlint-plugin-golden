import { defineRule, type ESTree, type SourceCode } from "@oxlint/plugins";

import { unwrapTypeParentheses } from "../shared/types.ts";

;

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

/** Statement/declaration kinds that can own a leading comment for an assertion. */
const commentOwnerKinds = new Set([
  "ExpressionStatement",
  "PropertyDefinition",
  "ReturnStatement",
  "ThrowStatement",
  "VariableDeclaration",
]);

function isConstAssertion(node: TypeAssertion): boolean {
  const unwrapped = unwrapTypeParentheses(node.typeAnnotation);
  return (
    unwrapped.type === "TSTypeReference" &&
    unwrapped.typeName.type === "Identifier" &&
    unwrapped.typeName.name === "const"
  );
}

/**
 * True when a `SAFETY:` comment precedes the assertion with no intervening
 * statement boundary. The comment may be attached to the assertion itself or
 * to the nearest owning statement, but must appear before the assertion's
 * start offset.
 */
function hasSafetyComment(sourceCode: SourceCode, node: TypeAssertion): boolean {
  let current: ESTree.Node = node;
  while (true) {
    if (
      sourceCode
        .getCommentsBefore(current)
        .some((comment) => comment.end <= node.start && /\bSAFETY\s*:/u.test(comment.value))
    ) {
      return true;
    }
    if (commentOwnerKinds.has(current.type) || current.parent.type === "Program") return false;
    current = current.parent;
  }
}

/**
 * Require a `SAFETY:` comment immediately before every non-const type
 * assertion. The comment must state the invariant the assertion encodes that
 * TypeScript cannot express. `as const` assertions preserve inference and are
 * exempt.
 */
export const requireSafetyCommentForTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a nearby `SAFETY:` comment for every non-const TypeScript type assertion.",
    },
    messages: {
      missingSafetyComment:
        "This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.",
    },
  },
  createOnce(context) {
    const checkAssertion = (node: TypeAssertion) => {
      if (isConstAssertion(node) || hasSafetyComment(context.sourceCode, node)) return;
      context.report({ node, messageId: "missingSafetyComment" });
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
import { defineRule, type ESTree } from "@oxlint/plugins";;

;

type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

/**
 * True when the node is lexically inside a function whose return type is a
 * `TSTypePredicate` (a type guard or assertion function).
 */
function isInsideTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }
    current = current.parent;
  }
  return false;
}

/**
 * Disallow runtime `typeof` checks used to narrow values ad hoc.
 *
 * A `typeof` check narrows a representation without establishing its contract;
 * decode the value at its I/O boundary instead and branch on the domain value.
 * With `allowInTypeGuards: true`, `typeof` is permitted inside an explicit
 * type guard / assertion function where the predicate is the boundary.
 */
export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ad hoc runtime `typeof` narrowing; require decoding at I/O boundaries instead. Optionally allow `typeof` inside explicit type guards.",
    },
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        const option = context.options?.[0];
        const allowInTypeGuards =
          option instanceof Object &&
          "allowInTypeGuards" in option &&
          option.allowInTypeGuards === true;
        if (
          node.operator === "typeof" &&
          (!allowInTypeGuards || !isInsideTypeGuard(node))
        ) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      },
    };
  },
});
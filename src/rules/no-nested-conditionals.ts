import { defineRule, type ESTree } from "@oxlint/plugins";

;

/**
 * The outer `if` when `node` is a flattenable nested conditional, or `null`.
 *
 * Flattenable means the inner `if` is the *only* statement of the consequent
 * of an outer `if` without an `else`, in either block or blockless form:
 *
 * ```ts
 * if (a) { if (b) { doWork(); } }   // -> if (!a) return; if (b) { doWork(); }
 * ```
 *
 * `else if` chains (`if (a) {} else if (b) {}`) are NOT nested conditionals:
 * they are idiomatic and stay allowed.
 */
function findFlattenableOuter(node: ESTree.IfStatement): ESTree.IfStatement | null {
  const parent = node.parent;
  if (parent !== null && parent.type === "IfStatement") {
    return parent.alternate === null && parent.consequent === node ? parent : null;
  }
  if (
    parent !== null &&
    parent.type === "BlockStatement" &&
    parent.body.length === 1 &&
    parent.body[0] === node
  ) {
    const outer = parent.parent;
    return outer !== null &&
      outer.type === "IfStatement" &&
      outer.alternate === null &&
      outer.consequent === parent
      ? outer
      : null;
  }
  return null;
}

/**
 * True when the nested `if` sits inside a function body, where an early
 * `return` is actually available to flatten the nesting. Top-level and
 * namespace-level nesting cannot be flattened and is left alone.
 */
function isInsideFunctionBody(node: ESTree.IfStatement): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Disallow nested conditionals that an early return can flatten.
 *
 * Validate first, exit immediately, keep the happy path clean: a `if` whose
 * whole body is another `if` (and nothing else) can be rewritten as a guard
 * clause, so the nesting is reported.
 */
export const noNestedConditionalsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow nested conditionals that can be flattened with an early return.",
    },
    messages: {
      nestedConditional:
        "Nested conditional that can be flattened with an early return. Validate first, exit immediately, keep the happy path clean.",
    },
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        const outer = findFlattenableOuter(node);
        if (outer !== null && isInsideFunctionBody(node)) {
          context.report({ node: outer, messageId: "nestedConditional" });
        }
      },
    };
  },
});

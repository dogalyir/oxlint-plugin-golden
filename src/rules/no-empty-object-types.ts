import { defineRule } from "@oxlint/plugins";

import { unwrapTypeParentheses } from "../shared/types.ts";

/**
 * Detect the empty object type `{}` and its use as a redundant intersection
 * member (`T & {}`), which adds no members and only weakens the contract.
 */
export const noEmptyObjectTypesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow the empty object type `{}` and its redundant use inside intersections (`T & {}`).",
    },
    messages: {
      emptyObject:
        "`{}` accepts any non-null value and discards the contract. Use a concrete owner type, or `unknown` at an explicit boundary.",
      redundantIntersection:
        "Intersecting with `{}` adds no members. Remove `& {}` and keep the concrete contract.",
    },
  },
  createOnce(context) {
    return {
      TSTypeLiteral(node) {
        if (node.members.length !== 0) return;
        // Inside an intersection, the redundant case has its own message.
        if (node.parent?.type === "TSIntersectionType") return;
        context.report({ node, messageId: "emptyObject" });
      },
      TSIntersectionType(node) {
        for (const member of node.types) {
          const unwrapped = unwrapTypeParentheses(member);
          if (unwrapped.type === "TSTypeLiteral" && unwrapped.members.length === 0) {
            context.report({ node: member, messageId: "redundantIntersection" });
          }
        }
      },
    };
  },
});
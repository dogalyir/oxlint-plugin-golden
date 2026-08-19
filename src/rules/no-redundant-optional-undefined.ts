import { defineRule, type ESTree } from "@oxlint/plugins";

import { typeReferenceName, unwrapTypeParentheses } from "../shared/types.ts";

;

/**
 * True when a type is an unapplied reference to one of the Maybe* utility
 * names that can encode an absent value (`MaybeUndefined`, `MaybeOptional`,
 * `MaybeVoid`).
 */
function isMaybeUndefinedAlias(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type !== "TSTypeReference") return false;
  const name = typeReferenceName(unwrapped);
  if (name === null) return false;
  switch (name) {
    case "MaybeUndefined":
    case "MaybeOptional":
    case "MaybeVoid":
      return true;
    default:
      return false;
  }
}

/** True when a type is an explicit union that contains `undefined`. */
function hasExplicitUndefinedUnion(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type !== "TSUnionType") return false;
  return unwrapped.types.some((member) => {
    const inner = unwrapTypeParentheses(member);
    return inner.type === "TSUndefinedKeyword";
  });
}

/**
 * Disallow the optional property syntax (`?`) combined with a `MaybeUndefined`
 * / `MaybeOptional` / `MaybeVoid` wrapper or an explicit union with
 * `undefined`.
 *
 * Both mechanisms already encode "may be absent"; combining them is redundant
 * and weakens the contract. Pick one: `waId?: string` or `waId: MaybeUndefined<string>`.
 */
export const noRedundantOptionalUndefinedRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `?` optional properties combined with MaybeUndefined/MaybeOptional/MaybeVoid wrappers or explicit `| undefined` unions.",
    },
    messages: {
      redundantOptional:
        "Property {{property}} combines the optional `?` with an explicit absence type. Pick one: `?` alone, or `name: MaybeUndefined<T>` without `?`.",
    },
  },
  createOnce(context) {
    const checkPropertySignature = (node: ESTree.TSPropertySignature) => {
      if (node.optional !== true) return;
      const annotation = node.typeAnnotation;
      if (annotation === null || annotation === undefined) return;
      const type = annotation.typeAnnotation;
      if (isMaybeUndefinedAlias(type) || hasExplicitUndefinedUnion(type)) {
        const name =
          node.key.type === "Identifier" ? node.key.name : context.sourceCode.getText(node.key);
        context.report({ node, messageId: "redundantOptional", data: { property: name } });
      }
    };

    return {
      TSPropertySignature: checkPropertySignature,
    };
  },
});
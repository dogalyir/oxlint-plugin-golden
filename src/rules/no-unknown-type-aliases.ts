import { defineRule, type ESTree } from "@oxlint/plugins";;

import { unwrapTypeParentheses } from "../shared/types.ts";;

;

/** The referenced alias name when `type` is an unapplied `TSTypeReference`, otherwise null. */
function referencedAliasName(type: ESTree.TSType): string | null {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type !== "TSTypeReference" || unwrapped.typeName.type !== "Identifier") {
    return null;
  }
  if (
    unwrapped.typeArguments !== undefined &&
    unwrapped.typeArguments !== null &&
    unwrapped.typeArguments.params.length > 0
  ) {
    return null;
  }
  return unwrapped.typeName.name;
}

/**
 * Disallow type aliases whose contract is directly `unknown` or a trivial
 * wrapper around `unknown` (parenthesized, union of `unknown`, or an alias
 * chain). A named alias hides the fact that the value is unparsed.
 */
export const noUnknownTypeAliasesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type aliases whose resolved contract is `unknown` or a trivial wrapper around `unknown`.",
    },
    messages: {
      unknownAlias:
        "Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.",
    },
  },
  createOnce(context) {
    const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();

    const resolvesToUnknown = (type: ESTree.TSType, visited = new Set<string>()): boolean => {
      if (type.type === "TSUnknownKeyword") return true;
      if (type.type === "TSParenthesizedType") {
        return resolvesToUnknown(type.typeAnnotation, visited);
      }
      const name = referencedAliasName(type);
      if (name === null || visited.has(name)) return false;
      const alias = aliases.get(name);
      if (
        alias === undefined ||
        (alias.typeParameters !== null && alias.typeParameters !== undefined)
      ) {
        return false;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(name);
      return resolvesToUnknown(alias.typeAnnotation, nextVisited);
    };

    return {
      Program(node) {
        aliases.clear();
        for (const statement of node.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type === "TSTypeAliasDeclaration") {
            aliases.set(declaration.id.name, declaration);
          }
        }
        for (const alias of aliases.values()) {
          if (!resolvesToUnknown(alias.typeAnnotation, new Set([alias.id.name]))) continue;
          context.report({
            node: alias.id,
            messageId: "unknownAlias",
            data: { alias: alias.id.name },
          });
        }
      },
    };
  },
});
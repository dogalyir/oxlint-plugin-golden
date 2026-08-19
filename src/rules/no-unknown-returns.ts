import { defineRule, type ESTree } from "@oxlint/plugins";;

import { unwrapTypeParentheses } from "../shared/types.ts";;

;

type FunctionWithReturnType =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature;

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
 * Disallow functions whose explicit return contract resolves to `unknown` or
 * `Promise<unknown>` (including through local non-generic aliases).
 *
 * Returning `unknown` leaks the parse step to every caller. Validate at the
 * boundary and return a named domain type instead.
 */
export const noUnknownReturnsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow function contracts that return `unknown` or `Promise<unknown>`.",
    },
    messages: {
      unknownReturn:
        "This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.",
    },
  },
  createOnce(context) {
    const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();

    const resolvesToUnknown = (
      type: ESTree.TSType,
      shadowedAliases: ReadonlySet<string>,
      visited = new Set<string>(),
    ): boolean => {
      if (type.type === "TSUnknownKeyword") return true;
      if (type.type === "TSParenthesizedType") {
        return resolvesToUnknown(type.typeAnnotation, shadowedAliases, visited);
      }
      if (type.type === "TSUnionType") {
        return type.types.some((member) =>
          resolvesToUnknown(member, shadowedAliases, visited),
        );
      }
      if (
        type.type === "TSTypeReference" &&
        type.typeName.type === "Identifier" &&
        (type.typeName.name === "Promise" || type.typeName.name === "PromiseLike")
      ) {
        const paramType = type.typeArguments?.params[0];
        return paramType !== undefined && resolvesToUnknown(paramType, shadowedAliases, visited);
      }
      const name = referencedAliasName(type);
      if (name === null || visited.has(name) || shadowedAliases.has(name)) return false;
      const alias = aliases.get(name);
      if (
        alias === undefined ||
        (alias.typeParameters !== null && alias.typeParameters !== undefined)
      ) {
        return false;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(name);
      return resolvesToUnknown(alias.typeAnnotation, shadowedAliases, nextVisited);
    };

    const checkReturnType = (node: FunctionWithReturnType) => {
      const annotation = node.returnType;
      if (annotation === null || annotation === undefined) return;
      if (
        !resolvesToUnknown(
          annotation.typeAnnotation,
          new Set(
            (node.typeParameters?.params ?? []).map((t) => t.name.name),
          ),
        )
      ) {
        return;
      }
      context.report({ node: annotation.typeAnnotation, messageId: "unknownReturn" });
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
      },
      ArrowFunctionExpression: checkReturnType,
      FunctionDeclaration: checkReturnType,
      FunctionExpression: checkReturnType,
      TSCallSignatureDeclaration: checkReturnType,
      TSConstructSignatureDeclaration: checkReturnType,
      TSConstructorType: checkReturnType,
      TSDeclareFunction: checkReturnType,
      TSEmptyBodyFunctionExpression: checkReturnType,
      TSFunctionType: checkReturnType,
      TSMethodSignature: checkReturnType,
    };
  },
});
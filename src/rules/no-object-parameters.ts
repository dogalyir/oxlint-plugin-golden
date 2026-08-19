import { defineRule, type ESTree, type SourceCode } from "@oxlint/plugins";;

;

type Parameter = ESTree.ParamPattern;

type ParameterOwner =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature;

/** Resolve the explicit type annotation on a parameter after unwrapping wrappers. */
function parameterAnnotation(
  parameter: Parameter,
): ESTree.TSTypeAnnotation | null | undefined {
  if (parameter.type === "TSParameterProperty") {
    return parameterAnnotation(parameter.parameter);
  }
  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? parameterAnnotation(parameter.left);
  }
  return parameter.typeAnnotation;
}

/** The human-readable name of a parameter, falling back to source text minus `: object`. */
function parameterName(parameter: Parameter, sourceCode: SourceCode): string {
  return parameter.type === "Identifier"
    ? parameter.name
    : sourceCode.getText(parameter).replace(/\s*:\s*object\s*$/u, "");
}

/**
 * Disallow the broad `object` type as a function input, including through local
 * non-generic aliases that resolve to `object`.
 *
 * `object` gives callers no member contract. Accept an owner-provided named
 * type and parse external input at its boundary.
 */
export const noObjectParametersRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `object` function parameters, including aliases that resolve to `object`.",
    },
    messages: {
      objectParameter:
        "Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.",
    },
  },
  createOnce(context) {
    const aliases = new Map<string, ESTree.TSType>();

    const resolvesToObject = (
      type: ESTree.TSType,
      shadowedAliases: ReadonlySet<string>,
      visited = new Set<string>(),
    ): boolean => {
      if (type.type === "TSObjectKeyword") return true;
      if (type.type === "TSParenthesizedType") {
        return resolvesToObject(type.typeAnnotation, shadowedAliases, visited);
      }
      if (type.type === "TSUnionType") {
        return type.types.some((member) =>
          resolvesToObject(member, shadowedAliases, visited),
        );
      }
      if (
        type.type !== "TSTypeReference" ||
        type.typeName.type !== "Identifier" ||
        (type.typeArguments !== null &&
          type.typeArguments !== undefined &&
          type.typeArguments.params.length > 0) ||
        visited.has(type.typeName.name) ||
        shadowedAliases.has(type.typeName.name)
      ) {
        return false;
      }
      const alias = aliases.get(type.typeName.name);
      if (alias === undefined) return false;
      const nextVisited = new Set(visited);
      nextVisited.add(type.typeName.name);
      return resolvesToObject(alias, shadowedAliases, nextVisited);
    };

    const checkParameters = (node: ParameterOwner) => {
      const shadowedAliases = new Set(
        (node.typeParameters?.params ?? []).map((t) => t.name.name),
      );
      for (const parameter of node.params) {
        const annotation = parameterAnnotation(parameter);
        if (annotation === null || annotation === undefined) continue;
        if (!resolvesToObject(annotation.typeAnnotation, shadowedAliases)) continue;
        context.report({
          node: annotation.typeAnnotation,
          messageId: "objectParameter",
          data: { parameter: parameterName(parameter, context.sourceCode) },
        });
      }
    };

    return {
      Program(node) {
        aliases.clear();
        for (const statement of node.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (
            declaration?.type === "TSTypeAliasDeclaration" &&
            (declaration.typeParameters === null || declaration.typeParameters === undefined)
          ) {
            aliases.set(declaration.id.name, declaration.typeAnnotation);
          }
        }
      },
      ArrowFunctionExpression: checkParameters,
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      TSCallSignatureDeclaration: checkParameters,
      TSConstructSignatureDeclaration: checkParameters,
      TSConstructorType: checkParameters,
      TSDeclareFunction: checkParameters,
      TSEmptyBodyFunctionExpression: checkParameters,
      TSFunctionType: checkParameters,
      TSMethodSignature: checkParameters,
    };
  },
});
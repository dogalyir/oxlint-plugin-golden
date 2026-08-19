import { defineRule, type ESTree, type Variable } from "@oxlint/plugins";

import { unwrapExpressionParentheses, unwrapTypeParentheses } from "../shared/types.ts";

;

type BroadTypeKind = "top" | "object" | "record";

/** A `Record` type always takes exactly two type arguments (`<K, V>`). */
const RECORD_TYPE_ARGUMENT_COUNT = 2;

const functionBoundaryTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

function unwrapTypeParens(type: ESTree.TSType): ESTree.TSType {
  return unwrapTypeParentheses(type);
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

function isUnknownOrAnyType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParens(type);
  return unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword";
}

function isBroadRecordKeyType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParens(type);
  if (
    unwrapped.type === "TSStringKeyword" ||
    unwrapped.type === "TSNumberKeyword" ||
    unwrapped.type === "TSSymbolKeyword"
  ) {
    return true;
  }
  if (unwrapped.type === "TSUnionType") return unwrapped.types.every(isBroadRecordKeyType);
  return unwrapped.type === "TSTypeReference" && typeReferenceName(unwrapped) === "PropertyKey";
}

/** `Record<string, unknown>` / `Record<string, any>` and index-signature twins. */
function isBroadRecordType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParens(type);

  if (unwrapped.type === "TSTypeReference") {
    if (typeReferenceName(unwrapped) === "Readonly") {
      const [inner] = unwrapped.typeArguments?.params ?? [];
      return inner !== undefined && isBroadRecordType(inner);
    }
    if (typeReferenceName(unwrapped) !== "Record") return false;
    const parameters = unwrapped.typeArguments?.params ?? [];
    return (
      parameters.length === RECORD_TYPE_ARGUMENT_COUNT &&
      parameters[0] !== undefined &&
      parameters[1] !== undefined &&
      isBroadRecordKeyType(parameters[0]) &&
      isUnknownOrAnyType(parameters[1])
    );
  }

  if (unwrapped.type !== "TSTypeLiteral" || unwrapped.members.length !== 1) return false;
  const member = unwrapped.members[0];
  if (member === undefined || member.type !== "TSIndexSignature") return false;
  const parameter = member.parameters[0];
  return (
    member.parameters.length === 1 &&
    parameter !== undefined &&
    parameter.typeAnnotation !== null &&
    parameter.typeAnnotation !== undefined &&
    isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) &&
    member.typeAnnotation !== null &&
    member.typeAnnotation !== undefined &&
    isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
  );
}

/** Classify a broad lossy contract: `unknown`/`any`, `object`, or `Record<K, unknown>`. */
function broadTypeKind(type: ESTree.TSType): BroadTypeKind | null {
  const unwrapped = unwrapTypeParens(type);
  if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword") return "top";
  if (unwrapped.type === "TSObjectKeyword") return "object";
  return isBroadRecordType(unwrapped) ? "record" : null;
}

function assertedExpression(
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): ESTree.Expression {
  return unwrapExpressionParentheses(node.expression);
}

function assertionFromExpression(
  expression: ESTree.Expression,
): ESTree.TSAsExpression | ESTree.TSTypeAssertion | null {
  const unwrapped = unwrapExpressionParentheses(expression);
  return unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion"
    ? unwrapped
    : null;
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
  return sourceText.slice(type.start, type.end).replaceAll(/\s+/gu, "");
}

function typesHaveSameSyntax(
  sourceText: string,
  left: ESTree.TSType | null,
  right: ESTree.TSType,
): boolean {
  return (
    left !== null &&
    normalizedTypeText(sourceText, unwrapTypeParens(left)) ===
      normalizedTypeText(sourceText, unwrapTypeParens(right))
  );
}

function isDefinitelyObjectType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParens(type);
  switch (unwrapped.type) {
    case "TSArrayType":
    case "TSConstructorType":
    case "TSFunctionType":
    case "TSMappedType":
    case "TSObjectKeyword":
    case "TSTupleType":
      return true;
    case "TSTypeLiteral":
      return unwrapped.members.length > 0;
    case "TSIntersectionType":
      return unwrapped.types.every(isDefinitelyObjectType);
    case "TSTypeOperator":
      return unwrapped.operator === "readonly" && isDefinitelyObjectType(unwrapped.typeAnnotation);
    default:
      return false;
  }
}

function isDefinitelyNarrowerRecordType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParens(type);
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type !== "TSIndexSignature");
  }
  if (unwrapped.type !== "TSTypeReference") return false;
  if (typeReferenceName(unwrapped) === "Readonly") {
    const [inner] = unwrapped.typeArguments?.params ?? [];
    return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
  }
  if (typeReferenceName(unwrapped) !== "Record") return false;
  const parameters = unwrapped.typeArguments?.params ?? [];
  return (
    parameters.length === RECORD_TYPE_ARGUMENT_COUNT &&
    parameters[1] !== undefined &&
    !isUnknownOrAnyType(parameters[1])
  );
}

function functionBoundary(node: ESTree.Node): ESTree.Node | null {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (functionBoundaryTypes.has(current.type)) return current;
    current = current.parent;
  }
  return null;
}

type ScopeLike = {
  readonly references: readonly {
    readonly identifier: ESTree.Node;
    readonly resolved: Variable | null;
  }[];
};

function resolvedVariableForIdentifier(
  scopes: readonly ScopeLike[],
  identifier: ESTree.IdentifierReference,
): Variable | null {
  for (const scope of scopes) {
    const reference = scope.references.find(
      (candidate) =>
        candidate.identifier.start === identifier.start &&
        candidate.identifier.end === identifier.end,
    );
    if (reference !== undefined) return reference.resolved;
  }
  return null;
}

function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | null {
  for (const definition of variable.defs) {
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
      return definition.node;
    }
  }
  return null;
}

/** True for immediate expressions that establish known value shape. */
function hasLiteralShapeEvidence(expression: ESTree.Expression): boolean {
  const unwrapped = unwrapExpressionParentheses(expression);
  return (
    unwrapped.type === "ArrayExpression" ||
    unwrapped.type === "ArrowFunctionExpression" ||
    unwrapped.type === "ClassExpression" ||
    unwrapped.type === "FunctionExpression" ||
    unwrapped.type === "NewExpression" ||
    unwrapped.type === "ObjectExpression" ||
    unwrapped.type === "Literal" ||
    unwrapped.type === "TemplateLiteral" ||
    unwrapped.type === "BinaryExpression" ||
    unwrapped.type === "UnaryExpression"
  );
}

/**
 * Determine what known value flows into an assertion target: the precise
 * asserted type of an `as`-expression, or a statically resolvable literal /
 * const-binding with no annotation. Returns `null` when the evidence cannot be
 * statically established.
 */
function knownValueEvidence(
  expression: ESTree.Expression,
  scopes: readonly ScopeLike[],
  boundary: ESTree.Node | null,
  visitedVariables: ReadonlySet<Variable>,
): { readonly type: ESTree.TSType | null; readonly broadened: boolean } | null {
  const unwrapped = unwrapExpressionParentheses(expression);

  if (unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion") {
    if (broadTypeKind(unwrapped.typeAnnotation) !== null) {
      return { type: null, broadened: true };
    }
    return { type: unwrapped.typeAnnotation, broadened: false };
  }

  if (unwrapped.type === "Literal" || unwrapped.type === "TemplateLiteral") {
    return { type: null, broadened: false };
  }

  if (
    unwrapped.type === "ArrayExpression" ||
    unwrapped.type === "ArrowFunctionExpression" ||
    unwrapped.type === "ClassExpression" ||
    unwrapped.type === "FunctionExpression" ||
    unwrapped.type === "NewExpression" ||
    unwrapped.type === "ObjectExpression"
  ) {
    return { type: null, broadened: false };
  }

  if (unwrapped.type !== "Identifier") return null;
  const variable = resolvedVariableForIdentifier(scopes, unwrapped);
  if (variable === null || visitedVariables.has(variable)) return null;

  const annotated = variable.identifiers.find(
    (identifier) =>
      identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
  );
  const annotation =
    annotated === undefined ? undefined : annotated.typeAnnotation?.typeAnnotation;
  if (annotation !== undefined && annotated !== undefined) {
    if (functionBoundary(annotated) !== boundary) return null;
    // Only a same-function binding that widens a *known* value counts:
    // `const parsed: unknown = {...}` is an internal widening; an `unknown`
    // parameter is an external boundary, not a widening, so it is left alone.
    const declarator = variableDeclarator(variable);
    if (declarator === null || declarator.init === null) return null;
    const init = unwrapExpressionParentheses(declarator.init);
    if (init.type === "Identifier") {
      const initializer = resolvedVariableForIdentifier(scopes, init);
      if (initializer === null || visitedVariables.has(initializer)) return null;
      const nextVisited = new Set(visitedVariables);
      nextVisited.add(variable);
      const followed = knownValueEvidence(init, scopes, boundary, nextVisited);
      if (followed === null || followed.type === null) return null;
    } else if (!hasLiteralShapeEvidence(init)) {
      return null;
    }
    return { type: annotation, broadened: broadTypeKind(annotation) !== null };
  }

  const declarator = variableDeclarator(variable);
  if (declarator === null || declarator.init === null) return null;
  const nextVisited = new Set(visitedVariables);
  nextVisited.add(variable);
  return knownValueEvidence(declarator.init, scopes, boundary, nextVisited);
}

function isRecoveryAssertion(
  sourceText: string,
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
  source: { readonly type: ESTree.TSType | null },
): boolean {
  const assertionType = unwrapTypeParens(node.typeAnnotation);
  // Recovery into a named (or `const`) type is never reported: named types can
  // be genuine contracts and `as const` only freezes literals.
  if (
    assertionType.type === "TSTypeReference" &&
    (assertionType.typeName.type !== "Identifier" ||
      assertionType.typeName.name !== "const")
  ) {
    return false;
  }

  if (typesHaveSameSyntax(sourceText, source.type, node.typeAnnotation)) return true;

  if (isDefinitelyObjectType(node.typeAnnotation)) {
    if (isDefinitelyObjectType(assertionType)) return true;
    return (
      assertionType.type === "TSTypeLiteral" &&
      assertionType.members.some((member) => member.type === "TSIndexSignature")
    );
  }

  if (
    source.type !== null &&
    isDefinitelyNarrowerRecordType(source.type) &&
    isDefinitelyNarrowerRecordType(assertionType)
  ) {
    return true;
  }

  return false;
}

/**
 * Disallow the widening-then-asserting pattern: a known value is explicitly
 * widened (an annotated `unknown`/`object`/`Record<K, unknown>` binding, or
 * asserted to a broad type), then recovered via a second assertion inside the
 * same function boundary.
 *
 * The leaf assertion is only reported when a syntactically recognizable,
 * non-broad source type can be established; `satisfies` and `as const`
 * assertions are never recovered, and cross-file/unresolvable evidence is
 * left alone to avoid false positives.
 */
export const noWidenThenAssertRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow explicitly widening a known value and then asserting it back to a precise type within the same function.",
    },
    messages: {
      wideningThenAsserting:
        "This assertion recovers a type that was intentionally widened at {{origin}}. Keep the known value's type through `satisfies` or a named owner contract instead of widen-then-assert.",
    },
  },
  createOnce(context) {
    const checkAssertion = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      if (node.parent?.type === "TSAsExpression" || node.parent?.type === "TSTypeAssertion") {
        return;
      }
      const expression = assertedExpression(node);
      const boundary = functionBoundary(node);
      if (boundary === null) return;
      const scopes: readonly ScopeLike[] = [
        context.sourceCode.getScope(node),
        ...(context.sourceCode.getDeclaredVariables(node) ?? []),
      ];
      const evidence = knownValueEvidence(expression, scopes, boundary, new Set());
      if (evidence === null) return;
      // A broad flow (annotated `unknown` binding or `as unknown` expression)
      // that is asserted back to a structural precise type is the reported
      // widen-then-recover pattern. `as const` and named targets are never
      // recoveries.
      if (evidence.broadened) {
        if (broadTypeKind(node.typeAnnotation) === null) {
          const target = unwrapTypeParens(node.typeAnnotation);
          if (
            target.type === "TSTypeLiteral" ||
            target.type === "TSIntersectionType" ||
            target.type === "TSUnionType" ||
            target.type === "TSArrayType" ||
            target.type === "TSTupleType"
          ) {
            context.report({
              node,
              messageId: "wideningThenAsserting",
              data: { origin: "a widened binding or assertion" },
            });
          }
        }
        return;
      }
      if (evidence.type === null) return;
      const recovery = assertionFromExpression(expression);
      if (recovery !== null && isRecoveryAssertion(context.sourceCode.text, node, evidence)) {
        context.report({ node, messageId: "wideningThenAsserting", data: { origin: "a broadening assertion" } });
      }
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
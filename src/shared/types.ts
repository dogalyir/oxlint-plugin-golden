import { type ESTree, type Options } from "@oxlint/plugins";;

/**
 * Unwrap `ParenthesizedExpression` nodes, returning the innermost non-paren expression.
 */
export function unwrapExpressionParentheses(
  expression: ESTree.Expression,
): ESTree.Expression {
  let current = expression;
  while (current.type === "ParenthesizedExpression") {
    current = current.expression;
  }
  return current;
}

/**
 * Unwrap `TSParenthesizedType` nodes, returning the innermost non-paren type.
 */
export function unwrapTypeParentheses(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (current.type === "TSParenthesizedType") {
    current = current.typeAnnotation;
  }
  return current;
}

/**
 * True if the expression is any of `as X`, `<X>...`, `satisfies`, or non-null `!`.
 */
export function isWrappingExpression(
  expression: ESTree.Expression,
): expression is
  | ESTree.ParenthesizedExpression
  | ESTree.TSAsExpression
  | ESTree.TSTypeAssertion
  | ESTree.TSSatisfiesExpression
  | ESTree.TSNonNullExpression {
  return (
    expression.type === "ParenthesizedExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "TSTypeAssertion" ||
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSNonNullExpression"
  );
}

/**
 * Fully unwrap wrapping expressions, including parenthesized chains.
 */
export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
  let current = expression;
  while (isWrappingExpression(current)) {
    current = current.expression;
  }
  return current;
}

/**
 * Name of a `TSTypeReference` when it is a plain identifier reference, otherwise `null`.
 */
export function typeReferenceName(
  type: ESTree.TSTypeReference,
): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

/** True when the type is `unknown` (after unwrapping parens). */
export function isUnknownKeyword(type: ESTree.TSType): boolean {
  return unwrapTypeParentheses(type).type === "TSUnknownKeyword";
}

/** True when the type is `any` (after unwrapping parens). */
export function isAnyKeyword(type: ESTree.TSType): boolean {
  return unwrapTypeParentheses(type).type === "TSAnyKeyword";
}

/** True when the type is `object` (after unwrapping parens). */
export function isObjectKeyword(type: ESTree.TSType): boolean {
  return unwrapTypeParentheses(type).type === "TSObjectKeyword";
}

/**
 * True when the type is the empty object literal `{}` (after unwrapping parens).
 *
 * A `TSTypeLiteral` with no members is `{}`. Note `{}` may appear as the sole
 * member of a `TSTypeLiteral` node only when the source literally has no members.
 */
export function isEmptyObjectTypeLiteral(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  return (
    unwrapped.type === "TSTypeLiteral" && unwrapped.members.length === 0
  );
}

/**
 * True when the expression is an empty object literal `{}` (after unwrapping
 * wrapping expressions).
 */
export function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(expression);
  return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}

/**
 * Read a string-list rule option (`{ [key]: string[] }`), falling back to
 * `fallback` when the option is absent, not an array, or contains no strings.
 *
 * Deliberately avoids `typeof` so rules using it stay compatible with
 * `golden/no-runtime-typeof` when the plugin lints itself.
 */
export function readStringListOption(
  option: Options[number] | undefined,
  key: string,
  fallback: string[],
): string[] {
  if (option instanceof Object) {
    const rawValue = Reflect.get(option, key);
    if (Array.isArray(rawValue)) {
      const strings = rawValue.filter(
        (entry): entry is string => entry === String(entry),
      );
      if (strings.length > 0) return strings;
    }
  }
  return fallback;
}
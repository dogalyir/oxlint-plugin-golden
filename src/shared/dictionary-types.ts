import { isWrappingExpression, unwrapTypeParentheses } from "./types.ts";;

import { type ESTree } from "@oxlint/plugins";;

/**
 * The concrete kind of an unsafe dictionary value type, used in diagnostics.
 */
export type UnsafeValueKind =
  | "any"
  | "empty-object"
  | "object"
  | "union"
  | "unknown";

/**
 * A resolved, classified unsafe dictionary contract.
 */
export type UnsafeDictionary = {
  readonly kind: "unsafe-dictionary";
  readonly unsafeValue: UnsafeValueKind;
};

const BUILT_INS = new Set([
  "Record",
  "Readonly",
  "Partial",
  "Required",
  "Pick",
  "Omit",
  "PropertyKey",
  "NonNullable",
]);
const TRANSPARENT_WRAPPERS = new Set([
  "Readonly",
  "Partial",
  "Required",
  "NonNullable",
]);

type TypeAliasEnvironment = ReadonlyMap<string, ESTree.TSType>;

type ResolvedType = {
  readonly type: ESTree.TSType;
  readonly substitutions: TypeAliasEnvironment;
};

/**
 * Information about type aliases and interfaces declared in the file, enough to
 * resolve `Record<...>`, index signatures, mapped types, and alias wrappers.
 */
export type TypeEnvironment = {
  readonly aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>;
  readonly interfaces: ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]>;
  readonly shadowedBuiltIns: ReadonlySet<string>;
};

function declaredStatement(statement: ESTree.Statement): ESTree.Node | null {
  return statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
    ? (statement.declaration ?? null)
    : statement;
}

/**
 * Build a type environment from the top-level statements of a program.
 *
 * Tracks aliases/interfaces for resolution and marks built-in names (Record,
 * Readonly, ...) that are shadowed locally so built-in semantics do not apply
 * to them.
 */
export function createTypeEnvironment(program: ESTree.Program): TypeEnvironment {
  const aliases = new Map<string, ESTree.TSTypeAliasDeclaration>();
  const interfaces = new Map<string, ESTree.TSInterfaceDeclaration[]>();
  const shadowedBuiltIns = new Set<string>();

  for (const statement of program.body) {
    const declaration = declaredStatement(statement);
    if (declaration?.type === "ImportDeclaration") {
      for (const specifier of declaration.specifiers) {
        if (BUILT_INS.has(specifier.local.name)) {
          shadowedBuiltIns.add(specifier.local.name);
        }
      }
      continue;
    }

    if (declaration?.type === "TSTypeAliasDeclaration") {
      if (aliases.has(declaration.id.name) || BUILT_INS.has(declaration.id.name)) {
        shadowedBuiltIns.add(declaration.id.name);
      }
      aliases.set(declaration.id.name, declaration);
      continue;
    }

    if (declaration?.type === "TSInterfaceDeclaration") {
      const existing = interfaces.get(declaration.id.name) ?? [];
      existing.push(declaration);
      interfaces.set(declaration.id.name, existing);
      if (BUILT_INS.has(declaration.id.name)) shadowedBuiltIns.add(declaration.id.name);
      continue;
    }

    if (declaration?.type === "TSEnumDeclaration" && BUILT_INS.has(declaration.id.name)) {
      shadowedBuiltIns.add(declaration.id.name);
      continue;
    }

    if (
      (declaration?.type === "ClassDeclaration" ||
        declaration?.type === "FunctionDeclaration") &&
      declaration.id !== null &&
      BUILT_INS.has(declaration.id.name)
    ) {
      shadowedBuiltIns.add(declaration.id.name);
    }
  }

  return { aliases, interfaces, shadowedBuiltIns };
}

function isBuiltIn(name: string, environment: TypeEnvironment): boolean {
  return BUILT_INS.has(name) && !environment.shadowedBuiltIns.has(name);
}

function isUnappliedReferenceTo(type: ESTree.TSType, name: string): boolean {
  const unwrapped = unwrapTypeParentheses(type);
  return (
    unwrapped.type === "TSTypeReference" &&
    unwrapped.typeName.type === "Identifier" &&
    unwrapped.typeName.name === name &&
    (unwrapped.typeArguments === null ||
      unwrapped.typeArguments === undefined ||
      unwrapped.typeArguments.params.length === 0)
  );
}

function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation;
  }
  return current;
}

function isNeverType(type: ESTree.TSType): boolean {
  return unwrapTransparentType(type).type === "TSNeverKeyword";
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
  return (
    member.type === "TSPropertySignature" &&
    member.optional === true &&
    member.typeAnnotation !== null &&
    member.typeAnnotation !== undefined &&
    isNeverType(member.typeAnnotation.typeAnnotation)
  );
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
  return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}

function isEffectivelyEmptyInterface(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): boolean {
  if (declarations.length !== 1) return false;
  const [interface_] = declarations;
  if (interface_ === undefined) return false;
  return (
    interface_.extends.length === 0 &&
    (interface_.body.body.length === 0 || interface_.body.body.every(isEffectivelyEmptyMember))
  );
}

function resolvedSubstitutionArgument(
  type: ESTree.TSType,
  base: TypeAliasEnvironment,
  resolving: ReadonlySet<string> = new Set(),
): ESTree.TSType {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type !== "TSTypeReference") return type;
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null || resolving.has(name)) return type;
  const substitution = base.get(name);
  if (substitution === undefined) return type;
  const nextResolving = new Set(resolving);
  nextResolving.add(name);
  return resolvedSubstitutionArgument(substitution, base, nextResolving);
}

function aliasSubstitution(
  alias: ESTree.TSTypeAliasDeclaration,
  type: ESTree.TSTypeReference,
  base: TypeAliasEnvironment,
): TypeAliasEnvironment | null {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = type.typeArguments?.params ?? [];
  const next = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index] ?? parameter.default;
    if (argument === null || argument === undefined) return null;
    next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next));
  }
  return next;
}

function unsafeDirectValue(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValueKind | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword") return "unknown";
  if (unwrapped.type === "TSAnyKeyword") return "any";
  if (unwrapped.type === "TSObjectKeyword") return "object";
  if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped)) {
    return "empty-object";
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some(
      (member) => unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== null,
    )
      ? "union"
      : null;
  }
  if (unwrapped.type === "TSIntersectionType") {
    const unsafeMembers = unwrapped.types.map((member) =>
      unsafeDirectValue(member, environment, substitutions, resolvingAliases),
    );
    if (unsafeMembers.includes("any")) return "any";
    const firstUnsafe = unsafeMembers.find((member) => member !== null);
    return firstUnsafe === undefined ? null : firstUnsafe;
  }
  if (unwrapped.type !== "TSTypeReference") return null;
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null) return null;

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases);
  }
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? null
      : unsafeDirectValue(substitution, environment, substitutions, resolvingAliases);
  }
  const interfaceDeclarations = environment.interfaces.get(name);
  if (interfaceDeclarations !== undefined) {
    return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : null;
  }
  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name)) return null;
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) return null;
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return unsafeDirectValue(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function dictionaryValueTypes(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.flatMap((member): readonly ResolvedType[] =>
      member.type === "TSIndexSignature" && member.typeAnnotation !== null
        ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
        : [],
    );
  }

  if (unwrapped.type === "TSMappedType") {
    return unwrapped.typeAnnotation === null
      ? []
      : [{ type: unwrapped.typeAnnotation, substitutions }];
  }

  if (unwrapped.type !== "TSTypeReference") return [];
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null) return [];

  const substitution = substitutions.get(name);
  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? []
      : dictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
  }

  if (name === "Record" && isBuiltIn(name, environment)) {
    const paramType = unwrapped.typeArguments?.params[1] ?? null;
    return paramType === null ? [] : [{ type: paramType, substitutions }];
  }

  if ((name === "Pick" || name === "Omit") && isBuiltIn(name, environment)) {
    const source = unwrapped.typeArguments?.params[0];
    return source === undefined
      ? []
      : dictionaryValueTypes(source, environment, substitutions, resolvingAliases);
  }

  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name)) return [];
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) return [];
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return dictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

/** Classify the unsafe-ness of a dictionary value type directly. */
export function classifyUnsafeDictionaryValue(
  valueType: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  const unsafeValue = unsafeDirectValue(valueType, environment, new Map(), new Set());
  return unsafeValue === null ? null : { kind: "unsafe-dictionary", unsafeValue };
}

/** Classify whether a type is a dictionary whose value type is unsafe. */
export function classifyUnsafeDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  for (const valueType of dictionaryValueTypes(type, environment, new Map(), new Set())) {
    const unsafeValue = unsafeDirectValue(
      valueType.type,
      environment,
      valueType.substitutions,
      new Set(),
    );
    if (unsafeValue !== null) return { kind: "unsafe-dictionary", unsafeValue };
  }
  return null;
}

/**
 * The kind of a broadening target type, used by `no-known-value-widening`.
 */
export type WideningTargetKind =
  | "anonymous object"
  | "generic container"
  | "object"
  | "open dictionary"
  | "unknown";

export type WideningTarget = { readonly kind: WideningTargetKind };

function resolvesToDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): boolean {
  return dictionaryValueTypes(type, environment, substitutions, resolvingAliases).length > 0;
}

function isBroadMappedKey(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
): boolean {
  const unwrapped = unwrapTransparentType(type);
  if (
    unwrapped.type === "TSStringKeyword" ||
    unwrapped.type === "TSNumberKeyword" ||
    unwrapped.type === "TSSymbolKeyword"
  ) {
    return true;
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.every((member) =>
      isBroadMappedKey(member, environment, substitutions),
    );
  }
  if (unwrapped.type !== "TSTypeReference") return false;
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null) return false;
  const substitution = substitutions.get(name);
  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return isBroadMappedKey(substitution, environment, substitutions);
  }
  return name === "PropertyKey" && isBuiltIn(name, environment);
}

/** Recursively classify a broad target, following non-generic local aliases. */
function classifyAliasBroadTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
  if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type === "TSIndexSignature")
      ? { kind: "open dictionary" }
      : null;
  }
  if (unwrapped.type === "TSMappedType") {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
      ? { kind: "open dictionary" }
      : null;
  }
  if (unwrapped.type !== "TSTypeReference") return null;
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null) return null;
  const substitution = substitutions.get(name);
  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
  }
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
  }
  if (name === "Record" && isBuiltIn(name, environment)) {
    return { kind: "open dictionary" };
  }
  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name)) return null;
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) return null;
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    nextSubstitutions,
    nextResolving,
  );
}

/**
 * Classify a type as a broadening target when it discards known evidence:
 * `unknown`, `object`, open dictionary types, anonymous object literals, and
 * generic containers that resolve to dictionaries. Returns `null` for precise
 * owner contracts.
 */
export function classifyWideningTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword") return { kind: "unknown" };
  if (unwrapped.type === "TSObjectKeyword") return { kind: "object" };
  if (unwrapped.type === "TSTypeLiteral") {
    if (unwrapped.members.some((member) => member.type === "TSIndexSignature")) {
      return { kind: "open dictionary" };
    }
    return unwrapped.members.length > 0 ? { kind: "anonymous object" } : null;
  }
  if (unwrapped.type === "TSMappedType") return { kind: "open dictionary" };
  if (unwrapped.type !== "TSTypeReference") return null;
  const name = unwrapped.typeName.type === "Identifier" ? unwrapped.typeName.name : null;
  if (name === null) return null;
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : classifyWideningTarget(wrapped, environment);
  }
  if (name === "Record" && isBuiltIn(name, environment)) return { kind: "open dictionary" };
  const alias = environment.aliases.get(name);
  if (alias === undefined) return null;
  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    const substitutions = aliasSubstitution(alias, unwrapped, new Map());
    if (
      substitutions !== null &&
      resolvesToDictionary(alias.typeAnnotation, environment, substitutions, new Set([name]))
    ) {
      return { kind: "generic container" };
    }
    return null;
  }
  const substitutions = aliasSubstitution(alias, unwrapped, new Map());
  if (substitutions === null) return null;
  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    substitutions,
    new Set([name]),
  );
}

/** True when the expression syntactically establishes known value evidence. */
export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
  let current = expression;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression"
  ) {
    current = current.expression;
  }
  if (current.type === "ObjectExpression") return true;
  return (
    current.type === "ArrayExpression" ||
    current.type === "ArrowFunctionExpression" ||
    current.type === "ClassExpression" ||
    current.type === "FunctionExpression" ||
    current.type === "NewExpression" ||
    current.type === "Literal" ||
    current.type === "TemplateLiteral" ||
    current.type === "UnaryExpression" ||
    current.type === "BinaryExpression"
  );
}

/** True when the expression is an empty object literal `{}` (after unwrapping). */
export function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
  let current = expression;
  while (isWrappingExpression(current)) {
    current = current.expression;
  }
  return current.type === "ObjectExpression" && current.properties.length === 0;
}
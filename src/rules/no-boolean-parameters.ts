import { defineRule, type ESTree } from "@oxlint/plugins";;

import { readStringListOption, unwrapTypeParentheses } from "../shared/types.ts";;

;

/** Default name prefixes that make a boolean parameter's meaning clear. */
const DEFAULT_BOOLEAN_PREFIXES = [
  "is",
  "has",
  "should",
  "can",
  "will",
  "may",
  "must",
  "allow",
  "enable",
  "disable",
  "require",
  "supports",
];

/**
 * Simple identifier name of a parameter, or `null` for destructured,
 * rest, and parameter-property forms (no single readable name).
 */
function parameterName(param: ESTree.ParamPattern): string | null {
  if (param.type === "TSParameterProperty") return null;
  if (param.type === "RestElement") return null;
  let target: ESTree.BindingPattern = param;
  if (target.type === "AssignmentPattern") target = target.left;
  return target.type === "Identifier" ? target.name : null;
}

/**
 * The parameter's declared type annotation, or `null` when absent.
 * The annotation may live on the pattern or on an assignment pattern's left
 * side (`flags: boolean = true`).
 */
function parameterType(param: ESTree.ParamPattern): ESTree.TSType | null {
  if (param.type === "TSParameterProperty") return null;
  if (param.type === "RestElement") return null;
  let target: ESTree.BindingPattern = param;
  if (target.type === "AssignmentPattern") target = target.left;
  return target.typeAnnotation?.typeAnnotation ?? null;
}

/** True when the type (after unwrapping parens) is the `boolean` keyword. */
function isBooleanKeyword(type: ESTree.TSType): boolean {
  return unwrapTypeParentheses(type).type === "TSBooleanKeyword";
}

/**
 * Disallow `boolean` parameters whose name does not read as a boolean.
 *
 * A bare boolean parameter (`run(force)`) hides which behavior it selects.
 * Names with an explicit boolean prefix (`isActive`, `shouldRetry`) state
 * their meaning and are allowed; for anything else prefer an options object
 * or separate functions.
 */
export const noBooleanParametersRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow boolean parameters whose name does not read as a boolean; prefer options objects or separate functions.",
    },
    messages: {
      booleanParameter:
        "Boolean parameter `{{name}}` hides which behavior it selects. Use a clear boolean name (`isActive`, `shouldRetry`), an options object, or separate functions.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedNamePrefixes: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowedNamePrefixes: DEFAULT_BOOLEAN_PREFIXES }],
  },
  createOnce(context) {
    function checkParams(params: ESTree.ParamPattern[]): void {
      const allowedNamePrefixes = readStringListOption(
        context.options?.[0],
        "allowedNamePrefixes",
        DEFAULT_BOOLEAN_PREFIXES,
      );
      const hasClearName = (name: string): boolean =>
        allowedNamePrefixes.some((prefix) => name.startsWith(prefix));
      for (const param of params) {
        const name = parameterName(param);
        if (name === null || hasClearName(name)) continue;
        const type = parameterType(param);
        if (type === null || !isBooleanKeyword(type)) continue;
        context.report({ node: param, messageId: "booleanParameter", data: { name } });
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node.params);
      },
      FunctionExpression(node) {
        checkParams(node.params);
      },
      ArrowFunctionExpression(node) {
        checkParams(node.params);
      },
    };
  },
});

import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import { readStringListOption } from "../shared/types.ts";

;

/** Default generic names that hide domain meaning. */
const DEFAULT_GENERIC_NAMES = [
  "data",
  "item",
  "payload",
  "result",
  "value",
  "obj",
  "tmp",
  "arr",
  "stuff",
  "thing",
];

/**
 * Simple identifier name of a binding, or `null` when the binding is a
 * destructuring pattern (no single readable name).
 */
function bindingName(pattern: ESTree.BindingPattern): string | null {
  let target = pattern;
  if (target.type === "AssignmentPattern") target = target.left;
  return target.type === "Identifier" ? target.name : null;
}

/**
 * Disallow generic, domain-free names (`data`, `item`, `payload`, `result`)
 * for variables, parameters, functions, and type aliases.
 *
 * A generic name hides what the value means. Use a domain-specific name; when
 * the meaning is known, say it (`rawInvoices`, `updatedUser`, `retryCount`).
 * The list is configurable through the `names` option.
 */
export const noGenericNamesRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic names like `data`, `item`, or `payload`; require domain-specific names.",
    },
    messages: {
      genericName:
        "`{{name}}` is a generic name that hides domain meaning. Name it by what it represents (e.g. `rawInvoices`, `updatedUser`).",
    },
    schema: [
      {
        type: "object",
        properties: {
          names: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ names: DEFAULT_GENERIC_NAMES }],
  },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        const names = readStringListOption(context.options?.[0], "names", DEFAULT_GENERIC_NAMES);
        const isGeneric = (name: string): boolean => names.includes(name);
        if (node.id.type === "ObjectPattern" || node.id.type === "ArrayPattern") {
          return;
        }
        const name = bindingName(node.id);
        if (name !== null && isGeneric(name)) {
          context.report({ node: node.id, messageId: "genericName", data: { name } });
        }
      },
      FunctionDeclaration(node) {
        const names = readStringListOption(context.options?.[0], "names", DEFAULT_GENERIC_NAMES);
        const isGeneric = (name: string): boolean => names.includes(name);
        if (node.id !== null && isGeneric(node.id.name)) {
          context.report({ node: node.id, messageId: "genericName", data: { name: node.id.name } });
        }
        for (const param of node.params) {
          checkParameter(context, param, isGeneric);
        }
      },
      FunctionExpression(node) {
        const names = readStringListOption(context.options?.[0], "names", DEFAULT_GENERIC_NAMES);
        const isGeneric = (name: string): boolean => names.includes(name);
        if (node.id !== null && isGeneric(node.id.name)) {
          context.report({ node: node.id, messageId: "genericName", data: { name: node.id.name } });
        }
        for (const param of node.params) {
          checkParameter(context, param, isGeneric);
        }
      },
      ArrowFunctionExpression(node) {
        const names = readStringListOption(context.options?.[0], "names", DEFAULT_GENERIC_NAMES);
        const isGeneric = (name: string): boolean => names.includes(name);
        for (const param of node.params) {
          checkParameter(context, param, isGeneric);
        }
      },
      TSTypeAliasDeclaration(node) {
        const names = readStringListOption(context.options?.[0], "names", DEFAULT_GENERIC_NAMES);
        if (isGenericName(node.id.name, names)) {
          context.report({ node: node.id, messageId: "genericName", data: { name: node.id.name } });
        }
      },
    };
  },
});

function isGenericName(name: string, names: string[]): boolean {
  return names.includes(name);
}

function checkParameter(
  context: Context,
  param: ESTree.ParamPattern,
  isGeneric: (name: string) => boolean,
): void {
  if (param.type === "TSParameterProperty") return;
  if (param.type === "RestElement") return;
  let target: ESTree.BindingPattern = param;
  if (target.type === "AssignmentPattern") target = target.left;
  if (target.type === "Identifier" && isGeneric(target.name)) {
    context.report({ node: target, messageId: "genericName", data: { name: target.name } });
  }
}

import { noGenericNamesRule } from "./no-generic-names.ts";
import { createTypeScriptRuleTester } from "../test/rule-tester.ts";

const tester = createTypeScriptRuleTester();

tester.run("golden/no-generic-names", noGenericNamesRule, {
  valid: [
    // Domain-specific names are fine.
    "const rawInvoices = fetchInvoices();",
    "function send(message: string): void {}",
    "function updatedUser(): number { return 1; }",
    "type User = { id: string };",
    "const f = (invoice: number): void => {};",
    "function map(invoices: string[]): void {}",
    "for (const invoice of invoices) {}",
    "export function getResult(): number { return 1; }",
    // Destructured patterns have no single name to judge.
    "const { data } = response;",
    "const [item] = items;",
    // Custom names list replaces the default.
    {
      code: "const data = 1;",
      options: [{ names: ["blob"] }],
    },
  ],
  invalid: [
    // Generic names hide domain meaning.
    {
      code: "const data = fetchInvoices();",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "function send(payload: string): void {}",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "function result(): number { return 1; }",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "type data = { id: string };",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const f = (item: number): void => {};",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "const value = 42;",
      errors: [{ messageId: "genericName" }],
    },
    {
      code: "function map(item: string[]): void {}",
      errors: [{ messageId: "genericName" }],
    },
    // Custom names list applies to new entries.
    {
      code: "const blob = 1;",
      options: [{ names: ["blob"] }],
      errors: [{ messageId: "genericName" }],
    },
  ],
});

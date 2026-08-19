# oxlint-golden-rules

Local, reusable [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) plugin that turns
[`CodingStandards.md`](./CodingStandards.md) — the project's strict TypeScript coding
standards — into 12 enforceable lint rules.

The plugin is a plain `@oxlint/plugins` package: no extra parser, no ESLint runtime, and
no TypeScript type-checker dependency. It inspects the ESTree AST that oxlint's built-in
TypeScript support already produces, so it drops into any Oxlint setup.

> `CodingStandards.md` remains the original source of intent and is **not modified** by
> this package. The plugin implements the policies that are provable from the AST alone;
> the rest is documented as [limits](#limits-policies-this-plugin-cannot-enforce).

---

## Quick start

```bash
# install dependencies (Bun is the package manager; vitest runs tests under Node,
# because oxlint's RuleTester rejects the Bun runtime)
bun install

# full validation
bun run check        # typecheck && lint && test

# individual scripts
bun run typecheck    # tsc --noEmit
bun run lint         # oxlint .
bun run test         # vitest run (RuleTester suites)
```

## Adding the plugin to another Oxlint repository

The plugin is self-contained in `src/`. Copy the `src/` directory (or install this
package) into the target repository, add `@oxlint/plugins` to `dependencies`, and wire it
in `oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript"], // built-in TS support powers the AST
  jsPlugins: [{ name: "golden", specifier: "./src/index.ts" }],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        "golden/no-chained-type-assertions": "error",
        "golden/no-known-value-widening": "error",
        "golden/no-empty-object-types": "error",
        "golden/no-object-parameters": "error",
        "golden/no-redundant-optional-undefined": "error",
        "golden/no-runtime-typeof": "error",
        "golden/no-unknown-parameters": "error",
        "golden/no-unknown-returns": "error",
        "golden/no-unknown-type-aliases": "error",
        "golden/no-unsafe-dictionary-type": "error",
        "golden/no-widen-then-assert": "error",
        "golden/require-safety-comment-for-type-assertion": "error",
      },
    },
  ],
});
```

`jsPlugins` accepts the plugin through `eslintCompatPlugin` (the default export of
`src/index.ts`), so every rule is exposed under the `golden/` namespace. No parser
configuration is required — oxlint's TypeScript language support provides the ESTree AST.

---

## Rule catalog

Every rule is derived from a numbered policy in `CodingStandards.md`. Rules are
deliberately syntactic: they catch the shape of the violation, not the (unreachable)
semantic truth, so there are no false negatives by construction on the listed patterns —
and no fragile heuristics.

### 1. `golden/no-chained-type-assertions`

Source: standards §2.

Disallow chained type assertions (`as unknown as X`, `<T>x as U`, parenthesized chains).
A chain made **only** of `as const` assertions preserves inference and is allowed.

```ts
// invalid
const x = {} as object as { id: string };
const y = (value as string) as number;

// valid
const tuple = ["a", 1] as const;
const id = value as string; // single assertion: handled by rule 2
```

### 2. `golden/require-safety-comment-for-type-assertion`

Source: standards §2.

Every non-const type assertion needs a `SAFETY:` justification immediately before the
assertion or its containing statement. `as const` is exempt.

```ts
// invalid
const parsed = value as { id: string };

// valid
// SAFETY: raw passed a JSON schema validator at the I/O boundary.
const parsed = value as { id: string };
```

### 3. `golden/no-unknown-parameters`

Source: standards §3–4 (unparsed input must not flow into functions).

Disallow explicit `unknown` parameters. Decode at the I/O boundary instead. The single
documented exception is a parameter named `cause` (the standard `Error` enrichment slot).

```ts
// invalid
function parse(data: unknown): void {}
const run = (payload: unknown) => {};

// valid
function parse(data: { id: string }): void {}
function fail(error: Error, cause: unknown): void {}
```

### 4. `golden/no-unknown-returns`

Source: standards §4 (predictable, typed returns).

Disallow function contracts that return `unknown` or `Promise<unknown>` — including
through local non-generic aliases. Parse at the boundary and return a named domain type.

```ts
// invalid
function load(): unknown { return JSON.parse(raw); }
async function get(): Promise<unknown> { return await fetchJson(); }

// valid
function load(): { id: string } { return { id: raw.id }; }
async function get(): Promise<string> { return await fetchText(); }
```

### 5. `golden/no-unknown-type-aliases`

Source: standards §1, §3.

Disallow type aliases whose resolved contract is directly `unknown` or a trivial wrapper
(parenthesized, alias chain). A named alias hides the fact that the value is unparsed.

```ts
// invalid
type Blob = unknown;
type Data = unknown;
type Payload = Data;

// valid
type UserId = string;
type Payload = { id: string; name: string };
```

### 6. `golden/no-unsafe-dictionary-type`

Source: standards §2 (`(await res.json()) as Record<string, unknown>`) and §8.

Disallow object-dictionary contracts (`Record<K, V>`, index signatures, mapped types)
whose value type is an escape hatch: `unknown`, `any`, `object`, `{}`, or a union/alias
containing one. Alias declarations are reported at the declaration site; consuming an
existing alias elsewhere in the file stays silent.

```ts
// invalid
const map: Record<string, unknown> = {};
interface Cache { [key: string]: any; }
type Dict = Record<string, object>;

// valid
const map: Record<string, number> = {};
type Registry = Record<string, { id: string }>;
```

### 7. `golden/no-object-parameters`

Source: standards §1 (weak types), §3.

Disallow the broad `object` type as a function input, including non-generic aliases that
resolve to `object`. Callers get no member contract.

```ts
// invalid
function log(detail: object): void {}
type Fn = (input: object) => void;

// valid
function log(detail: { id: string; message: string }): void {}
```

### 8. `golden/no-runtime-typeof`

Source: standards §3–4 (validate, don't narrow ad hoc).

Disallow runtime `typeof` narrowing of a representation without an established contract.
Decode at the I/O boundary and branch on the domain value.

Option `allowInTypeGuards` (default `false`) allows `typeof` inside explicit type guards /
assertion functions, where the predicate **is** the boundary:

```ts
// config
"golden/no-runtime-typeof": ["error", { allowInTypeGuards: true }],

// invalid (default)
function f(x: unknown): void { if (typeof x === "string") console.log(x); }

// valid (with allowInTypeGuards: true)
function isString(x: unknown): x is string { return typeof x === "string"; }
```

### 9. `golden/no-known-value-widening`

Source: standards §1 (inference first), §2.

Disallow explicit target types that discard syntactically established value evidence:
`unknown`, `object`, open dictionaries, anonymous object literals, and generic dictionary
containers. Keep inference or use `satisfies`/a named owner contract.

```ts
// invalid
const user: unknown = { id: "1", name: "Ana" };
const payload: Record<string, number> = { count: 2 };
function f(): object { return { id: "1" }; }

// valid
const user = { id: "1", name: "Ana" }; // inference
const shape = { id: "1" } satisfies { id: string };
const acc: Record<string, number> = {}; // empty accumulator: no evidence lost
```

### 10. `golden/no-widen-then-assert`

Source: standards §2 (`as unknown as X`).

Detect local flow that intentionally widens a known value (`const parsed: unknown = {...}`
or `= {...} as unknown`) and then asserts it back to a structural precise type inside the
same function. Single assertions of external `unknown` parameters are boundaries, not
widenings, and stay silent; `as const` and named target types are never recoveries.

```ts
// invalid
function f(): { id: string } {
  const parsed: unknown = { id: "1" };
  return parsed as { id: string };
}

// valid
function f(raw: unknown): { id: string } {
  // SAFETY: raw passed schema validation at the port.
  return raw as { id: string };
}
```

### 11. `golden/no-empty-object-types`

Source: standards §1 (avoid `{}` and `& {}`).

Disallow the empty object type `{}` and its redundant use in intersections (`T & {}`),
which adds no members and only weakens the contract.

```ts
// invalid
type Empty = {};
type Combined = { a: string } & {};

// valid
type Payload = { id: string };
```

### 12. `golden/no-redundant-optional-undefined`

Source: standards §1 (Property Optionality).

Disallow the `?` property syntax combined with a `MaybeUndefined` / `MaybeOptional` /
`MaybeVoid` wrapper or an explicit `| undefined` union. Pick one mechanism.

```ts
// invalid
interface Props { id?: string | undefined; }
interface Props { id?: MaybeUndefined<string>; }

// valid
interface Props { id?: string; }
interface Props { id: MaybeUndefined<string>; }
```

---

## Architecture

```
src/
├── index.ts                       # definePlugin + eslintCompatPlugin (default export)
├── rules/                         # one file + one RuleTester suite per rule
│   ├── no-chained-type-assertions.ts/.test.ts
│   ├── require-safety-comment-for-type-assertion.ts/.test.ts
│   ├── no-unknown-parameters.ts/.test.ts
│   ├── no-unknown-returns.ts/.test.ts
│   ├── no-unknown-type-aliases.ts/.test.ts
│   ├── no-unsafe-dictionary-type.ts/.test.ts
│   ├── no-object-parameters.ts/.test.ts
│   ├── no-runtime-typeof.ts/.test.ts
│   ├── no-known-value-widening.ts/.test.ts
│   ├── no-widen-then-assert.ts/.test.ts
│   ├── no-empty-object-types.ts/.test.ts
│   ├── no-redundant-optional-undefined.ts/.test.ts
│   └── tsx-smoke.test.ts          # cross-checks rules under .tsx parsing
├── shared/                        # helpers shared across rules
│   ├── types.ts                   # paren unwrapping, wrapping wrappers, kind predicates
│   └── dictionary-types.ts        # type environment, unsafe-dictionary + widening classifiers
└── test/rule-tester.ts            # RuleTester factories (ts / tsx)
```

All rules use only the `ESTree` API from `@oxlint/plugins` (`defineRule`,
`definePlugin`, `eslintCompatPlugin`, visitor keys, `sourceCode`). There are no forced
casts in the plugin code.

## Limits: policies this plugin cannot enforce

`CodingStandards.md` also contains policies that are not provable from the AST alone.
Enforcing them syntactically would produce fragile heuristics, so they are deliberately
**documented as review/type-system limits** instead:

- **Early/early-return control flow** (§3): requires data-flow semantics. The plugin
  approximates only the *types* (`unknown`, `object`) that force runtime checks; the
  ordering of validation is a code-review concern.
- **Optional chaining as non-validation** (§3): `obj?.a?.b` may be legitimate when
  absence is acceptable. A blanket ban would be a false-positive factory.
- **Zod/schema usage** (§4): requiring specific validation libraries is a project
  convention, not an AST property. The rules instead forbid the *type* smell
  (`Record<string, unknown>`, `unknown` params/returns) that schema validation exists to
  remove.
- **Naming and magic literals** (§6, §9): naming quality and literal reuse need semantic
  knowledge; oxlint's `no-magic-numbers` and naming rulesets exist for the mechanical part.
- **Boolean parameters, hidden side effects, deterministic functions** (§5, §7): only a
  type-aware review can judge these reliably; the subset demonstrable from syntax is
  covered by the 12 rules above.

These boundaries are intentional: the plugin enforces what is exactly provable from the
AST and documents the rest, matching the standards' own "strict but honest" intent.

## Development

```bash
bun run check        # typecheck + lint + test — must pass before shipping a change
bun run typecheck    # tsc --noEmit  (tsconfig keeps strict, noEmit, exactOptionalPropertyTypes)
bun run lint         # oxlint .      (the plugin enforces its own rules on itself)
bun run test         # vitest run    (RuleTester suites; Node required, Bun rejected by oxlint's RuleTester)
```

Adding a rule: create `src/rules/<name>.ts` with `defineRule`, register it in
`src/index.ts` and `oxlint.config.ts`, then add `<name>.test.ts` with RuleTester
`valid`/`invalid` cases, including the exception branches (`as const`, `SAFETY:`,
`cause`, type guards, `satisfies`, legitimate optionals).

## License

MIT — local plugin derived from the project's own `CodingStandards.md`.
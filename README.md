# oxlint-plugin-golden

Opinionated [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) rules that turn the
strict TypeScript coding standard in [`CodingStandards.md`](./CodingStandards.md) into
**16 enforceable lint rules**, plus a curated set of native Oxlint rules for the policies
that syntax alone can prove.

The plugin inspects the ESTree AST that Oxlint's built-in TypeScript support produces —
no extra parser, no ESLint runtime, no type-checker dependency. It is structured like
[`oxlint-plugin-anti-slop`](https://github.com/dmmulroy/anti-slop) and published to npm
with the same release pipeline as
[`opencode-auto-translate`](https://github.com/dogalyir/opencode-auto-translate).

> `CodingStandards.md` remains the original source of intent and is **not modified** by
> this package. Policies that cannot be proven from the AST alone are documented as
> [limits](#limits-policies-this-plugin-cannot-enforce) instead of fragile heuristics.

---

## Installation

```bash
bun add -d oxlint-plugin-golden
# or
npm install --save-dev oxlint-plugin-golden
```

The package ships a prebuilt `dist/index.js` (built with `bun build`), so no build step
is needed in the consuming repository.

## Configuration

Add the plugin under the `golden/` namespace and enable the rules you want — the full
set, matching the standard's "strict enforcement", as `error`:

```ts
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "import"],
  jsPlugins: [{ name: "golden", specifier: "oxlint-plugin-golden" }],
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      rules: {
        // 16 custom golden rules
        "golden/no-boolean-parameters": "error",
        "golden/no-chained-type-assertions": "error",
        "golden/no-deep-optional-chaining": "error",
        "golden/no-empty-object-types": "error",
        "golden/no-generic-names": "error",
        "golden/no-known-value-widening": "error",
        "golden/no-nested-conditionals": "error",
        "golden/no-object-parameters": "error",
        "golden/no-redundant-optional-undefined": "error",
        "golden/no-runtime-typeof": "error",
        "golden/no-unknown-parameters": "error",
        "golden/no-unknown-returns": "error",
        "golden/no-unknown-type-aliases": "error",
        "golden/no-unsafe-dictionary-type": "error",
        "golden/no-widen-then-assert": "error",
        "golden/require-safety-comment-for-type-assertion": "error",

        // Native oxlint rules covering provable non-custom policies
        "no-empty": "error",
        "no-useless-catch": "error",
        "no-magic-numbers": [
          "error",
          { ignore: [0, 1, -1], ignoreArrayIndexes: true, ignoreDefaultValues: true },
        ],
        "no-nested-ternary": "error",
        "no-unneeded-ternary": "error",
        "no-lonely-if": "error",
        "no-param-reassign": ["error", { props: true }],
        "require-await": "error",
        "no-cycle": "error",
        "no-duplicate-imports": "error",
      },
    },
  ],
});
```

**Local development / forking:** use `jsPlugins: [{ name: "golden", specifier: "./src/index.ts" }]`
with the `src/` directory copied into the repository instead of the npm package.

---

## Rule catalog

Every rule is derived from a numbered policy in `CodingStandards.md`. Rules are
deliberately syntactic: they catch the shape of the violation — no fragile heuristics, no
false negatives on the listed patterns.

### 1. `golden/no-chained-type-assertions`

Source: standards §2. Disallow chained type assertions (`as unknown as X`, `<T>x as U`).
A chain made **only** of `as const` preserves inference and is allowed.

```ts
// invalid
const x = {} as object as { id: string };
const y = (value as string) as number;

// valid
const tuple = ["a", 1] as const;
```

### 2. `golden/require-safety-comment-for-type-assertion`

Source: standards §2. Every non-const type assertion needs a `SAFETY:` justification
immediately before the assertion or its containing statement.

```ts
// invalid
const parsed = value as { id: string };

// valid
// SAFETY: raw passed a JSON schema validator at the I/O boundary.
const parsed = value as { id: string };
```

### 3. `golden/no-unknown-parameters`

Source: standards §3–4. Disallow explicit `unknown` parameters — decode at the I/O
boundary instead. The single documented exception is a parameter named `cause` (the
standard `Error` enrichment slot).

```ts
// invalid
function parse(data: unknown): void {}

// valid
function parse(data: { id: string }): void {}
function fail(error: Error, cause: unknown): void {}
```

### 4. `golden/no-unknown-returns`

Source: standards §4. Disallow function contracts that return `unknown` or
`Promise<unknown>` — including through local non-generic aliases.

```ts
// invalid
function load(): unknown { return JSON.parse(raw); }
async function get(): Promise<unknown> { return await fetchJson(); }

// valid
function load(): { id: string } { return { id: raw.id }; }
```

### 5. `golden/no-unknown-type-aliases`

Source: standards §1, §3. Disallow type aliases whose resolved contract is directly
`unknown` or a trivial wrapper.

```ts
// invalid
type Blob = unknown;
type Payload = Data; // when `type Data = unknown` is in scope

// valid
type UserId = string;
```

### 6. `golden/no-unsafe-dictionary-type`

Source: standards §2, §8. Disallow object-dictionary contracts (`Record<K, V>`, index
signatures, mapped types) whose value type is an escape hatch: `unknown`, `any`,
`object`, `{}`, or a union/alias containing one. Alias declarations are reported at the
declaration site; consuming an existing alias elsewhere stays silent.

```ts
// invalid
const map: Record<string, unknown> = {};
interface Cache { [key: string]: any; }

// valid
const map: Record<string, number> = {};
type Registry = Record<string, { id: string }>;
```

### 7. `golden/no-object-parameters`

Source: standards §1, §3. Disallow the broad `object` type as a function input.

```ts
// invalid
function log(detail: object): void {}

// valid
function log(detail: { id: string; message: string }): void {}
```

### 8. `golden/no-runtime-typeof`

Source: standards §3–4. Disallow runtime `typeof` narrowing of a representation without
an established contract. Option `allowInTypeGuards` (default `false`) allows `typeof`
inside explicit type guards / assertion functions, where the predicate **is** the
boundary:

```ts
// config
"golden/no-runtime-typeof": ["error", { allowInTypeGuards: true }],

// invalid (default)
function f(x: unknown): void { if (typeof x === "string") console.log(x); }

// valid (with allowInTypeGuards: true)
function isString(x: unknown): x is string { return typeof x === "string"; }
```

### 9. `golden/no-known-value-widening`

Source: standards §1, §2. Disallow explicit target types that discard syntactically
established value evidence: `unknown`, `object`, open dictionaries, anonymous object
literals, and generic dictionary containers. Keep inference or use `satisfies`.

```ts
// invalid
const user: unknown = { id: "1", name: "Ana" };
const payload: Record<string, number> = { count: 2 };

// valid
const user = { id: "1", name: "Ana" }; // inference
const shape = { id: "1" } satisfies { id: string };
const acc: Record<string, number> = {}; // empty accumulator: no evidence lost
```

### 10. `golden/no-widen-then-assert`

Source: standards §2. Detect local flow that intentionally widens a known value
(`const parsed: unknown = {...}` or `= {...} as unknown`) and asserts it back to a
structural precise type inside the same function. Single assertions of external `unknown`
parameters are boundaries, not widenings, and stay silent.

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

Source: standards §1. Disallow the empty object type `{}` and its redundant use in
intersections (`T & {}`).

```ts
// invalid
type Empty = {};
type Combined = { a: string } & {};

// valid
type Payload = { id: string };
```

### 12. `golden/no-redundant-optional-undefined`

Source: standards §1 (Property Optionality). Disallow the `?` property syntax combined
with a `MaybeUndefined` / `MaybeOptional` / `MaybeVoid` wrapper or an explicit
`| undefined` union. Pick one mechanism.

```ts
// invalid
interface Props { id?: string | undefined; }
interface Props { id?: MaybeUndefined<string>; }

// valid
interface Props { id?: string; }
interface Props { id: MaybeUndefined<string>; }
```

### 13. `golden/no-deep-optional-chaining`

Source: standards §3, §8. Disallow optional chains with more than one `?.` link
(`obj?.a?.b?.c`, `messages?.[0]?.id`): each chain must state which single value is
optional, and required values must be validated explicitly with early returns. A single
`?.` is allowed — it may be a genuinely optional value that is explicitly handled.
Option `maxLinks` (default `1`) sets the allowed number of links.

```ts
// invalid
const id = messages?.first?.id;
const raw = obj?.a?.b?.c;

// valid
const raw = example?.raw; // single optional link, explicitly handled
const first = items?.[0];
```

### 14. `golden/no-boolean-parameters`

Source: standards §5, §9. Disallow `boolean` parameters whose name does not read as a
boolean — a bare flag hides which behavior it selects. Names with an explicit boolean
prefix (`isActive`, `shouldRetry`) state their meaning and are allowed. Option
`allowedNamePrefixes` (default: `is, has, should, can, will, may, must, allow, enable,
disable, require, supports`) customizes the exemption.

```ts
// invalid
function run(force: boolean): void {}
function query(cache: boolean, id: string): void {}

// valid
function render(isActive: boolean): void {}
function retry(shouldRetry: boolean): void {}
```

### 15. `golden/no-generic-names`

Source: standards §9. Disallow domain-free names — `data`, `item`, `payload`, `result`,
`value`, `obj`, `tmp`, `arr`, `stuff`, `thing` — for variables, parameters, functions,
and type aliases. Name it by what it represents. Option `names` replaces the default
list. Destructured patterns are exempt (no single name to judge).

```ts
// invalid
const data = fetchInvoices();
function send(payload: string): void {}
type Data = { id: string };

// valid
const rawInvoices = fetchInvoices();
function send(message: string): void {}
type User = { id: string };
```

### 16. `golden/no-nested-conditionals`

Source: standards §3. Disallow an `if` whose whole body is another `if` (inside a
function, without an `else`): it can be flattened with an early return. `else if` chains
stay allowed; top-level nesting is left alone (no early return available there).

```ts
// invalid
function f(a: boolean, b: boolean): void {
  if (a) {
    if (b) { work(); }
  }
}

// valid — guard clause
function f(a: boolean, b: boolean): void {
  if (!a) return;
  if (b) { work(); }
}
```

---

## Native rules configured (CodingStandards.md policies)

These policies are provable from syntax and covered by Oxlint's own rules (all verified
against Oxlint 1.79; the plugin's config activates them):

| Policy | Rule | Note |
| --- | --- | --- |
| No empty `catch` blocks (§4) | `no-empty` | |
| No catch that only rethrows (§4) | `no-useless-catch` | |
| No magic numbers (§6) | `no-magic-numbers` | ignores `0/1/-1`, array indices, defaults |
| No nested/complex ternaries (§3) | `no-nested-ternary`, `no-unneeded-ternary` | |
| No lonely `else { if }` (§3) | `no-lonely-if` | |
| No input mutation (§8) | `no-param-reassign` | `props: true` covers property mutation |
| No async without `await` (§7) | `require-await` | |
| No circular dependencies (§10) | `no-cycle` | requires the `import` plugin |
| No duplicate imports (§10) | `no-duplicate-imports` | |

## Limits: policies this plugin cannot enforce

`CodingStandards.md` also contains policies that are not provable from the AST alone.
They are deliberately **documented as review/type-system limits** instead of fragile
heuristics:

- **Floating promises** (§7): Oxlint 1.79's `no-floating-promises` never fired in our
  verification (even with `--type-aware`), so it is not declared as an active rule;
  unawaited promises remain a review concern.
- **`return await`** (§7): `no-return-await` is rejected by the Oxlint 1.79 config build;
  `require-await` covers the section's spirit.
- **Early/easy return beyond the nesting pattern** (§3): only the syntactically
  provable `if { if }` shape is enforced; ordering of validation is a review concern.
- **Optional chaining as non-validation, single link** (§3, §8): `example?.raw` may be
  legitimate when absence is acceptable; the required-vs-optional distinction is
  semantic. Deep chains (2+) are enforced.
- **Truthy/falsy checks** (`if (!value)`) (§3): needs type information to distinguish a
  nullable domain value from a legitimate boolean; not enforced syntactically.
- **Zod/schema usage** (§4): requiring specific validation libraries is a project
  convention; the rules instead forbid the *type* smell that schema validation removes.
- **Naming quality beyond generic names** (§9): abbreviations and domain judgment need
  semantic knowledge; the mechanical part (generic names) is covered.
- **Booleans that "change behavior in unclear ways" beyond naming** (§5): the naming
  rule covers the demonstrable shape; behavior semantics are review.
- **Tests mindset** (§11): outside the linter's domain — a process/review concern.

These boundaries are intentional: the plugin enforces what is exactly provable from the
AST and documents the rest, matching the standard's "strict but honest" intent.

---

## Development

```bash
bun install            # Bun is the package manager (vitest runs tests under Node,
                       # because oxlint's RuleTester rejects the Bun runtime)
bun run check          # typecheck && lint && test — must pass before shipping
bun run lint           # oxlint . (the plugin enforces its own rules on itself)
bun run test           # vitest run (RuleTester suites; 194 tests)
bun run typecheck      # tsc --noEmit (strict, noEmit, exactOptionalPropertyTypes)
bun run build          # bun build src/index.ts → dist/index.js (bundled plugin)
npm publish --dry-run  # verify the publishable tarball (runs prepack → build)
```

Adding a rule: create `src/rules/<name>.ts` with `defineRule`, register it in
`src/index.ts` and `oxlint.config.ts`, then add `<name>.test.ts` with RuleTester
`valid`/`invalid` cases, including the exception branches.

## Publishing (maintainers)

Releases publish automatically via
[`.github/workflows/publish.yml`](.github/workflows/publish.yml) when a GitHub Release
tagged `v<version>` is published — the tag must match `package.json`'s `version`, the
composite check (`bun install --frozen-lockfile` → `bun run check` → `npm pack
--dry-run`) must pass, and `npm publish` runs with public access and provenance
(`id-token: write`). The package requires an `npm` environment secret (`NODE_AUTH_TOKEN`)
on the repository.

## License

MIT — see [LICENSE](./LICENSE). Rules derived from the project's own `CodingStandards.md`.
### Project-Wide Coding Standards (Strict Enforcement)

**Apply these rules to the entire project, without exceptions.**

**General Objective**
- **Analyze the entire project** to identify bad practices and optimize quality, readability, maintainability, scalability, and consistency.
- **Optimize all code** professionally and sustainably.
- **Separate, simplify, and improve** code into small, cohesive, and scalable files.

#### 1) Strict, Reusable, and Inferred Typing
- Reuse existing interfaces, types, and contracts before creating new ones.
- Prioritize automatic type inference from sources of truth (`zod`, `drizzle-orm`, domain schemas).
- Avoid inline repetition of `| null` and `| undefined`; use shared utility types.
- You may create and use utility types such as:
  - `MaybeNull`
  - `MaybeUndefined`
  - `MaybeOptional`
  - `MaybeVoid` (if applicable)
- Avoid weak or empty types like `{}` and unnecessary intersections like `& {}`.
- Avoid giant inline type definitions in function signatures, parameters, or returns. Extract types to shared files (`types.ts` or domain-specific files).
- **Property Optionality:** Do not mix the optional property syntax (`?`) with `MaybeUndefined` types.
  - **Correct:** `waId?: string` OR `waId: MaybeUndefined<string>`.
  - **Incorrect:** `waId?: MaybeUndefined<string>` (Redundant).

#### 2) Forbidden Forced Casting (`as`)
- **Do not use `as`** to "force" types.
- **Strictly prohibited:**
  - `as unknown as X`
  - `value as string | number | boolean`
  - `(await res.json()) as Record<string, unknown>`
- Instead of casting, fix the typing at the origin using **Zod schemas**. Always validate external data (API responses, inputs) using Zod to ensure type safety and domain consistency.

#### 3) Explicit Control Flow (Early / Easy Return)
- Prefer **early return / easy return** patterns everywhere. Validate first, exit immediately, and keep the happy path clean.
- Analyze every conditional deliberately. Do not let uncertain data flow deeper into the function.
- Avoid abusing optional chaining (`obj?.a?.b?.c`) when it hides domain uncertainty.
- **Optional chaining is not validation.** It may be used only when the missing value is genuinely acceptable and explicitly handled.
- **Conditional Handling:** Do not rely on deep optional chaining to extract values.
  - **Incorrect:** `const waId = messages?.[0]?.id;`
  - **Correct:** Validate `messages`, validate the first message, validate `id`, and return early when any required value is missing.
- Do not use optional chaining for required domain values.
  - **Incorrect:** `const raw = example?.raw;`
  - **Correct:** `if (example === undefined) return ...;` then `if (example.raw === undefined) return ...;` then use `example.raw` safely.
- Prefer explicit checks over ambiguous truthy/falsy checks for important values.
  - **Incorrect:** `if (!value) return;`
  - **Correct:** `if (value === undefined) return;`, `if (value === null) return;`, `if (value.length === 0) return;`.
- Avoid nested conditionals when early returns can flatten the flow.
- Avoid complex ternaries, chained ternaries, and inline conditional logic that reduces readability.
- Avoid continuing execution after detecting invalid or incomplete state.
- Avoid excessive use of `?` in types/properties if it weakens contracts; prioritize explicit contracts.
- Be concrete and strict in validation and error branches.

#### 4) Validation and Robustness
- Use `zod` extensively where no better alternative exists: validation of inputs/outputs and data normalization.
- Reuse schemas and derived types (`z.infer`) to maintain end-to-end consistency.
- Create reusable types for function returns (e.g., `Result`, `Success`) to avoid ambiguous return structures like `return waId !== undefined ? { ok: true, waId } : { ok: true }`.
- Use `safeParse` for external or uncertain data and return early when validation fails.
- Validate data at system boundaries: HTTP requests, API responses, forms, webhooks, environment variables, storage reads, queue messages, and third-party SDK payloads.
- Separate validation, normalization, and business logic. Do not mix parsing logic with domain decisions unless the function is intentionally small and local.
- Normalize values once after validation; do not repeatedly re-check the same uncertain shape across the codebase.
- Prefer explicit error states over silent fallbacks. Fallbacks must be intentional and domain-safe.
- Do not swallow errors with empty `catch` blocks. Either handle the error concretely, convert it into a typed result, or rethrow with useful context.
- Avoid returning inconsistent object shapes from the same function. Use discriminated unions for success/error flows.

#### 5) Function Design and Readability
- Keep functions small, focused, and named by behavior.
- Prefer one clear responsibility per function. Extract only when it improves reuse, readability, or testability.
- Keep the happy path obvious: validate inputs first, return early on failure, then execute the core logic.
- Avoid boolean parameters that change behavior in unclear ways. Prefer explicit options objects or separate functions when behavior differs significantly.
- Avoid hidden side effects. If a function mutates state, persists data, sends events, or performs I/O, make that clear from naming and structure.
- Prefer deterministic functions where possible. Isolate date/time, randomness, network, and storage access.
- Avoid duplicated business rules. Centralize domain decisions in clear modules or helpers.
- Prefer readable, boring code over clever abstractions.

#### 6) Constant Reuse and Structure
- Reuse existing constants (do not duplicate magic literals).
- Centralize constants shared by domain.
- Keep modules small, focused, and decoupled to facilitate project evolution.
- Avoid magic numbers, magic strings, repeated route names, repeated status values, and repeated domain literals.
- Prefer typed constants, enums only when they are already part of the project style, or `as const` objects when they provide safer inference without forced casting.
- Keep file boundaries intentional: domain logic, infrastructure, schemas, constants, and types should not be mixed casually.

#### 7) Async, Promises, and Side Effects
- Always handle promises explicitly. Do not leave floating promises unless intentionally marked and justified.
- Avoid unnecessary `await` when returning a promise directly, unless needed for `try/catch` or cleanup flow.
- Keep async control flow linear and readable. Avoid mixing callbacks, `.then()`, and `async/await` in the same flow without a clear reason.
- Validate data before performing side effects.
- Return early before database writes, API calls, event emission, or mutations when required data is missing.
- Prefer typed results for operations that can fail as part of normal domain flow.

#### 8) Collections and Data Access
- Validate arrays before indexing.
  - **Incorrect:** `const first = items?.[0];`
  - **Correct:** `if (items.length === 0) return ...; const first = items[0];`
- Avoid assuming object keys exist. Validate with explicit checks or schemas before reading required values.
- Prefer clear transformations over dense chained expressions when business logic is involved.
- Avoid mutating inputs unless mutation is intentional, local, and obvious.
- Prefer immutable transformations for domain data.

#### 9) Naming and Domain Clarity
- Use domain-specific names instead of generic names like `data`, `item`, `payload`, or `result` when the meaning is known.
- Boolean names must read clearly (`isActive`, `hasPermission`, `shouldRetry`).
- Avoid abbreviations unless they are established domain language.
- Name intermediate values when they clarify validation or business rules.
- Do not hide important domain decisions inside generic helpers.

#### 10) Imports, Exports, and Dependencies
- Reuse existing modules before adding new dependencies.
- Keep imports intentional and minimal.
- Avoid circular dependencies and broad barrel exports that hide coupling.
- Prefer explicit exports for domain modules.
- Do not introduce a dependency for logic that can be implemented clearly with existing project tools.

#### 11) Tests and Verification Mindset
- When changing behavior, add or update tests where the project already has a testing pattern.
- Cover required validation branches, early returns, edge cases, and error states.
- Do not only test the happy path.
- Prefer tests that assert domain behavior, not implementation details.
- Ensure TypeScript catches invalid states instead of relying only on runtime tests.

**Final Acceptance Criteria**
- All code must pass `bun check:all` (all scripts) without errors.
- No forced casts (`as`) remain unless there is a rare, justified, and unavoidable reason.
- No optional chaining remains where explicit validation is required.
- Required values are validated with clear conditionals and early/easy returns before use.
- Conditionals are explicit, readable, and domain-safe.
- External and uncertain data is validated through schemas or strict guards.
- Functions return predictable, typed, and consistent shapes.
- Code is simpler, stricter, more readable, and easier to maintain than before.

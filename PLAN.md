# Plan: oxlint-plugin-golden — Cobertura total de CodingStandards.md + publish a npm

## Objetivo
Transformar **TODAS** las políticas de `CodingStandards.md` (11 secciones + criterios de
aceptación) en reglas Oxlint, siguiendo el patrón de reglas de `dmmulroy/anti-slop`, y
configurar el pipeline de publish a npm como `oxlint-plugin-golden` siguiendo el patrón de
`dogalyir/opencode-auto-translate`. Principio rector (decisión del usuario): **lo que se
pueda demostrar en AST se implementa como regla; lo que no, se deja documentado como
límite** — sin heurísticas frágiles ni enforcement falso.

`CodingStandards.md` queda intacto como fuente original de intención.

## Estado actual del proyecto (verificado)
- Plugin local `golden/*` con **12 reglas** implementadas en `src/rules/`, 135 tests
  RuleTester (vitest/Node), helpers en `src/shared/` (`types.ts`, `dictionary-types.ts`).
- `src/index.ts` (definePlugin + eslintCompatPlugin), `oxlint.config.ts` con jsPlugins
  local y las 12 reglas como `error` sobre `*.ts/*.tsx`.
- `bun run check` pasa (typecheck + lint + tests). Bun + `bun.lock`; vitest (RuleTester
  rechaza Bun). Git init sin commits (archivos staged).
- `PLAN.md` había sido eliminado; se recrea con este contenido.

---

# Mapa de cobertura (gap analysis) — verificado contra oxlint 1.79

Leyenda: ✅ implementado/existente · 🆕 regla custom NUEVA (task-2) · ⚙️ regla nativa de
oxlint a configurar (task-3) · 🚫 límite documentado (no demostrable en AST de forma
honesta)

## Sección 1 — Strict, Reusable, Inferred Typing
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Reusar tipos existentes / inferencia zod-drizzle | 🚫 | Semántico; requiere checker de tipos o convención |
| Utility types `MaybeNull/MaybeUndefined/MaybeOptional/MaybeVoid` | 🚫 | Preferencia de estilo; enforcement produciría ruido |
| Evitar `{}` y `& {}` | ✅ | `golden/no-empty-object-types` (existente) |
| Evitar tipos inline gigantes en firmas | 🚫 | Métrica de tamaño = heurística frágil |
| Propiedad opcional `?` + `MaybeUndefined` | ✅ | `golden/no-redundant-optional-undefined` (existente) |

## Sección 2 — Forbidden Forced Casting (`as`)
| Política | Estado | Mecanismo |
| --- | --- | --- |
| `as unknown as X` y cadenas de as | ✅ | `golden/no-chained-type-assertions` + `golden/no-widen-then-assert` (existentes) |
| `value as string \| number` (casts de unión) | ✅ | Todo `as` no-const exige `SAFETY:` → `golden/require-safety-comment-for-type-assertion` |
| `(await res.json()) as Record<string, unknown>` | ✅ | `golden/no-unsafe-dictionary-type` + require-safety-comment |
| Usar Zod en el origen en lugar de casts | 🚫 | Dependencia de librería; no es propiedad del AST |

## Sección 3 — Explicit Control Flow (Early / Easy Return)
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Early/easy return en vez de anidar | 🆕 | `golden/no-nested-conditionals` (if dentro de if sin else → aplanable); `prefer-early-return` NO existe en 1.79 |
| Evitar optional chaining profundo | 🆕 | `golden/no-deep-optional-chaining` (cadenas ≥2 `?.`; un solo `?.` permitido por ser legítimo para valores opcionales) |
| Checks explícitos vs truthy/falsy (`if (!value)`) | 🚫 | Requiere info de tipos para no false-positivar sobre booleanos |
| Ternarios complejos/encadenados | ⚙️ | nativa `no-nested-ternary` + `no-unneeded-ternary` |
| No continuar tras estado inválido | 🚫 | Dataflow; no demostrable sintácticamente |
| `?` excesivo que debilita contratos | ✅/🚫 | Parcial: no-redundant-optional-undefined; debilitamiento semántico → límite |

## Sección 4 — Validation and Robustness
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Uso extensivo de zod | 🚫 | Dependencia de librería |
| Resultados tipados (`Result`/`Success`, uniones discriminadas) | 🚫 | Semántico; parcialmente cubierto por no-unknown-returns |
| `safeParse` / validación en boundaries | 🚫 | No demostrable |
| No tragar errores con catch vacío | ⚙️ | nativa `no-empty` (catch vacío) + `no-useless-catch` (catch que solo rethrow) |
| Fallbacks explícitos y seguros | 🚫 | Semántico |
| Formas de retorno consistentes | 🚫 | Requiere checker de tipos |

## Sección 5 — Function Design and Readability
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Funciones pequeñas/una responsabilidad | 🚫 | Métrica frágil |
| Evitar boolean params que cambian comportamiento | 🆕 | `golden/no-boolean-parameters` (param `boolean` sin prefijo booleano `is/has/should/can/allow/...`; opción configurable) |
| Side effects ocultos | 🚫 | Naming/semántica |
| Funciones deterministas | 🚫 | No demostrable |
| Reglas de negocio duplicadas | 🚫 | Semántico |

## Sección 6 — Constant Reuse and Structure
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Magic numbers | ⚙️ | nativa `no-magic-numbers` |
| Magic strings | 🚫 | `no-magic-strings` no existe en 1.79 |
| Constantes tipadas / `as const` | ✅ | Permitido por las reglas de casting existentes |
| Límites de módulos intencionales | 🚫 | Semántico |

## Sección 7 — Async, Promises, Side Effects
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Floating promises | ⚙️ | nativa `no-floating-promises` |
| `await` innecesario al retornar promise | ⚙️ | nativa `no-return-await` (`no-useless-await` NO existe en 1.79; alternativa verificada) + `require-await` |
| Flujo async lineal (sin mezclar .then/async) | 🚫 | Estilo |
| Validar antes de side effects | 🚫 | Dataflow |
| Resultados tipados para ops fallibles | ✅/🚫 | Parcial: no-unknown-returns |

## Sección 8 — Collections and Data Access
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Validar arrays antes de indexar | ✅ | Type system: `noUncheckedIndexedAccess` en tsconfig (documentado) |
| No asumir keys de objetos | ✅/🚫 | Parcial: no-unsafe-dictionary-type; resto semántico |
| No mutar inputs | ⚙️ | nativa `no-param-reassign` |
| Transformaciones inmutables | 🚫 | Semántico |

## Sección 9 — Naming and Domain Clarity
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Nombres genéricos (`data/item/payload/result`) | 🆕 | `golden/no-generic-names` (lista configurable; patrón anti-slop `no-shape-in-symbol-names`) |
| Nombres booleanos legibles | ✅/🚫 | Parcial: exención de prefijos en no-boolean-parameters; resto límite |
| Abreviaturas no de dominio | 🚫 | Semántico |
| Valores intermedios nombrados | 🚫 | Semántico |

## Sección 10 — Imports, Exports, Dependencies
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Reusar módulos antes que nuevas deps | 🚫 | Semántico |
| Dependencias circulares | ⚙️ | nativa `no-cycle` |
| Imports duplicados | ⚙️ | nativa `no-duplicate-imports` |
| Barrel exports amplios | 🚫 | `import/no-barrel-file` no existe en 1.79 |

## Sección 11 — Tests and Verification Mindset
| Política | Estado | Mecanismo |
| --- | --- | --- |
| Añadir/actualizar tests al cambiar comportamiento | 🚫 | Fuera del dominio del linter; proceso/revisión |

## Criterios de aceptación finales de CodingStandards.md
- `bun check:all` sin errores → nuestro `bun run check` como gate (✅).
- Sin `as` no justificado → reglas existentes §2 (✅).
- Sin optional chaining donde se requiere validación → parcial: no-deep-optional-chaining
  (cadenas profundas); requerido-vs-opcional single → límite.
- Validaciones explícitas con early returns → parcial: no-nested-conditionals; resto límite.
- Condicionales explícitos/legibles → parcial: no-nested-ternary etc.
- Datos externos validados (zod) → límite documentado.
- Formas de retorno predecibles → parcial: no-unknown-returns; uniones discriminadas → límite.

---

# Plan de trabajo

## Task-2 — 4 reglas custom nuevas (+tests RuleTester, sin regresiones)
1. `no-deep-optional-chaining` — flag cadenas con ≥2 enlaces `?.` consecutivos en una
   misma cadena (`a?.b?.c`, `messages?.[0]?.id`); opción `maxLinks` (default 1 = se
   permite un solo `?.`).
2. `no-boolean-parameters` — flag parámetros anotados `boolean` cuyo nombre no empiece
   por prefijo booleano (`is/has/should/can/will/allow/enable/disable/require`, opción
   `allowedNamePrefixes`).
3. `no-generic-names` — flag declaraciones (variables/parámetros/aliases) con nombres de
   la lista genérica configurable (default: `data,item,payload,result,value,obj,tmp,arr,
   stuff,thing`).
4. `no-nested-conditionals` — flag `if` anidado como único statement del consequent de un
   `if` padre sin `else` (aplanable con early return); respeta paréntesis y bloques.

Registro en `src/index.ts` + activación `error` en `oxlint.config.ts` (16 reglas totales).

## Task-3 — Reglas nativas de oxlint (solo las que existen en 1.79, verificado)
Activadas como `error` sobre `*.ts/*.tsx` en `oxlint.config.ts` (plugin `import` añadido
para `no-cycle`): `no-empty`, `no-useless-catch`, `no-magic-numbers` (opciones
`ignore [0,1,-1]`, `ignoreArrayIndexes`, `ignoreDefaultValues`), `no-nested-ternary`,
`no-unneeded-ternary`, `no-lonely-if`, `no-param-reassign` (`props: true`),
`require-await`, `no-cycle`, `no-duplicate-imports`. Todas verificadas disparando en
fixtures reales.

Excluidas con justificación:
- `no-floating-promises`: no dispara en oxlint 1.79 ni con `--type-aware` (verificado);
  se documenta como límite (promesas flotantes = revisión).
- `no-return-await`: rechazada por el build de configuración real ("not found in plugin
  'eslint'"); `require-await` cubre el espíritu de la sección 7.
- `no-useless-await`, `prefer-early-return`, `import/no-barrel-file`: no existen en 1.79.

## Task-4 — Pipeline publish (modelo opencode-auto-translate)
- `package.json`: nombre `oxlint-plugin-golden` (verificado disponible en npm),
  `publishConfig.access: public`, `repository/homepage/bugs/keywords`, `files`,
  script `build` (`bun build src/index.ts --outdir dist --target node`),
  `exports` → `dist/index.js`, `private: false`.
- `LICENSE` MIT (los dos repos de referencia usan MIT).
- Verificar con `npm publish --dry-run` (sin publicar de verdad).

## Task-5 — Workflows GitHub Actions (modelo opencode-auto-translate)
- `.github/actions/check/action.yml` (composite: `bun install --frozen-lockfile` →
  `bun run check` → `npm pack --dry-run`).
- `.github/workflows/ci.yml` (PR + push main → check).
- `.github/workflows/publish.yml` (on release published → checkout tag → verificar tag ==
  `v` + versión package.json → check → `npm publish`).
- Commit inicial git.

## Task-6 — Documentación
- `README.md`: instalación vía npm (`oxlint-plugin-golden`) y local, catálogo completo
  (16 reglas custom + nativas configuradas), ejemplos válidos/inválidos, opciones, límites
  actualizados.
- `PLAN.md`: mapa de cobertura + estados reales por tarea.

## Task-7 — Verificación end-to-end
- `bun run check` completo (typecheck + lint + tests existentes 135 + nuevos).
- `--print-config`: 16 reglas `golden/*` + nativas como `error` en override `*.ts/*.tsx`.
- Fixture temporal dispara las 4 reglas nuevas con severidad error.
- `npm publish --dry-run` OK; workflows YAML válidos.
- Revisión final: sin forced casts, sin archivos muertos, `CodingStandards.md` intacto.

---

# Estado (se actualiza por tarea)
- task-1: ✅ gap analysis completado (mapa arriba; disponibilidad nativa verificada con
  config + `--print-config` en oxlint 1.79).
- task-2 a task-7: pendientes.

# Monorepo conventions

## Workspaces

npm workspaces root at `package.json`: `apps/*` and `packages/*`. Package manager is npm 11.19.1 (`packageManager` pinned); Node `>=20`.

| Workspace             | Package name         | Kind                                        |
| --------------------- | -------------------- | ------------------------------------------- |
| `apps/api`            | `@smm/api`           | NestJS application (CommonJS)               |
| `apps/worker`         | `@smm/worker`        | BullMQ workers (empty — planned)            |
| `apps/web`            | `@smm/web`           | Next.js customer panel (empty — planned)    |
| `apps/license-api`    | `@smm/license-api`   | License platform API (empty — planned)      |
| `apps/license-admin`  | `@smm/license-admin` | License platform admin UI (empty — planned) |
| `packages/config`     | `@smm/config`        | Env schema + `loadConfig`                   |
| `packages/database`   | `@smm/database`      | Schemas, connection, registry               |
| `packages/logger`     | `@smm/logger`        | pino wrapper                                |
| `packages/security`   | `@smm/security`      | Crypto primitives                           |
| `packages/types`      | `@smm/types`         | Enums + type aliases                        |
| `packages/utils`      | `@smm/utils`         | Money math, ids, helpers                    |
| `packages/validation` | `@smm/validation`    | zod schemas                                 |
| `packages/ui`         | `@smm/ui`            | UI kit (empty — planned)                    |

## Root scripts (Turbo)

| Script      | Command                                       | Notes                                                        |
| ----------- | --------------------------------------------- | ------------------------------------------------------------ |
| `build`     | `turbo run build`                             | depends on `^build`; outputs `dist/**`, `.next/**` (cached)  |
| `dev`       | `turbo run dev`                               | `persistent: true`, no cache                                 |
| `lint`      | `turbo run lint`                              | depends on `^lint`                                           |
| `typecheck` | `turbo run typecheck`                         | depends on `^build`                                          |
| `test`      | `turbo run test`                              | depends on `^build`                                          |
| `seed`      | `npm run seed -w @smm/api`                    | target script currently missing (`apps/api/scripts/seed.ts`) |
| `clean`     | `turbo run clean && rm -rf node_modules`      | `cache: false`                                               |
| `format`    | `prettier --write "**/*.{ts,tsx,js,json,md}"` |                                                              |

Incremental compilation is disabled (`tsconfig.base.json` `incremental: false`). Keep it that way: with `deleteOutDir: true` (nest-cli) a stale `tsconfig.tsbuildinfo` persisted outside `dist/` caused `tsc` to believe nothing changed and emit no output while exiting 0. If you ever re-enable incremental, pin `tsBuildInfoFile` inside `dist/`.

## TypeScript configuration

`tsconfig.base.json` (shared):

- `target: ES2022`, `lib: [ES2022]`
- `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`
- `noUnusedLocals`, `noUnusedParameters` (unused imports/params fail typecheck)
- `noFallthroughCasesInSwitch`
- `declaration` + `declarationMap`, `sourceMap`
- `isolatedModules`
- `skipLibCheck`, `esModuleInterop`, `resolveJsonModule`

`apps/api/tsconfig.json` overrides: `module: CommonJS`, `moduleResolution: Node`, adds `emitDecoratorMetadata`, `experimentalDecorators`, `strictPropertyInitialization: false`, `declaration: true`, `rootDir: ./src`, `outDir: ./dist`.

New packages/apps should extend `tsconfig.base.json` and only override what is genuinely required (e.g. the API's decorators + CJS module).

## Dependency rules

- Shared logic lives in `packages/*`; applications never re-implement it.
- `@smm/database` exports schemas and a `getModel(name, schema, collection)` registry helper. `MongooseModule.forFeature` registers model names at runtime; `@InjectModel("User")` uses the string name.
- The API does not use TS `paths` aliases for inter-package imports — all cross-workspace imports are package-name based (`@smm/utils`) and resolve through npm workspaces, so build order matters. Turbo `^build` enforces it.
- Keep `@smm/utils` and `@smm/types` dependency-free (only node built-ins / decimal.js); `@smm/database` may import from `@smm/types`, `@smm/utils`.

## Validation layers

1. **Transport layer**: class-validator DTOs in controllers (`apps/api/src/modules/*/dto/*.dto.ts`).
2. **Service layer**: zod schemas from `@smm/validation` (e.g. `validateRegister`, `createOrderSchema`) — this is the authoritative rule set and is reused by the future worker/web consumers.

Keep both in sync: controllers map raw bodies to DTOs, services run zod on the resulting object. The zod schemas are the source of truth for domain invariants (quantity bounds, gateway enums, password policy).

## NestJS specifics for this repo

- Controllers use class-validator DTOs; services use zod. Do not mix orderings inconsistently within one module.
- Global guards are registered as `APP_GUARD` providers; `@Public()` opts routes out. Route-level `@UseGuards` should only be used where the global default needs adjustment (e.g. `ApiKeyAuthGuard` on public API-key routes).
- `UserApiController` uses `@Controller()` (empty path) so its routes sit directly under the global `/api/v1` prefix.
- Empty `@Controller("")` modules (Health) expose unprefixed routes via the `setGlobalPrefix` exclude list; keep that list in sync.

## Formatting

Prettier is configured at the root; `npm run format` formats everything. Match the existing 2-space, single-quote style; do not add trailing semicolons changes beyond what prettier does.

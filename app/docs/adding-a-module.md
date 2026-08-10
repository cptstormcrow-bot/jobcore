---
classification: sdassemblypros/jobcore
comments: "Adding a Module"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/adding-a-module.md
tags: [sdassemblypros, jobcore]
---
# Adding a Module

Jobcore's mobile app is organized as a small set of compile-time modules
(`modules/admin-finance`, `modules/field-tech`, `modules/sales-marketing`)
built against a shared contract in `@jobcore/module-sdk`. This document
describes how to add a new one.

## Compile-time, not runtime, plugins

Modules are **not** dynamically loaded at runtime. "Pluggable" means:

1. A module is a normal TypeScript package that exports an object
   conforming to the `JobcoreModule` contract, and it is compiled into the
   app bundle like any other code.
2. Whether a module's screens, nav entries, and job actions actually show up
   for a given organization is a **runtime, per-org toggle**, driven by
   `organizations.enabled_modules` in the database — not by which packages
   are installed.

In other words: adding a module to the codebase is a build (a PR, a
release); enabling it for a given org is a config change (a row update),
with no app rebuild required.

`apps/mobile/src/modules.ts` is the **only** file in `apps/mobile` allowed
to name a specific module by its package. This is enforced by a grep check —
no other file under `apps/mobile` should import from `modules/*` directly.
This keeps the app shell decoupled from any one module's internals and keeps
the enable/disable boundary in exactly one place.

## The `JobcoreModule` contract

Defined in `packages/module-sdk/src/index.ts`:

```ts
interface JobcoreModule {
  id: string;
  displayName: string;
  requiredRoles: Role[];       // fails closed if empty — see below
  routes: ModuleRoute[];
  navEntries: NavEntry[];      // sorted by NavEntry.order, lowest first
  jobActions?: JobAction[];
  hooks?: { /* module lifecycle hooks */ };
  migrations?: string[];
  settings?: SettingsSchema;
}
```

Registration and lookup go through two functions:

- `registerModule(module: JobcoreModule)` — called once, at module-package
  load time, to add the module to the in-process registry.
- `getEnabledModules(org)` — returns the modules that are both registered
  and turned on for the given organization (per
  `organizations.enabled_modules`), with `navEntries` sorted by `order`.

**Fail-closed on `requiredRoles`.** A module registered with an empty
`requiredRoles` array is treated as inaccessible to everyone, not as "open
to all roles." If a module is meant to be visible to every authenticated
user, it must say so explicitly by listing every role, rather than relying
on an empty array to mean "no restriction."

## Steps to add a new module

1. **Scaffold the package** under `modules/<your-module>/`, mirroring the
   layout of an existing module (e.g. `modules/admin-finance`): a
   `src/index.ts` that builds and exports the `JobcoreModule` object, plus
   whatever `data/`, `domain/`, `screens/` subfolders the module needs.
2. **Define routes and nav entries.** Each `ModuleRoute` maps to a screen;
   each `NavEntry` controls how the module shows up in navigation, including
   its `order` relative to other modules' entries.
3. **Set `requiredRoles` explicitly.** Decide which `Role`s can see this
   module and list them — do not leave the array empty expecting an "open"
   default; it fails closed instead.
4. **Add any `jobActions`** the module contributes to a job's action menu,
   any `hooks` it needs into the app lifecycle, and any `migrations` (SQL
   file names under `supabase/`) it depends on.
5. **Call `registerModule(...)`** from the package's `src/index.ts` so the
   module is present in the compile-time registry once the package is
   imported.
6. **Reference the module from `apps/mobile/src/modules.ts`** — this is the
   one place allowed to import the concrete module package and pass it to
   the app's module registration list. See the existing entries there (for
   example, how `adminFinanceModule` from `@jobcore/admin-finance` is
   imported and registered) for the pattern to follow.
7. **Add the org-level toggle.** For the module to actually appear for any
   organization, that org's `enabled_modules` column needs the module's
   `id` added — a data change, not a code change, and one that can be made
   per-organization independently of the app release that ships the module.
8. **Write tests** for the module's domain/data logic under a
   `__assertions__/*.assert.ts` folder next to the code being tested, and
   add that glob to the root `package.json` `test` script if it isn't
   already covered by an existing pattern for that module's directory.

## Worked example: `admin-finance`

`modules/admin-finance/src/index.ts` builds and registers
`adminFinanceModule`. It defines roles restricted to admin/finance-capable
users, routes into its intake and payroll screens, nav entries, and (in its
`money/` subpackage) the compensation domain logic described in
`docs/compensation.md`. `apps/mobile/src/modules.ts` imports
`adminFinanceModule` from `@jobcore/admin-finance` and is the only file that
does so — every other file in `apps/mobile` reaches the module only through
the shared `@jobcore/module-sdk` types and the app's own registry, never by
importing the module package directly.

## Common mistakes to avoid

- Importing a module package from somewhere other than
  `apps/mobile/src/modules.ts` — breaks the enable/disable boundary and will
  fail the grep check.
- Leaving `requiredRoles` empty and expecting it to mean "everyone" — it
  means "no one."
- Treating an org's `enabled_modules` toggle as something that requires a
  new app build — it does not; it is a data change against an
  already-shipped module.

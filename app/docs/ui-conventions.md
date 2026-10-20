---
classification: sdassemblypros/jobcore
comments: "UI conventions"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/ui-conventions.md
tags: [sdassemblypros, jobcore]
---
# UI conventions

## Default tab bar

Jeff's rule (2026-10-18): the default tab bar for all JobCore screens is the one on screen #0010 (Payroll).

- Tabs are anchored directly under the header (AppChrome), full width, outside the scrolling body.
- Active tab: bold text, `colors.sand` background, 2px `#2563eb` underline.
- Inactive tab: font weight 400, `colors.sandInactive` background.
- Use the shared component `DefaultTabBar` in `app/packages/ui/src/DefaultTabBar.tsx` (props tabs/activeId/onChange/rightSlot); never inline a tab bar. The legacy wrapping-pill `TabBar` was retired 2026-10-18 (file deleted); `DefaultTabBar` is the only tab bar.
- Source screen: #0010 (Payroll).
- The Hours tab uses a second `DefaultTabBar` (Day/Week/Month/Year) under the top tab bar.

## Buttons (Payroll style)

The standing "Payroll style" button is `SandButton` (`app/packages/ui/src/sand.ts`, re-exported by `app/packages/payroll-ui/src/SandButton.tsx`), taken from the screen #0010 Payroll header buttons. `Button` (`app/packages/ui/src/Button.tsx`) now carries the same look.

- Padding 3/11 plus a 1px transparent border, 14px label, radius 6, no `minHeight`, `hitSlop` 6/6/3/3.
- Sand fill, `colors.sandInactive` when disabled.
- All NEW buttons use `SandButton` or `Button`; no one-off inline button styles.
- `PayrollButton` is superseded; do not use it in new code.
- Source screen: #0010 (Payroll).

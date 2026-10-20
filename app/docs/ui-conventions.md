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

## Buttons (PayrollButton)

The default JobCore button is `PayrollButton` from `@jobcore/ui` (`app/packages/ui/src/PayrollButton.tsx`), taken from the screen #0010 Payroll header buttons.

- 32pt tall, label centered both ways, sand fill, `colors.sandInactive` when disabled; `hitSlop` keeps the 44pt touch target.
- Props: `label`, `onPress`, `disabled?`, `accessibilityLabel?`, `testID?`, `style?`.
- All NEW buttons use it; no one-off inline button styles.
- Existing `SandButton` screens are not retrofitted unless requested.
- Source screen: #0010 (Payroll).

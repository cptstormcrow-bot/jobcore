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

The standing "Payroll style" button is `PayrollButton` (`app/packages/ui/src/PayrollButton.tsx`, exported from `@jobcore/ui`), taken from the screen #0010 Payroll header buttons. `SandButton` (`app/packages/ui/src/sand.ts`, re-exported by `app/packages/payroll-ui/src/SandButton.tsx`) is retained but deprecated. `Button` (`app/packages/ui/src/Button.tsx`) now carries the same look.

- Padding 3/11 plus a 1px transparent border, 14px label, radius 6, no `minHeight`, `hitSlop` 6/6/3/3.
- Sand fill, `colors.sandInactive` when disabled.
- All NEW buttons use `PayrollButton` (or `Button`); do not use the deprecated `SandButton`; no one-off inline button styles.
- `PayrollButton` (from `@jobcore/ui`) is the current button. Retrofit status: all live buttons use `PayrollButton` (2026-10-20), including admin-finance screens, `AxisPicker`, and the payroll-ui panels `TimesheetApprovalPanel`, `PayPeriodPanel`, `PayrollHome`, `ReceiptCapture`, `ReimbursementPanel` and `TimeEntryPanel`.
- The two `SandButton` definitions (`app/packages/ui/src/sand.ts` and `app/packages/payroll-ui/src/SandButton.tsx`), the payroll-ui `index.ts` export, and the now-orphaned `SandButton` import at `TimeEntryPanel.tsx:11` are retained and become deletable in a later cleanup.
- `PayrollButton` has no `selected` prop and no children. Express a selected state through `style` with `borderBottomWidth: 2` and a blue `borderBottomColor`. `AssignmentBoardScreen` Service/Prem uses `'#2563eb'`; `AxisPicker` and the `PayrollRunScreen` format selector follow the same pattern (`AxisPicker` uses `colors.info` because of its no-raw-hex rule).
- Source screen: #0010 (Payroll).

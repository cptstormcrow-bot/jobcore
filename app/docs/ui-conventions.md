---
classification: sdassemblypros/jobcore
comments: "UI conventions"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/ui-conventions.md
tags: [sdassemblypros, jobcore]
---
# UI conventions

## Default tab bar

Jeff's rule (2026-10-18): the default tab bar for all JobCore screens is the one on screen #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88).

- Tabs are anchored directly under the header (AppChrome), full width, outside the scrolling body.
- Active tab: bold text, `colors.sand` background, 2px `#2563eb` underline.
- Inactive tab: font weight 400, `colors.sandInactive` background.
- Use the shared component `DefaultTabBar` in `app/packages/ui/src/DefaultTabBar.tsx` (props tabs/activeId/onChange/rightSlot); never inline a tab bar. The legacy wrapping-pill `TabBar` was retired 2026-10-18 (file deleted); `DefaultTabBar` is the only tab bar.
- Source screen: #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88).
- The Hours tab uses a second `DefaultTabBar` (Day/Week/Month/Year) under the top tab bar.

## Buttons (Payroll style)

The standing "Payroll style" button is `PayrollButton` (`app/packages/ui/src/PayrollButton.tsx`, exported from `@jobcore/ui`), taken from the screen #0010 Payroll header buttons (registry #0010 = Admin & Finance root; Payroll = #88). `PayrollButton` is the standard. `Button` (`app/packages/ui/src/Button.tsx`) and `SandButton` (`app/packages/ui/src/sand.ts`, re-exported by `app/packages/payroll-ui/src/SandButton.tsx`) are legacy and deprecated; neither carries the Payroll look.

- Fixed height 32, `paddingHorizontal` 14, radius 6; 14/18/700 label (`#000`) centred on both axes; `hitSlop` top 6 / bottom 6.
- Sand fill, `colors.sandInactive` when disabled.
- All NEW buttons use `PayrollButton`; do not use the legacy `Button` or `SandButton`; no one-off inline button styles.
- `PayrollButton` (from `@jobcore/ui`) is the current button. Retrofit status: all live buttons use `PayrollButton` (2026-10-20), including admin-finance screens, `AxisPicker`, and the payroll-ui panels `TimesheetApprovalPanel`, `PayPeriodPanel`, `PayrollHome`, `ReceiptCapture`, `ReimbursementPanel` and `TimeEntryPanel`.
- The two `SandButton` definitions (`app/packages/ui/src/sand.ts` and `app/packages/payroll-ui/src/SandButton.tsx`) and the payroll-ui `index.ts` export are retained and become deletable in a later cleanup; the orphaned `SandButton` import in `TimeEntryPanel.tsx` was removed 2026-10-20.
- `PayrollButton` has no `selected` prop and no children. Express a selected state through `style` with `borderBottomWidth: 2` and a blue `borderBottomColor`. `AssignmentBoardScreen` Service/Prem uses `'#2563eb'`; `AxisPicker` and the `PayrollRunScreen` format selector follow the same pattern (`AxisPicker` uses `colors.info` because of its no-raw-hex rule).
- Source screen: #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88).

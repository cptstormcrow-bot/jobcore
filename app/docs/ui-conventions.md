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

The standing "Payroll style" button is `PayrollButton` (`app/packages/ui/src/PayrollButton.tsx`, exported from `@jobcore/ui`), taken from the screen #0010 Payroll header buttons (registry #0010 = Admin & Finance root; Payroll = #88). `PayrollButton` is the standard. `Button` (`app/packages/ui/src/Button.tsx`) is legacy and deprecated and does not carry the Payroll look; the `SandButton` component was deleted 2026-10-20 (`sand.ts` now holds only the `SAND_BG` / `SAND_TEXT` colour constants).

- Fixed height 32, `paddingHorizontal` 14, radius 6; 14/18/700 label (`#000`) centred on both axes; `hitSlop` top 6 / bottom 6.
- Sand fill, `colors.sandInactive` when disabled.
- Button width (Jeff 2026-10-20): every `PayrollButton` is exactly as wide as its label plus 14px padding on each side (`alignSelf: 'flex-start'` in the component base style); it never stretches across a row or column. Callers must not pass `width`, `minWidth`, `flex`, `flexGrow` or `alignSelf: 'stretch'` in `style`; wrap or lay out around it instead. Origin: Payout Batches "Approve" rendered 459px wide because a stretch-default column parent widened it.
- All NEW buttons use `PayrollButton`; do not use the legacy `Button`; no one-off inline button styles.
- `PayrollButton` (from `@jobcore/ui`) is the current button. Retrofit status (2026-10-20): CONVERTED = the screens named in Jeff's 2026-10-19 Payroll-button SOP ask (#0062 Edit Lead, #0045 Employee Roster, #0063 Payments Reimbursements and Payout Batches tabs, #89 Review, `PayrollRunScreen`), `AxisPicker`, and the payroll-ui panels `TimesheetApprovalPanel`, `PayPeriodPanel`, `PayrollHome`, `ReceiptCapture`, `ReimbursementPanel` and `TimeEntryPanel`. NOT yet retrofitted: roughly 50 files still use the legacy `Button` (count-mode grep of `<Button` over `*.tsx` under `app/modules`, `app/packages` and `app/apps/mobile`, 2026-10-20) - for example admin-finance `JobEstimateScreen`, `PriceSheetEditorScreen`, `EmployeeEditorScreen`, `JobScheduleScreen`, `UniversalCalendar`, `PlanningScreen`; field-tech; sales-marketing; `apps/mobile` incl. `account.tsx`, the auth screens and the `Job*` components. Convert on touch; the app-wide retrofit is an open follow-up, so never write "all buttons" as done.
- The two `SandButton` definitions (`sand.ts`, `payroll-ui/src/SandButton.tsx`) and the payroll-ui `index.ts` export were deleted 2026-10-20; `sand.ts` keeps `SAND_BG`/`SAND_TEXT` (used by `UniversalCalendar`).
- `PayrollButton` has no `selected` prop and no children. Express a selected state through `style` with `borderBottomWidth: 2` and a blue `borderBottomColor`. `AssignmentBoardScreen` Service/Prem uses `'#2563eb'`; `AxisPicker` and the `PayrollRunScreen` format selector follow the same pattern (`AxisPicker` uses `colors.info` because of its no-raw-hex rule).
- Source screen: #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88).

## Standard picker

- Any value-stepping picker in JobCore (pay period, week, month, date range) uses `StepperPicker` from `@jobcore/ui` (`packages/ui/src/StepperPicker.tsx`). Never hand-roll one.
- Layout is fixed: previous arrow (◀) on the LEFT, the current value centered, next arrow (▶) on the RIGHT, all on one row as a centered group (arrows sit beside the value, not at the row edges). Arrows are never stacked top/bottom.
- Arrows are `PayrollButton`s, so they follow the Payroll button style. The value has a 150 `minWidth` so the arrows stay put as the label length changes.
- Props: `value`, `onPrev`, `onNext`, `prevLabel`, `nextLabel` (accessibility labels), optional `prevDisabled` / `nextDisabled`. Disable "next" when stepping past the present makes no sense (e.g. the current pay period).
- Reference use: the Pay period tab on screen #0088 (`packages/payroll-ui/src/PayPeriodPanel.tsx`).

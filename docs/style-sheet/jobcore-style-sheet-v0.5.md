---
classification: sdassemblypros/jobcore
comments: "JobCore Style Sheet - v0.5 (named text sizes 2026-11-02 added)"
origin: Codespace/SDAssemblyPros/Jobcore/docs/style-sheet/jobcore-style-sheet-v0.5.md
tags: [sdassemblypros, jobcore]
---
# JobCore Style Sheet - v0.5 (named text sizes 2026-11-02 added)

Every rule is SET (Jeff ruled 2026-10-31 unless noted) or OPEN. Values come from `app/packages/ui/src/tokens.ts`. Companion Word file: `JobCore-Style-Sheet-v0.5.docx` (generator `generator/build_sheet_v05.js`).

## 1. Global
- No bottom tab bar; tabs sit along the top.
- No NEW on-screen Back buttons; Android `<` follows actual visit history.
- Every screen shows its screen-number badge. Tight vertical padding. Use the shared component, never inline-style a one-off.

## 2. Spacing
Scale: xs 4, sm 6, md 10, lg 15, xl 20, xxl 28. Related-item gap xs-sm; row/card gap sm (6); side gutter md (10); section gap md-lg; row vertical padding sm (6) max.

## 3. Title bar
- `AppChrome` header everywhere; blue bar fills the row between hamburger and options menu.
- 10 px blue above and below the title, 20 px side padding. Title-bar text is 2 pt smaller than before.
- JOB screens only: bar inset 10 px each side.
- Title text line height is 20 (was 16, which clipped the bottom of 13 pt Poppins). Fixed in `fbcdae9`; not yet checked on a device (untested, goes to the uber test plan).

## 4. Tabs
`DefaultTabBar` only. Tab font 13. Active: bold, sand fill, 2 px #2563eb bottom border. Inactive: weight 400, sandInactive fill.

## 5. Buttons
- `PayrollButton` is THE button. 28 pt tall, 10 px side padding, radius 6, label 13/700 centred. Width = label + padding.
- Primary look = bold text on sand fill (Add, Confirm Paid, PaymentSimulationNotice Cancel and Acknowledge).
- Disabled #F7F4EB; `danger` only when Jeff asks. Selected items get a 2 px blue (#2563eb) bottom border.
- 13 button labels were shortened to stay on one line; account dialog title is "Switch user".

## 6. Pickers
`TechSelect` for field techs ("Choose a Field Tech", 80% wide max 320, #CED4DA dividers); other selects stay plain `Select`.

## 7. Lists
- Row min height 32, primary text 14, secondary 13, divider #CED4DA. Applies to ListItem, overview cards, DayList, CallbackTasks.
- NOT raised (avoid wasted vertical space): Select options, Checkbox, Toggle, settings rows.
- Never show raw UUIDs; show "Job #N".

## 7b. Text
- Minimize wrapping: labels, buttons, tabs, titles and list-row primary text stay on one line.
- Ellipsis => popup: `TruncatedText` (`app/packages/ui/src/TruncatedText.tsx`) opens a popup with the full text only when cut off. On a tappable list row a tap still opens the row; a long press opens the popup instead. Used in ListItem, ScreenTitle, Breadcrumb current segment, AppChrome title/subtitle/sectionHeader/gearTitle, JobTitleBarHeader name/jobLine/dateLine.

## 7c. Named text sizes and tight padding
Set by Jeff 2026-11-02 in `typography.text` and `compact` (`app/packages/ui/src/tokens.ts`). Range 12 to 14, titles 16.
- Typed field text 14 (`input`); body and read-only values 13 (`body`); field titles 12 (`fieldLabel`); helper text, hints, timestamps 12 (`hint`); errors 12 (`error`).
- Titles 16 (`title`); dropdown lists 16 (`option`); buttons and tabs 13 (`control`).
- Tight padding: `compact` gap 2, field 4, section 6, row min height 32.
- Fields match the dropdown text size (14) with a gray border (`colors.divider` #CED4DA), not black. A label and value that would wrap to two lines go on one line as "Label: value", for example "Customer Name: Alex Alvarez". Set by Jeff 2026-11-03 on screen #0041 Job screen (commit 51f6746); applies to every form screen.
- A disabled (grayed) button always has a visible gray border so it does not disappear into the background. Set by Jeff 2026-11-03 on screen #0061 (Submit and Check UPS); applies app wide to every grayed button.
- A checked checkbox fills the whole box green (not a green checkmark, not a thicker box). One look for all checkboxes. Set by Jeff 2026-11-03 (app wide, all screens); applies to every checkbox.

## 7d. Tooltips and the help mark
Set by Jeff 2026-11-02.
- The "?" in a circle is reserved for the help system. Tooltips (press-and-hold) never use it.
- No tooltips on fields that already do a job: customer name, address, phone.

## 8. Empty states
`EmptyState`: centred, bold 16 title, 16 muted message, 12 padding; message says what to do next.

## 9. Color and type
- Navy primary #1B2A4A (unchanged). Sand #D9C7A0 replaces accent in app screens (one shade lighter than old accent #E1AF80; token stays for website). sandInactive #F0EBDC.
- Status: success #2E7D32, danger #C62828, warning #FACC15, info #4A9BE8 (lightened blue).
- Poppins headings, Inter body; h4 20, body 16, label 14, small 13. Only raw hex allowed: #2563eb.

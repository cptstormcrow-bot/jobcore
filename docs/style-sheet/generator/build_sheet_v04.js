'use strict';
const path = require('path');
const L = require('./lib');
const { D } = L;

const H1 = (t) => new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun(t)] });
const P = (t, style) => new D.Paragraph({ style, children: L.runs(t) });
const gap = () => new D.Paragraph({ spacing: { before: 0, after: 60 }, children: [] });
const PC = 'Proposed: not yet ruled by Jeff. Comment here to keep, change or drop.';

(async () => {
  const c = new L.Comments();
  const tbl = (rows) => [L.ruleTable(rows, c), gap()];

  const kids = [
    new D.Paragraph({ style: 'Title', children: [new D.TextRun('JobCore Style Sheet')] }),
    new D.Paragraph({ style: 'Subtitle', children: [new D.TextRun('v0.4, Jeff decisions of 2026-10-31 codified; mark up with Word comments and tracked changes')] }),
    L.howToBox([
      ['HowToBox', '`How to read this sheet`'],
      ['HowToBox', '`SET` means Jeff already ruled; the source is cited under the word. `PROPOSED` means read from the code as it is today, with no ruling yet. `OPEN` is a known loose end.'],
      ['HowToBox', 'Mark up by adding a Word comment (or tracked change) on any row. Every PROPOSED row and each open question already carries a comment to reply to.'],
      ['HowToBox', 'Pictures are drawn at true proportion and printed at 100%: 1 app pixel = 1 point. Callouts show padding, alignment and how a part resizes. Values come from `app/packages/ui/src/tokens.ts`.'],
      ['HowToBox', 'Spacing scale: xs 4, sm 6, md 10, lg 15, xl 20, xxl 28. Radius: sm 6, md 10, lg 16.'],
    ]),
    gap(),

    H1('1. Global'),
    ...tbl([
      { rule: 'No bottom tab bar', status: 'SET', measures: 'Tabs sit along the top only (see section 4).' },
      { rule: 'No NEW on-screen Back buttons; existing ones Jeff asked for stay', status: 'SET', source: 'feedback-android-back-not-buttons', measures: 'Navigation back is the Android `<` button.' },
      { rule: 'Android `<` follows actual visit history, never a fixed parent', status: 'SET', source: 'same as above', measures: 'History order, not the screen hierarchy.' },
      { rule: 'Every screen shows its screen-number badge', status: 'SET', source: 'jobcore-screen-number-working-rules', measures: 'Badge is part of the screen chrome.' },
      { rule: 'Tight vertical padding', status: 'SET', measures: 'Row padding 6 max (see section 2).' },
      { rule: 'Never inline-style a one-off; use the shared component', status: 'SET', measures: 'Change the shared component so every screen follows.' },
    ]),

    H1('2. Spacing'),
    P('Scale: xs 4, sm 6, md 10, lg 15, xl 20, xxl 28.', 'Spec'),
    ...tbl([
      { rule: 'Gap between related items (label/value, icon/text)', status: 'SET', source: 'Jeff 2026-10-31', measures: 'xs to sm (4 to 6), keep. Items align on their text baseline vertically; left-aligned horizontally.' },
      { rule: 'Gap between rows / cards', status: 'SET', source: 'Jeff 2026-10-31', measures: 'sm (6).' },
      { rule: 'Screen side gutter', status: 'SET', source: 'Jeff 2026-10-31', measures: 'md (10) left and right of the body.' },
      { rule: 'Section gap', status: 'SET', source: 'Jeff 2026-10-31', measures: 'md to lg (10 to 15) between sections.' },
      { rule: 'Vertical padding inside rows', status: 'SET', source: 'Jeff 2026-10-31', measures: 'sm (6) maximum, top and bottom.' },
      { figure: 'spacing.png', caption: 'The spacing scale at true size.', alt: 'Spacing scale xs 4 to xxl 28' },
    ]),

    H1('3. Headers / title bar'),
    ...tbl([
      { rule: 'Every screen uses the Admin & Finance header (`AppChrome`)', status: 'SET', measures: 'Hamburger at left, options menu at right, title bar between.' },
      { rule: 'Blue title bar fills the row between the hamburger and the options menu', status: 'SET', measures: 'Resizing: the bar stretches to the space between the two menus; the menus never move.' },
      { rule: 'Equal 10 px blue above and below the title text (was 14); side padding 20; both screens match sizing with the menu/options', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Padding: 10 above, 10 below, 20 left and right. Vertical alignment: centred. Title text is centred horizontally.' },
      { rule: 'Title-bar text is 2 pt smaller than before', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Applies to AppChrome title text.' },
      { rule: 'Title names the screen it is on ("Field Tech-Assigned Jobs")', status: 'SET', measures: 'Long titles wrap inside the bar; the 10 px bands stay equal.' },
      { rule: 'JOB screens only: title bar inset 10 px each side (was 5), the gap between title box and menus', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Inset: 10 left, 10 right, on JOB screens only. Other screens use the full row.' },
      { rule: 'BUG: tech login title bar clips text at the bottom', status: 'OPEN', measures: 'To fix.' },
      { rule: 'Job title bar = left "Job #N"+date, centre customer block, right schedule link', status: 'SET', measures: 'Left block left-aligned, centre block centred, right link right-aligned.' },
      { figure: 'titlebar.png', caption: 'Blue title bar: 10 px bands, 20 px side padding and the 10 px job inset.', alt: 'Title bar with padding callouts' },
    ]),

    H1('4. Tabs'),
    ...tbl([
      { rule: 'Use `DefaultTabBar`, never inline a tab bar', status: 'SET', measures: 'One shared component for every tab strip.' },
      { rule: 'Anchored directly under the header, full width, outside the scrolling body', status: 'SET', measures: 'Resizing: tabs share the full width; the bar does not scroll with the page.' },
      { rule: 'Tab font 13, padding top/bottom reduced by 3 px. Active tab: bold + sand background + 2 px #2563eb underline', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Label 13 bold, centred both axes. Underline 2 px along the bottom edge.' },
      { rule: 'Inactive tab: weight 400, sandInactive background', status: 'SET', measures: 'Label weight 400, same padding as active so tabs do not shift.' },
      { figure: 'tabbar.png', caption: 'Active versus inactive tab with padding callouts.', alt: 'Tab bar active and inactive' },
    ]),

    H1('5. Buttons'),
    ...tbl([
      { rule: '`PayrollButton` is THE button; `Button`/`SandButton` are legacy', status: 'SET', measures: 'Use `PayrollButton` for every new button.' },
      { rule: '28 pt tall, 10 px side padding, radius 6, label 13/700 black centred both axes', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Height 28. Padding 10 left and right. Radius 6. Label centred horizontally and vertically.' },
      { rule: 'Width = label + padding only; never stretch, never pass width/flex', status: 'SET', source: '2026-10-20', measures: 'Resizing: width grows with the label, never stretches to fill.' },
      { rule: 'Default tone sand; disabled = one shade lighter than sandInactive (#F7F4EB); `danger` tone has white text, used only when Jeff asks', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Sand fill by default; danger red is opt-in.' },
      { rule: 'Primary look = bold text on sand fill (Add, Confirm Paid, PaymentSimulationNotice Cancel and Acknowledge)', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Bold label on the sand fill.' },
      { rule: '13 button labels were shortened to stay on one line; the account dialog title is "Switch user"', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Labels stay one line.' },
      { rule: 'Selected state = 2 px blue (#2563eb) bottom border, for tabs, buttons and any selected item', status: 'SET', measures: 'Border 2 px along the bottom edge, #2563eb.' },
      { rule: '~50 files still use legacy `Button`; converted FIRST as part of this effort', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Conversion sweep comes first.' },
      { figure: 'btn_states.png', caption: 'PayrollButton default, disabled, danger and selected.', alt: 'PayrollButton states' },
      { figure: 'btn_resize.png', caption: 'Resize flow: width grows with the label, never stretches.', alt: 'PayrollButton resize flow' },
    ]),

    H1('6. Pickers'),
    ...tbl([
      { rule: 'Every field-tech picker is `TechSelect`: heading "Choose a Field Tech", sheet 80% wide max 320, centred larger text, grey #CED4DA dividers', status: 'SET', measures: 'Sheet width 80% of the screen, capped at 320, centred horizontally. Row text centred.' },
      { rule: 'Non-tech selects keep plain `Select`', status: 'SET', measures: 'Plain `Select` is unchanged.' },
      { figure: 'picker.png', caption: 'The TechSelect sheet.', alt: 'Picker sheet' },
    ]),

    H1('7. Lists (rows)'),
    ...tbl([
      { rule: 'Row min height 32 for tappable rows; thin divider line between rows', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Min height 32. Divider 1 px #CED4DA. Row grows taller if the text wraps.' },
      { rule: 'Min height 32 and primary text 14 apply to ListItem, overview cards, DayList and CallbackTasks. Select options, Checkbox, Toggle and settings rows are NOT raised, to avoid wasted vertical space', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Scope of the 32 / 14 rule.' },
      { rule: 'Never show raw UUIDs; show "Job #N" and drill into the job', status: 'SET', source: 'Payments', measures: 'The "Job #N" text is the tap target.' },
      { rule: 'Primary text 14; secondary 13 (unchanged) in textLight/textMuted', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Primary above secondary, both left-aligned, gap xs (4).' },
    ]),

    H1('7b. Text: minimize wrapping and ellipsis popup'),
    ...tbl([
      { rule: 'Minimize wrapping: labels, buttons, tabs, titles and list-row primary text stay on one line', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Shorten the text rather than wrap.' },
      { rule: 'Ellipsis => popup: `TruncatedText` opens a popup with the full text only when the text is cut off. On a tappable list row a tap still opens the row; a long press opens the popup', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Used in ListItem, ScreenTitle, Breadcrumb current segment, AppChrome title/subtitle/sectionHeader/gearTitle, JobTitleBarHeader name/jobLine/dateLine. Source: app/packages/ui/src/TruncatedText.tsx.' },
    ]),

    H1('8. Empty states'),
    ...tbl([
      { rule: 'Use `EmptyState`: centred, bold 16 title (text colour), 16 muted message, 12 padding', status: 'SET', source: 'Jeff 2026-10-31', measures: 'Padding 12 all round. Centred horizontally; centred vertically in the list area.' },
      { rule: 'Message says what to do next, in plain words', status: 'SET', source: 'Jeff 2026-10-31', measures: 'One or two short sentences.' },
      { figure: 'list_empty.png', caption: 'List rows (section 7) and the empty state (section 8).', alt: 'List rows and empty state' },
    ]),

    H1('9. Color and type'),
    ...tbl([
      { rule: 'Brand navy #1B2A4A; sand #D9C7A0 (one shade lighter than the old accent) replaces accent #E1AF80 in app screens (accent token stays for website match); sandInactive #F0EBDC', status: 'SET', source: 'Jeff 2026-10-31', measures: 'See the swatches below.' },
      { rule: 'Status: success #2E7D32, danger #C62828, warning #FACC15, info #4A9BE8 (lightened blue; navy primary unchanged)', status: 'SET', source: 'tokens', measures: 'See the swatches below.' },
      { rule: 'Headings Poppins, body Inter; sizes h4 20, body 16, label 14, small 13', status: 'SET', source: 'tokens', measures: 'This document uses the same families.' },
      { rule: 'No raw hex in new code (use tokens); known exception: #2563eb tab/selected blue', status: 'SET', measures: 'The blue is the only allowed raw value.' },
    ]),
    L.swatchTable([
      ['primary', '#1B2A4A', 'Brand navy: header, text on sand'],
      ['accent', '#E1AF80', 'Gold accent (website match only; not used in app screens)'],
      ['sand', '#D9C7A0', 'Buttons and the active tab'],
      ['sandInactive', '#F0EBDC', 'Inactive tab'],
      ['disabled', '#F7F4EB', 'Disabled button (one shade lighter than sandInactive)'],
      ['success', '#2E7D32', 'Status: success'],
      ['danger', '#C62828', 'Status: danger'],
      ['warning', '#FACC15', 'Status: warning'],
      ['info', '#4A9BE8', 'Status: info (lightened blue, distinct from navy primary)'],
      ['blue', '#2563EB', 'Tab underline and selected state (known exception)'],
      ['divider', '#CED4DA', 'Picker and list dividers'],
    ]),
    gap(),

    H1('Rulings'),
  ];

  kids.push(
    P('Tighten top/bottom spacing and remove unneeded text wraps everywhere.', 'Spec'),
    P('Question 3 is still open: forms, inputs, cards, dialogs, badges and toasts.', 'Spec'),
  );

  const doc = new D.Document({
    creator: 'JobCore', title: 'JobCore Style Sheet v0.4',
    styles: L.styles(), comments: c.config,
    sections: [{ properties: L.sectionProps(), footers: { default: L.footer('JobCore Style Sheet v0.4') }, children: kids }],
  });
  await L.emit(doc, path.join(L.ROOT, 'JobCore-Style-Sheet-v0.4.docx'), false);
})().catch((e) => { console.error(e); process.exit(1); });

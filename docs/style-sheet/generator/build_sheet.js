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
    new D.Paragraph({ style: 'Subtitle', children: [new D.TextRun('v0.2 DRAFT, for Jeff to mark up with Word comments and tracked changes')] }),
    L.howToBox([
      ['HowToBox', '`How to read this sheet`'],
      ['HowToBox', '`SET` means Jeff already ruled; the source is cited under the word. `PROPOSED` means read from the code as it is today, with no ruling yet. `OPEN` is a known loose end.'],
      ['HowToBox', 'Mark up by adding a Word comment (or tracked change) on any row. Every PROPOSED row and each open question already carries a comment to reply to.'],
      ['HowToBox', 'Pictures are drawn at true proportion and printed at 100%: 1 app pixel = 1 point. Callouts show padding, alignment and how a part resizes. Values come from `app/packages/ui/src/tokens.ts`.'],
      ['HowToBox', 'Spacing scale: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48. Radius: sm 6, md 10, lg 16.'],
    ]),
    gap(),

    H1('1. Global'),
    ...tbl([
      { rule: 'No bottom tab bar', status: 'SET', measures: 'Tabs sit along the top only (see section 4).' },
      { rule: 'No NEW on-screen Back buttons; existing ones Jeff asked for stay', status: 'SET', source: 'feedback-android-back-not-buttons', measures: 'Navigation back is the Android `<` button.' },
      { rule: 'Android `<` follows actual visit history, never a fixed parent', status: 'SET', source: 'same as above', measures: 'History order, not the screen hierarchy.' },
      { rule: 'Every screen shows its screen-number badge', status: 'SET', source: 'jobcore-screen-number-working-rules', measures: 'Badge is part of the screen chrome.' },
      { rule: 'Tight vertical padding', status: 'SET', measures: 'Row padding 8 max (see section 2).' },
      { rule: 'Never inline-style a one-off; use the shared component', status: 'SET', measures: 'Change the shared component so every screen follows.' },
    ]),

    H1('2. Spacing'),
    P('Scale: xs 4, sm 8, md 16, lg 24, xl 32, xxl 48.', 'Spec'),
    ...tbl([
      { rule: 'Gap between related items (label/value, icon/text)', status: 'PROPOSED', comment: PC, measures: 'xs to sm (4 to 8). Items align on their text baseline vertically; left-aligned horizontally.' },
      { rule: 'Gap between rows / cards', status: 'PROPOSED', comment: PC, measures: 'sm (8).' },
      { rule: 'Screen side gutter', status: 'PROPOSED', comment: PC, measures: 'md (16) left and right of the body.' },
      { rule: 'Section gap', status: 'PROPOSED', comment: PC, measures: 'md to lg (16 to 24) between sections.' },
      { rule: 'Vertical padding inside rows', status: 'SET', source: 'tight vertical', measures: 'sm (8) maximum, top and bottom.' },
      { figure: 'spacing.png', caption: 'The spacing scale at true size.', alt: 'Spacing scale xs 4 to xxl 48' },
    ]),

    H1('3. Headers / title bar'),
    ...tbl([
      { rule: 'Every screen uses the Admin & Finance header (`AppChrome`)', status: 'SET', measures: 'Hamburger at left, options menu at right, title bar between.' },
      { rule: 'Blue title bar fills the row between the hamburger and the options menu', status: 'SET', measures: 'Resizing: the bar stretches to the space between the two menus; the menus never move.' },
      { rule: 'Equal 14 px blue above and below the title text (balanced vertically)', status: 'SET', measures: 'Padding: 14 above, 14 below. Vertical alignment: centred. Title text is centred horizontally.' },
      { rule: 'Title names the screen it is on ("Field Tech-Assigned Jobs")', status: 'SET', measures: 'Long titles wrap inside the bar; the 14 px bands stay equal.' },
      { rule: 'JOB screens only: title bar inset 5 px each side so the menus are visible', status: 'SET', source: 'Round 5', measures: 'Padding: 5 left, 5 right, on JOB screens only. Other screens use the full row.' },
      { rule: 'Job title bar = left "Job #N"+date, centre customer block, right schedule link', status: 'SET', measures: 'Left block left-aligned, centre block centred, right link right-aligned.' },
      { figure: 'titlebar.png', caption: 'Blue title bar: 14 px bands, 16 px side padding and the 5 px job inset.', alt: 'Title bar with padding callouts' },
    ]),

    H1('4. Tabs'),
    ...tbl([
      { rule: 'Use `DefaultTabBar`, never inline a tab bar', status: 'SET', measures: 'One shared component for every tab strip.' },
      { rule: 'Anchored directly under the header, full width, outside the scrolling body', status: 'SET', measures: 'Resizing: tabs share the full width; the bar does not scroll with the page.' },
      { rule: 'Active tab: bold + sand background + 2 px #2563eb underline', status: 'SET', measures: 'Label bold, centred both axes. Underline 2 px along the bottom edge.' },
      { rule: 'Inactive tab: weight 400, sandInactive background', status: 'SET', measures: 'Label weight 400, same padding as active so tabs do not shift.' },
      { figure: 'tabbar.png', caption: 'Active versus inactive tab with padding callouts.', alt: 'Tab bar active and inactive' },
    ]),

    H1('5. Buttons'),
    ...tbl([
      { rule: '`PayrollButton` is THE button; `Button`/`SandButton` are legacy', status: 'SET', measures: 'Use `PayrollButton` for every new button.' },
      { rule: '32 pt tall, 14 px side padding, radius 6, label 14/700 black centred both axes', status: 'SET', measures: 'Height 32. Padding 14 left and right. Radius 6. Label centred horizontally and vertically.' },
      { rule: 'Width = label + padding only; never stretch, never pass width/flex', status: 'SET', source: '2026-10-20', measures: 'Resizing: width grows with the label, never stretches to fill.' },
      { rule: 'Default tone sand; `danger` tone only when Jeff asks', status: 'SET', measures: 'Sand fill by default; danger red is opt-in.' },
      { rule: 'Selected state = 2 px blue bottom border', status: 'SET', measures: 'Border 2 px along the bottom edge, #2563eb.' },
      { rule: '~50 files still use legacy `Button`; convert when touched', status: 'OPEN', measures: 'Convert on touch; no sweep planned.' },
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
      { rule: 'Row min height 48 for tappable rows; thin divider line between rows', status: 'PROPOSED', source: 'matches picker', comment: PC, measures: 'Min height 48. Divider 1 px #CED4DA. Row grows taller if the text wraps.' },
      { rule: 'Never show raw UUIDs; show "Job #N" and drill into the job', status: 'SET', source: 'Payments', measures: 'The "Job #N" text is the tap target.' },
      { rule: 'Primary text 16 body; secondary 13 to 14 in textLight/textMuted', status: 'PROPOSED', comment: PC, measures: 'Primary above secondary, both left-aligned, gap xs (4).' },
    ]),

    H1('8. Empty states'),
    ...tbl([
      { rule: 'Use `EmptyState`: centred, bold 20 title (text colour), 16 muted message, 24 padding', status: 'PROPOSED', source: 'component as built', comment: PC, measures: 'Padding 24 all round. Centred horizontally; centred vertically in the list area.' },
      { rule: 'Message says what to do next, in plain words', status: 'PROPOSED', comment: PC, measures: 'One or two short sentences.' },
      { figure: 'list_empty.png', caption: 'List rows (section 7) and the empty state (section 8).', alt: 'List rows and empty state' },
    ]),

    H1('9. Color and type'),
    ...tbl([
      { rule: 'Brand navy #1B2A4A, gold/accent #E1AF80, sand #D9C7A0', status: 'SET', source: 'tokens', measures: 'See the swatches below.' },
      { rule: 'Status: success #2E7D32, danger #C62828, warning #FACC15, info #1976D2', status: 'SET', source: 'tokens', measures: 'See the swatches below.' },
      { rule: 'Headings Poppins, body Inter; sizes h4 20, body 16, label 14, small 13', status: 'SET', source: 'tokens', measures: 'This document uses the same families.' },
      { rule: 'No raw hex in new code (use tokens); known exception: #2563eb tab/selected blue', status: 'SET', measures: 'The blue is the only allowed raw value.' },
    ]),
    L.swatchTable([
      ['primary', '#1B2A4A', 'Brand navy: header, text on sand'],
      ['accent', '#E1AF80', 'Gold accent'],
      ['sand', '#D9C7A0', 'Buttons and the active tab'],
      ['sandInactive', '#E8E0CD', 'Inactive tab'],
      ['success', '#2E7D32', 'Status: success'],
      ['danger', '#C62828', 'Status: danger'],
      ['warning', '#FACC15', 'Status: warning'],
      ['info', '#1976D2', 'Status: info'],
      ['blue', '#2563EB', 'Tab underline and selected state (known exception)'],
      ['divider', '#CED4DA', 'Picker and list dividers'],
    ]),
    gap(),

    H1('Open questions for Jeff'),
  ];

  const q = (n, text, comment) => {
    const id = c.add(comment);
    return new D.Paragraph({ spacing: { after: 100 }, children: [
      new D.CommentRangeStart(id), new D.TextRun({ text: n + '. ', bold: true }), new D.TextRun(text),
      new D.CommentRangeEnd(id), new D.TextRun({ children: [new D.CommentReference(id)] })] });
  };
  kids.push(
    q(1, 'Are the PROPOSED rows right, or should I tighten any (especially list rows and empty states)?', 'Open question 1: answer here.'),
    q(2, 'Should the 5 px job-header inset become the default for all screens?', 'Open question 2: answer here.'),
    q(3, 'Anything missing: forms/inputs, cards, dialogs, badges, toasts?', 'Open question 3: answer here.'),
  );

  const doc = new D.Document({
    creator: 'JobCore', title: 'JobCore Style Sheet v0.2',
    styles: L.styles(), comments: c.config,
    sections: [{ properties: L.sectionProps(), footers: { default: L.footer('JobCore Style Sheet v0.2 DRAFT') }, children: kids }],
  });
  await L.emit(doc, path.join(L.ROOT, 'JobCore-Style-Sheet-v0.2.docx'), false);
})().catch((e) => { console.error(e); process.exit(1); });

'use strict';
const path = require('path');
const L = require('./lib');
const { D, T } = L;

(async () => {
  const comments = new L.Comments();
  const rows = [
    { rule: 'Sample SET rule using an `Identifier`', status: 'SET', source: 'source cited here', measures: ['Padding: 14 left and right', 'Align: centred both axes'] },
    { rule: 'Sample PROPOSED rule', status: 'PROPOSED', source: 'as built', measures: 'Gap: 8', comment: 'Sample comment anchored on a PROPOSED row.' },
    { rule: 'Sample OPEN item', status: 'OPEN', measures: '-' },
  ];
  const doc = new D.Document({
    creator: 'JobCore', title: 'JobCore Style Template',
    styles: L.styles(),
    comments: comments.config,
    sections: [{
      properties: L.sectionProps(),
      footers: { default: L.footer('JobCore Style Template') },
      children: [
        new D.Paragraph({ style: 'Title', children: [new D.TextRun('JobCore Style Template')] }),
        new D.Paragraph({ style: 'Subtitle', children: [new D.TextRun('Named styles that mirror the app: Poppins headings, Inter body.')] }),
        new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun('Heading 1 (Poppins Bold)')] }),
        new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: [new D.TextRun('Heading 2 (Poppins SemiBold)')] }),
        new D.Paragraph({ heading: D.HeadingLevel.HEADING_3, children: [new D.TextRun('Heading 3 (Poppins SemiBold)')] }),
        new D.Paragraph({ children: [new D.TextRun('Normal body text in Inter. Status markers: '),
          new D.TextRun({ text: 'SET', style: 'SETMark' }), new D.TextRun(' '),
          new D.TextRun({ text: 'PROPOSED', style: 'PROPOSEDMark' }), new D.TextRun(' '),
          new D.TextRun({ text: 'OPEN', style: 'OPENMark' }), new D.TextRun('. Code names use '),
          new D.TextRun({ text: 'PayrollButton', style: 'Ident' }), new D.TextRun('.')] }),
        new D.Paragraph({ style: 'Spec', children: [new D.TextRun('Spec caption style: small muted text for sources and figure notes.')] }),
        new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: [new D.TextRun('Rule table')] }),
        L.ruleTable(rows, comments),
        new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: [new D.TextRun('Colour swatch table')] }),
        L.swatchTable([['primary', '#1B2A4A', 'Brand navy'], ['accent', '#E1AF80', 'Gold accent'], ['sand', '#D9C7A0', 'Button and active tab']]),
        new D.Paragraph({ spacing: { before: 120 }, children: [] }),
        L.howToBox([['HowToBox', 'How To Box style: a shaded call-out for reading instructions.']]),
      ],
    }],
  });
  await L.emit(doc, path.join(L.ROOT, 'JobCore-Style-Template.dotx'), true);
})().catch((e) => { console.error(e); process.exit(1); });

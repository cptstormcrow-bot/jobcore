// Shared styles + helpers for the JobCore style template (.dotx) and style sheet (.docx).
// Both documents are produced from THIS module, so the named styles are identical.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const NM = 'E:\\Jeff\\node_modules\\';
const D = require(NM + 'docx');
const JSZip = require(NM + 'jszip');
const { writePreserving } = require('E:\\Jeff\\.claude\\scripts\\lib\\docx-preserve.js');

const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'assets', 'img');
const FONTS = path.join(ROOT, 'assets', 'fonts');

// App tokens (app/packages/ui/src/tokens.ts)
const T = {
  navy: '1B2A4A', gold: 'E1AF80', sand: 'D9C7A0', sandInactive: 'E8E0CD',
  text: '212529', textLight: '495057', textMuted: '868E96', border: 'ADB5BD',
  success: '2E7D32', danger: 'C62828', warning: 'FACC15', info: '1976D2',
  blue: '2563EB', divider: 'CED4DA',
};
const STATUS = {
  SET: { fill: 'E3F1E4', color: '2E7D32' },
  PROPOSED: { fill: 'FFF1C2', color: '8A5A00' },
  OPEN: { fill: 'E1EBF7', color: '1F4E8C' },
};
const W = { rule: 3900, status: 1500, measures: 4680 }; // sums to 10080 DXA = 7 in
const FULL = W.rule + W.status + W.measures;

// ---------- named styles ----------
function styles() {
  return {
    default: {
      document: { run: { font: 'Inter', size: 20, color: T.text }, paragraph: { spacing: { after: 80, line: 264 } } },
    },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Poppins', bold: true, size: 52, color: T.navy }, paragraph: { spacing: { before: 0, after: 60 } } },
      { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Inter', size: 22, color: T.textLight }, paragraph: { spacing: { after: 160 } } },
      { id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Poppins', bold: true, size: 36, color: T.navy },
        paragraph: { spacing: { before: 360, after: 120 }, keepNext: true, outlineLevel: 0,
          border: { bottom: { style: D.BorderStyle.SINGLE, size: 8, color: T.gold, space: 2 } } } },
      { id: 'Heading2', name: 'heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Poppins SemiBold', size: 28, color: T.navy },
        paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Poppins SemiBold', size: 23, color: T.textLight },
        paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } },
      { id: 'Spec', name: 'Spec', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Inter', size: 15, color: T.textMuted }, paragraph: { spacing: { before: 0, after: 40, line: 240 } } },
      { id: 'CellText', name: 'Cell Text', basedOn: 'Normal', quickFormat: true,
        run: { font: 'Inter', size: 18 }, paragraph: { spacing: { before: 0, after: 20, line: 252 } } },
      { id: 'RuleHead', name: 'Rule Head', basedOn: 'CellText', quickFormat: true,
        run: { font: 'Inter', bold: true, size: 18, color: 'FFFFFF' }, paragraph: { spacing: { before: 0, after: 0 } } },
      { id: 'HowToBox', name: 'How To Box', basedOn: 'Normal', quickFormat: true,
        run: { font: 'Inter', size: 18 }, paragraph: { spacing: { before: 0, after: 50, line: 260 } } },
    ],
    characterStyles: [
      { id: 'SETMark', name: 'SET', basedOn: 'DefaultParagraphFont', quickFormat: true,
        run: { bold: true, color: STATUS.SET.color, size: 18 } },
      { id: 'PROPOSEDMark', name: 'PROPOSED', basedOn: 'DefaultParagraphFont', quickFormat: true,
        run: { bold: true, color: STATUS.PROPOSED.color, size: 18 } },
      { id: 'OPENMark', name: 'OPEN', basedOn: 'DefaultParagraphFont', quickFormat: true,
        run: { bold: true, color: STATUS.OPEN.color, size: 18 } },
      { id: 'Ident', name: 'Identifier', basedOn: 'DefaultParagraphFont', quickFormat: true,
        run: { bold: true, color: T.navy } },
    ],
  };
}

function tableStylesXml() {
  const b = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="${T.border}"/>`;
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b).join('');
  const mar = (t, l) => `<w:tblCellMar><w:top w:w="${t}" w:type="dxa"/><w:left w:w="${l}" w:type="dxa"/><w:bottom w:w="${t}" w:type="dxa"/><w:right w:w="${l}" w:type="dxa"/></w:tblCellMar>`;
  const first = (fill, color) => `<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:color w:val="${color}"/></w:rPr><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:tcPr></w:tblStylePr>`;
  return (
    `<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>` +
    `<w:style w:type="table" w:customStyle="1" w:styleId="JCRuleTable"><w:name w:val="Rule table"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="59"/><w:qFormat/><w:tblPr><w:tblBorders>${borders}</w:tblBorders>${mar(60, 100)}</w:tblPr>${first(T.navy, 'FFFFFF')}</w:style>` +
    `<w:style w:type="table" w:customStyle="1" w:styleId="JCSwatchTable"><w:name w:val="Colour swatch table"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="59"/><w:qFormat/><w:tblPr><w:tblBorders>${borders}</w:tblBorders>${mar(50, 100)}</w:tblPr>${first(T.sand, T.text)}</w:style>`
  );
}

// ---------- fonts to embed (obfuscated .odttf, ECMA-376 Part 2) ----------
const EMBED = [
  { name: 'Inter', regular: 'Inter_400Regular.ttf', bold: 'Inter_700Bold.ttf', family: 'swiss' },
  { name: 'Poppins', bold: 'Poppins_700Bold.ttf', family: 'swiss' },
  { name: 'Poppins SemiBold', regular: 'Poppins_600SemiBold.ttf', family: 'swiss' },
];
function obfuscate(buf, guidHex) {
  const key = Buffer.from(guidHex, 'hex').reverse();
  const out = Buffer.from(buf);
  for (let i = 0; i < 32; i++) out[i] ^= key[i % 16];
  return out;
}
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function postProcess(buf, { dotx = false } = {}) {
  const zip = await JSZip.loadAsync(buf);
  // 1. table styles
  let sx = await zip.file('word/styles.xml').async('string');
  sx = sx.replace(/<w:style [^>]*w:styleId="TableNormal"[^>]*>[\s\S]*?<\/w:style>/, '');
  sx = sx.replace('</w:styles>', tableStylesXml() + '</w:styles>');
  zip.file('word/styles.xml', sx);
  // 2. tblLook on every table
  let dx = await zip.file('word/document.xml').async('string');
  dx = dx.replace(/<\/w:tblPr>/g, '<w:tblLook w:val="0420" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>');
  zip.file('word/document.xml', dx);
  // 3. fonts
  let rels = '';
  let fonts = '';
  let n = 0;
  const embedXml = (tag, file) => {
    n += 1;
    const guid = crypto.randomUUID().toUpperCase();
    const data = obfuscate(fs.readFileSync(path.join(FONTS, file)), guid.replace(/-/g, ''));
    zip.file(`word/fonts/font${n}.odttf`, data);
    rels += `<Relationship Id="rId${n}" Type="${NS_R}/font" Target="fonts/font${n}.odttf"/>`;
    return `<w:${tag} r:id="rId${n}" w:fontKey="{${guid}}"/>`;
  };
  for (const f of EMBED) {
    let e = '';
    if (f.regular) e += embedXml('embedRegular', f.regular);
    if (f.bold) e += embedXml('embedBold', f.bold);
    fonts += `<w:font w:name="${f.name}"><w:charset w:val="00"/><w:family w:val="${f.family}"/><w:pitch w:val="variable"/>${e}</w:font>`;
  }
  zip.file('word/fontTable.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="${NS_W}" xmlns:r="${NS_R}">${fonts}</w:fonts>`);
  zip.file('word/_rels/fontTable.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  let ct = await zip.file('[Content_Types].xml').async('string');
  if (!/Extension="odttf"/.test(ct)) ct = ct.replace('<Override', '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Override');
  if (!/\/word\/fontTable\.xml/.test(ct)) ct = ct.replace('</Types>', '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/></Types>');
  if (dotx) ct = ct.replace('wordprocessingml.document.main+xml', 'wordprocessingml.template.main+xml');
  zip.file('[Content_Types].xml', ct);
  let dr = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!/fontTable\.xml/.test(dr)) dr = dr.replace('</Relationships>', `<Relationship Id="rIdFT1" Type="${NS_R}/fontTable" Target="fontTable.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', dr);
  // 4. settings: embed flag
  let st = await zip.file('word/settings.xml').async('string');
  if (!/embedTrueTypeFonts/.test(st)) st = st.replace(/(<w:settings[^>]*>)/, '$1<w:embedTrueTypeFonts/>');
  zip.file('word/settings.xml', st);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------- building blocks ----------
function runs(text, base = {}) {
  // `name` -> identifier character style
  return String(text).split('`').map((seg, i) =>
    i % 2 ? new D.TextRun({ text: seg, style: 'Ident', ...base }) : new D.TextRun({ text: seg, ...base })).filter((r, i, a) => true);
}
function para(text, style = 'CellText', opts = {}) {
  return new D.Paragraph({ style, children: runs(text), ...opts });
}
const bd = (c = T.border) => ({ style: D.BorderStyle.SINGLE, size: 4, color: c });
const ALLB = (c) => ({ top: bd(c), bottom: bd(c), left: bd(c), right: bd(c) });

class Comments {
  constructor(author = 'Style Sheet v0.2', initials = 'SS') { this.items = []; this.author = author; this.initials = initials; }
  add(text) {
    const id = this.items.length;
    this.items.push({ id, author: this.author, initials: this.initials, date: new Date('2026-10-31T09:00:00Z'),
      children: [new D.Paragraph({ children: [new D.TextRun(text)] })] });
    return id;
  }
  get config() { return { children: this.items }; }
}

function ruleCell(text, comments, commentText) {
  let kids;
  if (commentText) {
    const id = comments.add(commentText);
    kids = [new D.CommentRangeStart(id), ...runs(text), new D.CommentRangeEnd(id),
      new D.TextRun({ children: [new D.CommentReference(id)] })];
  } else kids = runs(text);
  return new D.TableCell({ width: { size: W.rule, type: D.WidthType.DXA },
    children: [new D.Paragraph({ style: 'CellText', children: kids })] });
}
function statusCell(status, source) {
  const s = STATUS[status];
  const kids = [new D.Paragraph({ style: 'CellText', children: [new D.TextRun({ text: status, style: status + 'Mark' })] })];
  if (source) kids.push(new D.Paragraph({ style: 'Spec', children: [new D.TextRun(source)] }));
  return new D.TableCell({ width: { size: W.status, type: D.WidthType.DXA },
    shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: s.fill }, children: kids });
}
function measuresCell(lines) {
  const arr = Array.isArray(lines) ? lines : [lines];
  return new D.TableCell({ width: { size: W.measures, type: D.WidthType.DXA },
    children: arr.map((l) => para(l)) });
}
function headRow(labels, widths) {
  return new D.TableRow({ tableHeader: true, cantSplit: true,
    children: labels.map((l, i) => new D.TableCell({ width: { size: widths[i], type: D.WidthType.DXA },
      shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: T.navy },
      children: [new D.Paragraph({ style: 'RuleHead', children: [new D.TextRun(l)] })] })) });
}
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
// Image at true scale: canvas is 504 app px wide (3 image px per app px) shown 504 pt wide.
function image(name, alt) {
  const f = path.join(IMG, name);
  const { w, h } = pngSize(f);
  return new D.ImageRun({ type: 'png', data: fs.readFileSync(f),
    transformation: { width: w / 2.25, height: h / 2.25 },
    altText: { name, title: alt, description: alt } });
}
function figureRow(name, caption, alt) {
  return new D.TableRow({ cantSplit: true, children: [new D.TableCell({
    columnSpan: 3, width: { size: FULL, type: D.WidthType.DXA },
    margins: { top: 80, bottom: 40, left: 0, right: 0 },
    children: [
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 0, after: 20 }, children: [image(name, alt || caption)] }),
      new D.Paragraph({ style: 'Spec', alignment: D.AlignmentType.CENTER, children: [new D.TextRun(caption + ' Printed at 100%: 1 app px = 1 pt.')] }),
    ] })] });
}
function ruleTable(rows, comments, extras = {}) {
  const trs = [headRow(['Rule', 'Status', 'Measures: padding, alignment, resizing'], [W.rule, W.status, W.measures])];
  for (const r of rows) {
    if (r.figure) { trs.push(figureRow(r.figure, r.caption, r.alt)); continue; }
    trs.push(new D.TableRow({ cantSplit: true, children: [
      ruleCell(r.rule, comments, r.comment), statusCell(r.status, r.source), measuresCell(r.measures || '-')] }));
  }
  return new D.Table({ style: 'JCRuleTable', width: { size: FULL, type: D.WidthType.DXA },
    columnWidths: [W.rule, W.status, W.measures], rows: trs });
}
function swatchTable(rows) {
  const cw = [1100, 1700, 1200, 6080];
  const trs = [headRow(['Swatch', 'Token', 'Hex', 'Where it is used'], cw)];
  for (const [token, hex, use] of rows) {
    trs.push(new D.TableRow({ cantSplit: true, children: [
      new D.TableCell({ width: { size: cw[0], type: D.WidthType.DXA },
        shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: hex.replace('#', '') },
        children: [new D.Paragraph({ style: 'CellText', children: [new D.TextRun({ text: ' ', size: 28 })] })] }),
      new D.TableCell({ width: { size: cw[1], type: D.WidthType.DXA }, children: [para('`' + token + '`')] }),
      new D.TableCell({ width: { size: cw[2], type: D.WidthType.DXA }, children: [para(hex.toUpperCase())] }),
      new D.TableCell({ width: { size: cw[3], type: D.WidthType.DXA }, children: [para(use)] }),
    ] }));
  }
  return new D.Table({ style: 'JCSwatchTable', width: { size: cw.reduce((a, b) => a + b), type: D.WidthType.DXA },
    columnWidths: cw, rows: trs });
}
function howToBox(lines) {
  return new D.Table({ width: { size: FULL, type: D.WidthType.DXA }, columnWidths: [FULL], rows: [new D.TableRow({
    cantSplit: true, children: [new D.TableCell({ width: { size: FULL, type: D.WidthType.DXA },
      shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: 'F6F1E6' },
      borders: { top: bd(T.gold), bottom: bd(T.gold), right: bd(T.gold), left: { style: D.BorderStyle.SINGLE, size: 24, color: T.gold } },
      margins: { top: 100, bottom: 60, left: 180, right: 180 },
      children: lines.map(([style, text]) => para(text, style)) })] })] });
}
function sectionProps() {
  return { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } };
}
function footer(label) {
  return new D.Footer({ children: [new D.Paragraph({ style: 'Spec', alignment: D.AlignmentType.CENTER, children: [
    new D.TextRun(label + '  |  page '), new D.TextRun({ children: [D.PageNumber.CURRENT] }),
    new D.TextRun(' of '), new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES] })] })] });
}
async function emit(doc, outPath, dotx) {
  const raw = await D.Packer.toBuffer(doc);
  const buf = await postProcess(raw, { dotx });
  const res = writePreserving({ outPath, buf, log: (m) => console.log(m) });
  console.log(JSON.stringify(res));
  return res;
}
module.exports = { D, T, STATUS, W, FULL, ROOT, styles, para, runs, Comments, ruleTable, swatchTable, howToBox,
  figureRow, image, sectionProps, footer, emit, headRow };

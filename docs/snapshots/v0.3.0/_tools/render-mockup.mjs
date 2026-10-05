import { readFileSync } from 'node:fs';
export const TOKENS = {
  colors: {
    primary: '#1B2A4A', primaryLight: '#2C4066', primaryDark: '#0F1A2E',
    secondary: '#E8740C', secondaryLight: '#F5921A', secondaryDark: '#C46000',
    accent: '#F5A623', gold: '#E1AF80', offWhite: '#F8F9FA', surface: '#FFFFFF',
    surfaceAlt: '#F1F3F5', text: '#212529', textLight: '#495057', textMuted: '#868E96',
    textMutedDark: '#78818A', border: '#E9ECEF', overlay: 'rgba(27,42,74,.85)',
    success: '#2E7D32', danger: '#C62828', warning: '#D97706', info: '#1976D2',
  },
  spacing: [4, 8, 16, 24, 32, 48],
  radius: { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 },
  fonts: { heading: 'Poppins', headingWeight: 600, body: 'Inter', bodyWeight: 400 },
  sizes: { body: 16, h1: 40, label: 14, small: 13, lineHeight: 1.6 },
};

export const JOB_STATUS_COLORS = {
  new: 'textMuted', qualified: 'info', scheduled: 'primaryLight', assigned: 'primary',
  accepted: 'accent', en_route: 'secondaryLight', in_progress: 'secondary',
  completed: 'success', paid: 'secondaryDark', closed: 'primaryDark',
  declined: 'danger', needs_reschedule: 'warning', cancelled: 'textLight',
  archived: 'textMutedDark',
};

export const JOB_FLOW_ORDER = ['new', 'qualified', 'scheduled', 'assigned', 'accepted', 'en_route', 'in_progress', 'completed', 'paid', 'closed'];
export const JOB_BRANCH_ORDER = ['declined', 'needs_reschedule', 'cancelled', 'archived'];

const C = TOKENS.colors;

export function statusColor(status) {
  const n = JOB_STATUS_COLORS[status];
  return (n && C[n]) || C.textMuted;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function cssVars() {
  let v = ':root{';
  for (const [k, val] of Object.entries(C)) v += `--c-${k}:${val};`;
  TOKENS.spacing.forEach((s, i) => { v += `--sp-${i + 1}:${s}px;`; });
  for (const [k, val] of Object.entries(TOKENS.radius)) v += `--r-${k}:${val}px;`;
  v += `--f-heading:'${TOKENS.fonts.heading}',sans-serif;--f-body:'${TOKENS.fonts.body}',sans-serif;}\n`;
  v += `.phone{position:relative;width:300px;height:600px;box-sizing:border-box;background:var(--c-primary);border-radius:36px;padding:10px;box-shadow:0 6px 18px rgba(0,0,0,.3);font-family:var(--f-body);overflow:hidden}
.phone-screen{position:relative;width:100%;height:100%;background:var(--c-surface);border-radius:28px;overflow:hidden;display:flex;flex-direction:column}
.m-status{background:var(--c-primary);color:#fff;font-size:11px;display:flex;justify-content:space-between;padding:6px 16px 4px}
.m-chrome{background:var(--c-primary);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;min-height:28px}
.m-title{font-family:var(--f-heading);font-weight:600;font-size:15px;color:#fff;flex:1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-logo{display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--c-gold);margin-right:6px}
.m-crumb{background:var(--c-surfaceAlt);color:var(--c-textMuted);font-size:11px;padding:3px 12px}
.m-body{position:relative;flex:1;background:var(--c-offWhite);padding:12px;overflow:hidden;display:flex;flex-direction:column;gap:8px}
.m-lbl{font-size:12px;color:var(--c-textLight)}
.m-field{border:1px solid var(--c-border);background:var(--c-surface);border-radius:var(--r-sm);padding:6px 8px;font-size:12px;color:var(--c-textMuted);display:flex;justify-content:space-between}
.m-seg{display:flex;border:1px solid var(--c-border);border-radius:999px;overflow:hidden;font-size:11px}
.m-seg span{flex:1;text-align:center;padding:5px;background:var(--c-surface);color:var(--c-textLight)}
.m-seg span:first-child{background:var(--c-primary);color:#fff}
.m-over{background:var(--c-overlay);border-radius:var(--r-md);padding:10px;color:#fff;font-size:10px}
.m-dialog{background:var(--c-surface);color:var(--c-text);border-radius:var(--r-md);padding:10px;margin-top:6px;font-size:12px}
.m-card{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);padding:8px}
.m-card b{display:block;font-size:12px;color:var(--c-text)}
.m-card i{display:block;font-style:normal;font-size:11px;color:var(--c-textMuted)}
.m-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.m-grid span{height:14px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:3px}
.m-empty{text-align:center;color:var(--c-textMuted);font-size:13px;margin:auto}
.m-row{font-size:12px;color:var(--c-textLight);display:flex;align-items:center;gap:6px}
.m-row u{display:inline-block;width:14px;height:14px;border:1px solid var(--c-border);border-radius:3px;background:var(--c-surface)}
.m-btn{height:44px;min-height:44px;box-sizing:border-box;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;background:var(--c-primary)}
.m-btn.s{background:var(--c-secondary)}
.m-btn.o{background:transparent;color:var(--c-primary);border:2px solid var(--c-primary)}
.m-tabs{display:flex;background:var(--c-surface);border-top:1px solid var(--c-border)}
.m-tabs span{flex:1;text-align:center;padding:10px 0;font-size:12px;color:var(--c-textMuted)}
.m-tabs span.a{color:var(--c-secondary);border-bottom:3px solid var(--c-secondary)}
.m-chip{position:absolute;top:6px;right:8px;color:#fff;font-size:10px;padding:2px 8px;border-radius:999px}
.m-ribbon{position:absolute;top:260px;left:-40px;width:380px;text-align:center;transform:rotate(-30deg);background:rgba(198,40,40,.5);color:#fff;font-weight:700;font-size:20px;padding:6px 0;pointer-events:none}
.mini{position:relative;box-sizing:border-box;width:140px;height:90px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);overflow:hidden;font-family:var(--f-body);padding:8px 8px 8px 14px}
.mini .stripe{position:absolute;left:0;top:0;bottom:0;width:6px}
.mini .t{font-family:var(--f-heading);font-weight:600;font-size:12px;color:var(--c-text)}
.mini .s{font-size:10px;color:var(--c-textMuted);margin-top:4px}
.mini .mk{position:absolute;right:6px;bottom:6px;font-size:9px;font-weight:700}
`;
  return v;
}

const MODULE_COLORS = [C.primary, C.secondary, C.info, C.success, C.warning, C.secondaryDark, C.primaryLight, C.danger];
function moduleColor(m) {
  const s = String(m ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return MODULE_COLORS[h % MODULE_COLORS.length];
}

// Neutral OS status strip (the app itself uses <StatusBar style="auto"/>); decorative only.
function statusStrip() {
  return '<div aria-hidden="true" data-decor="status-strip" style="display:flex;justify-content:space-between;padding:6px 16px 2px;font-size:10px;color:#868E96;background:#F8F9FA"><span>&#9679;&#9679;&#9679;</span><span>&#9646;&#9646;&#9646;</span></div>';
}

// Header variant from screen key/module/route (screens.json has no role field on chrome).
function chromeVariant(s) {
  const key = String(s.key || '');
  if (key === 'calendar' || s.route === '/calendar') return 'calendar';
  if (/job-?detail|JobDetail/i.test(key) || s.route === '/job/[jobId]') return 'job-detail';
  if (s.module === 'admin-finance') return 'admin';
  if (s.module === 'field-tech') return 'field-tech';
  if (s.module === 'sales-marketing') return 'sales-marketing';
  return 'base';
}

function humanizeKey(k) {
  return String(k || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'Screen';
}

// Title fallback order: chrome.title -> first header/section element label -> s.title (non-dynamic)
// -> humanized screen key. Never blank. Dynamic job titles come from sample-data jobs[0].
function chromeText(s, variant) {
  const ch = s.chrome || {};
  const sample = (variant === 'job-detail' && SAMPLE_JOB) || null;
  let title = ch.title;
  if (sample && ch.titleDynamic !== false) title = sample.customerName;
  if (!title && sample) title = sample.customerName;
  if (!title) {
    const els = Array.isArray(s.elements) ? s.elements : [];
    const hd = els.find((e) => (e.type === 'header' || e.type === 'section') && e.label && !e.dynamic);
    title = hd && hd.label;
  }
  if (!title) title = s.title;
  if (!title) title = humanizeKey(s.key || s.route);
  let sub = ch.subtitle || '';
  if (sample && (ch.subtitleDynamic || !sub)) sub = sample.fullAddress || sample.address || '';
  return { title: String(title), subtitle: String(sub || '') };
}

// Sample job for job-detail headers (inlined from sample-data.json jobs[0]: Karen Whitfield).
const SAMPLE_JOB = { customerName: 'Karen Whitfield', fullAddress: '412 Prospect St, La Jolla, CA 92037', address: '412 Prospect St' };

// Mirrors AppChrome.tsx:216-255 / styles 361-415 and JobHeader.tsx:125-163.
function renderChrome(s) {
  const variant = chromeVariant(s);
  const t = chromeText(s, variant);
  const icon = 'font-family:Poppins,sans-serif;font-weight:600;font-size:18px;color:#1B2A4A;padding:4px';
  if (variant === 'calendar') {
    return `<div data-chrome="calendar" data-unverified="1" style="background:#fff;border-bottom:1px solid #E9ECEF;padding:10px 12px;font-family:Poppins,sans-serif;font-size:15px;font-weight:600;color:#212529">${esc(t.title)}<span style="display:block;font-size:8px;font-weight:400;color:#868E96">unverified header</span></div>`;
  }
  const gold = variant === 'job-detail';
  const bg = gold ? '#E1AF80' : '#1B2A4A';
  const fg = gold ? '#212529' : '#fff';
  const shadow = gold ? '' : 'text-shadow:0 0 2px #000;';
  let h = `<div data-chrome="${variant}" style="width:100%;background:#F8F9FA">`;
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px">';
  h += `<span style="${icon}" aria-label="Menu">&#9776;</span>`;
  h += `<div style="flex:1;margin:0 4px;background:${bg};border-radius:10px;padding:4px 16px;text-align:center;overflow:hidden">`;
  h += `<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:15px;line-height:18px;color:${fg};${shadow}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>`;
  if (t.subtitle) h += `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:16px;color:${fg};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.subtitle)}</div>`;
  h += '</div>';
  h += `<span style="${icon}" aria-label="Options">&#8942;</span></div>`;
  if (gold) {
    h += '<div style="padding:4px 16px 0;font-family:Inter,sans-serif;font-size:11px;color:#212529"><div>Date Created: 7/30/2026</div><div>Progress: Not started</div><div>Tech: Unassigned</div><div>Service Area: Unassigned</div></div>';
    h += '<div style="height:3px;background:#212529;width:100%;margin:8px 0"></div>';
  }
  return h + '</div>';
}

// ---- S4b: element-driven body (exact source labels; dynamic values from seed sample data) ----
function loadJson(name) {
  try { return JSON.parse(readFileSync(new URL('./' + name, import.meta.url), 'utf8')); }
  catch (err) { throw new Error(`render-mockup: required file ${name} missing or invalid: ${err.message}`); }
}
const SAMPLE = loadJson('sample-data.json');
const KIT = loadJson('ui-kit-styles.json');
const KC = KIT.components;
const KT = KIT.tokens;

const FF = (f) => (/Poppins/.test(f || '') ? 'Poppins,sans-serif' : 'Inter,sans-serif');
const px = (n) => `${n}px`;
const BTN_VARIANTS = ['primary', 'secondary', 'outline', 'accent'];

function camelWords(k) { return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(); }

function lookupSeg(seg, job) {
  const by = SAMPLE.labelValueMapByJob[job.customerName] || {};
  const keys = [seg.toLowerCase(), camelWords(seg)];
  for (const k of keys) if (by[k] !== undefined && by[k] !== '') return by[k];
  for (const k of keys) if (SAMPLE.labelValueMap[k] !== undefined && SAMPLE.labelValueMap[k] !== '') return SAMPLE.labelValueMap[k];
  if (seg === 'status') return job.statusLabel;
  if (job[seg] != null && typeof job[seg] !== 'object') return String(job[seg]);
  const cust = SAMPLE.customers.find((c) => c.name === job.customerName);
  if (cust && cust[seg] != null) return String(cust[seg]);
  if (/^(title|name)$/i.test(seg)) return job.customerName;
  return null;
}

// Seed-backed job fields; null values stay unresolved (honest label). Only taken via an explicit job. prefix.
const JOB_SEED_KEYS = ['id', 'createdAt', 'completedAt', 'source', 'attachTiming', 'assignedTechName', 'assignedTechId'];

// Per-screen name rotation state (reset at the top of renderMockup).
let nameCount = 0;
let nameIdx = 0;

// Prefix-aware seed lookups (profiles / techSkills / job seed fields); returns string or null.
function lookupSeed(id, job) {
  const parts = id.split(/\??\./);
  const pre = parts.length > 1 ? parts[0] : '';
  const seg = parts[parts.length - 1];
  if (pre === 'job' && JOB_SEED_KEYS.includes(seg)) return job[seg] != null ? String(job[seg]) : null;
  if (!pre && seg === 'techName') return job.assignedTechName != null ? String(job.assignedTechName) : null;
  const tech = (SAMPLE.profiles || []).find((p) => p.id === job.assignedTechId);
  if (pre === 'tech' && seg === 'fullName') return tech ? tech.fullName : null;
  if (pre === 'profile' || pre === 'employee') {
    const profs = SAMPLE.profiles || [];
    if (seg === 'fullName' && profs.length) { nameIdx = nameCount % profs.length; nameCount++; }
    const p0 = profs[nameIdx];
    if (p0 && (seg === 'fullName' || seg === 'role') && p0[seg] != null) return String(p0[seg]);
  }
  if (!pre && seg === 'skill') {
    const sk = (SAMPLE.techSkills || []).find((t) => t.techId === job.assignedTechId);
    return sk ? sk.skill : null;
  }
  return null;
}

// Resolve "{expr}" tokens inside a label; returns {text, ok}.
function resolveDynamic(label, job) {
  let ok = true;
  const text = String(label).replace(/\{([^{}]*)\}/g, (m, expr) => {
    if (/(?:profile|employee)\??\.active/.test(expr)) { ok = false; return m; } // seed has no active flag
    const ids = expr.match(/[A-Za-z_]\w*(?:\??\.\w+)*/g) || [];
    for (const id of ids) {
      const seg = id.split(/\??\./).pop();
      if (['null', 'undefined', 'true', 'false'].includes(id)) continue;
      const v = lookupSeed(id, job) ?? (JOB_SEED_KEYS.includes(seg) || seg === 'techName' ? null : lookupSeg(seg, job));
      if (v != null) return v;
    }
    ok = false;
    return m;
  });
  return { text: ok ? text : String(label), ok };
}

function elAttrs(e, extra) {
  return `data-el="${esc(e.type)}" data-line="${esc(e.line)}"${extra || ''}`;
}

// Returns {text, attrs} for a label/placeholder of an element.
function resolveText(e, raw, job) {
  if (raw == null) return { text: '', attrs: '' };
  if (!e.dynamic) return { text: String(raw), attrs: '' };
  const r = resolveDynamic(raw, job);
  return { text: r.text, attrs: r.ok ? ' data-sample="1"' : ' data-unresolved="1"' };
}

function renderElement(e, job, pos) {
  const lab = resolveText(e, e.label, job);
  const ph = resolveText(e, e.placeholder, job);
  const attrs = elAttrs(e, (lab.attrs || ph.attrs));
  const type = String(e.type);
  const tf = KC.TextField, sel = KC.Select, tg = KC.Toggle, ei = KC.EmptyState, st = KC.ScreenTitle, li = KC.ListItem;
  if (type === 'button') {
    const vn = BTN_VARIANTS.includes(e.variant) ? e.variant : 'primary';
    const v = KC.Button.variants[vn];
    const style = `box-sizing:border-box;width:100%;min-height:${px(KC.Button.base.minHeight)};padding:${px(KC.Button.base.paddingVertical)} ${px(KC.Button.base.paddingHorizontal)};border-radius:${px(KC.Button.base.borderRadius)};border:${KC.Button.base.borderWidth}px solid ${v.borderColor || 'transparent'};background:${v.backgroundColor};color:${v.color};font-family:${FF(v.fontFamily || KC.Button.base.label.fontFamily)};font-weight:${v.fontWeight || KC.Button.base.label.fontWeight};font-size:${px(KC.Button.sizes.sm.fontSize)};display:flex;align-items:center;justify-content:center;text-align:center`;
    return `<div class="mk-button" ${attrs} style="${style}">${esc(lab.text)}</div>`;
  }
  if (type === 'field') {
    let h = `<div class="mk-field" ${attrs} style="width:100%">`;
    if (e.label != null) h += `<div style="font-family:${FF(tf.label.fontFamily)};font-weight:${tf.label.fontWeight};font-size:${px(tf.label.fontSize)};color:${tf.label.color};margin-bottom:${px(tf.label.marginBottom)}">${esc(lab.text)}</div>`;
    const inp = tf.input;
    const shown = e.placeholder != null ? ph.text : '';
    h += `<div style="box-sizing:border-box;border:${inp.borderWidth}px solid ${inp.borderColor};border-radius:${px(inp.borderRadius)};padding:${px(inp.paddingVertical)} ${px(inp.paddingHorizontal)};background:${inp.backgroundColor};font-size:${px(inp.fontSize)};font-family:${FF(inp.fontFamily)};color:${tf.placeholderColor};min-height:20px">${esc(shown)}</div></div>`;
    return h;
  }
  if (type === 'select') {
    let h = `<div class="mk-select" ${attrs} style="width:100%">`;
    if (e.label != null) h += `<div style="font-family:${FF(sel.label.fontFamily)};font-weight:${sel.label.fontWeight};font-size:${px(sel.label.fontSize)};color:${sel.label.color};margin-bottom:${px(sel.label.marginBottom)}">${esc(lab.text)}</div>`;
    const t = sel.trigger;
    h += `<div style="box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;border:${t.borderWidth}px solid ${t.borderColor};border-radius:${px(t.borderRadius)};padding:${px(t.paddingVertical)} ${px(t.paddingHorizontal)};background:${t.backgroundColor};font-size:${px(sel.triggerText.fontSize)};color:${sel.placeholderText.color};min-height:20px"><span style="flex:1">${e.placeholder != null ? esc(ph.text) : ''}</span><span style="margin-left:${px(sel.chevron.marginLeft)};color:${sel.chevron.color}">${sel.chevron.glyph}</span></div></div>`;
    return h;
  }
  if (type === 'toggle') {
    const tr = tg.track, th = tg.thumb;
    return `<div class="mk-toggle" ${attrs} style="display:flex;align-items:center;justify-content:space-between;min-height:${px(tg.base.minHeight)}"><span style="font-family:${FF(tg.label.fontFamily)};font-size:${px(tg.label.fontSize)};color:${tg.label.color};margin-right:${px(tg.label.marginRight)}">${esc(lab.text)}</span><span aria-hidden="true" style="box-sizing:border-box;width:${px(tr.width)};height:${px(tr.height)};border-radius:${px(tr.borderRadius)};background:${tr.backgroundColor};border:${tr.borderWidth}px solid ${tr.borderColor};padding:${px(tr.padding)};display:flex;align-items:center"><span style="width:${px(th.width)};height:${px(th.height)};border-radius:${px(th.borderRadius)};background:${th.backgroundColor}"></span></span></div>`;
  }
  if (type === 'empty') {
    const tstyle = pos === 0 ? `font-family:${FF(ei.title.fontFamily)};font-weight:${ei.title.fontWeight};font-size:${px(ei.title.fontSize)};color:${ei.title.color}` : `font-size:${px(ei.message.fontSize)};color:${ei.message.color};margin-top:${px(ei.message.marginTop)};text-align:center`;
    return `<div class="mk-empty" ${attrs} style="text-align:center;padding:${px(ei.base.padding)};${tstyle}">${esc(lab.text)}</div>`;
  }
  if (type === 'header') {
    const s2 = pos > 0;
    const o = s2 ? st.subtitle : st.title;
    return `<div class="mk-header" ${attrs} style="font-family:${FF(o.fontFamily)};font-weight:${s2 ? 400 : 700};font-size:${px(o.fontSize)};color:${o.color};margin-bottom:${px(o.marginBottom || 4)}">${esc(lab.text)}</div>`;
  }
  if (type === 'section') {
    return `<div class="mk-section" ${attrs} style="font-family:Poppins,sans-serif;font-weight:600;font-size:${px(KT.fontSize.h6)};color:${KT.color.text}">${esc(lab.text)}</div>`;
  }
  if (type === 'listitem') {
    const o = pos > 0 ? li.subtitle : li.title;
    return `<div class="mk-listitem" ${attrs} style="color:${o.color};font-size:${px(o.fontSize)};font-family:Inter,sans-serif;font-weight:${pos > 0 ? 400 : li.title.fontWeight}">${esc(lab.text)}</div>`;
  }
  // Visible fallback: unknown type still prints the exact label/placeholder.
  const raw = e.label != null ? lab.text : ph.text;
  return `<div class="mk-unknown" ${attrs} style="font-size:12px;color:${KT.color.text};border:1px dashed ${KT.color.border};padding:4px">${esc(raw)}</div>`;
}

// Group consecutive same-type elements on the same source line (title+subtitle pairs).
function renderElements(els) {
  let h = '';
  let i = 0;
  const job0 = SAMPLE.jobs[0];
  while (i < els.length) {
    const e = els[i];
    const grp = [e];
    let j = i + 1;
    if (e.type === 'listitem' || e.type === 'header' || e.type === 'empty') {
      while (j < els.length && els[j].type === e.type && els[j].line === e.line) { grp.push(els[j]); j++; }
    }
    if (e.type === 'listitem') {
      const anyDyn = grp.some((g) => g.dynamic);
      const rows = anyDyn ? SAMPLE.jobs : [job0];
      for (const job of rows) {
        h += `<div class="mk-row" style="box-sizing:border-box;padding:${px(KC.ListItem.base.paddingVertical)} 0;border-bottom:${KC.ListItem.base.borderBottomWidth}px solid ${KC.ListItem.base.borderBottomColor};min-height:${px(KC.ListItem.base.minHeight)}">`;
        grp.forEach((g, k) => { h += renderElement(g, job, k); });
        h += '</div>';
      }
    } else {
      grp.forEach((g, k) => { h += renderElement(g, job0, k); });
    }
    i = j;
  }
  return h;
}

export function renderMockup(screen) {
  nameCount = 0;
  nameIdx = 0;
  const s = screen || {};
  const comps = s.components || {};
  const menus = Array.isArray(s.menus) ? s.menus : [];
  const kind = s.kind || '';
  const els = Array.isArray(s.elements) ? s.elements : [];
  const n = (k) => Number(comps[k]) || 0;
  const chromeKinds = ['module-root', 'sub-view', 'drill-in'];
  let h = '<div class="jc-device" data-device-frame="1"><div class="phone"><div class="phone-screen">';
  h += statusStrip();
  if (n('AppChrome') > 0 || chromeKinds.includes(kind) || chromeVariant(s) === 'calendar') h += renderChrome(s);
  h += '<div class="m-body">';
  if (s.flowStage && s.flowStage !== 'none') h += `<span class="m-chip" style="background:${statusColor(s.flowStage)}">${esc(String(s.flowStage).replace(/_/g, ' '))}</span>`;
  if (!els.length) h += `<div data-decor="1" data-empty-screen="1" style="color:${C.textMuted};font-size:12px;text-align:center;margin:auto">No static UI elements captured for this screen</div>`;
  else h += renderElements(els);
  h += '</div>';
  if (menus.includes('tabs')) h += '<div class="m-tabs"><span class="a">Jobs</span><span>Calendar</span></div>';
  h += '</div>';
  if (s.mounted === false || s.mounted === 'exported-unmounted') h += '<div class="m-ribbon">NOT MOUNTED</div>';
  h += '</div></div>';
  return h;
}

// Device frame CSS: default Phone; an ancestor with data-device="pad" switches to Pad. No JS needed.
export const FRAME_CSS = [
  '.jc-device{box-sizing:border-box;width:390px;max-width:100%;margin:0 auto;background:#111;border:8px solid #111;border-radius:36px;box-shadow:0 8px 24px rgba(15,26,46,.35);overflow:hidden;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#212529;position:relative}',
  '.jc-device .phone{width:100%;max-width:100%;margin:0;border:0;box-shadow:none;background:#F8F9FA;border-radius:28px;overflow:hidden;position:relative}',
  '.jc-device .phone-screen{width:100%;max-width:100%;background:#F8F9FA;border-radius:28px;overflow:hidden;box-sizing:border-box}',
  '.jc-device .m-body{box-sizing:border-box;padding:12px;font-size:14px;border-color:#E9ECEF}',
  '.jc-device [data-el]{box-sizing:border-box;max-width:100%}',
  '.jc-device [data-el="button"]{padding:10px 14px;border-radius:10px;font-size:14px}',
  '.jc-device [data-el="field"],.jc-device [data-el="select"]{padding:10px 12px;border:1px solid #E9ECEF;border-radius:10px;font-size:14px;color:#212529}',
  '.jc-device [data-el="toggle"]{font-size:14px;color:#212529}',
  '.jc-device [data-el="listitem"]{padding:10px 12px;border-bottom:1px solid #E9ECEF;font-size:14px}',
  '.jc-device [data-el="section"]{padding:8px 0;font-size:13px;color:#868E96}',
  '.jc-device [data-el="empty"]{padding:16px;text-align:center;font-size:13px;color:#868E96}',
  '.jc-device [data-el="header"]{font-size:16px;font-weight:600;color:#1B2A4A}',
  '[data-device="pad"] .jc-device{width:820px;border-radius:22px;border-width:10px}',
  '[data-device="pad"] .jc-device .phone,[data-device="pad"] .jc-device .phone-screen{border-radius:14px}',
  '[data-device="pad"] .jc-device .m-body{padding:20px;font-size:16px}',
  '[data-device="pad"] .jc-device [data-el="button"]{padding:12px 18px;font-size:16px}',
  '[data-device="pad"] .jc-device [data-el="field"],[data-device="pad"] .jc-device [data-el="select"]{padding:12px 14px;font-size:16px}',
  '[data-device="pad"] .jc-device [data-el="toggle"],[data-device="pad"] .jc-device [data-el="listitem"]{padding:12px 14px;font-size:16px}',
  '[data-device="pad"] .jc-device [data-el="section"],[data-device="pad"] .jc-device [data-el="empty"]{font-size:15px}',
  '[data-device="pad"] .jc-device [data-el="header"]{font-size:20px}',
].join('\n');

export function renderMiniNode(screen) {
  const s = screen || {};
  const unm = s.mounted === false || s.mounted === 'exported-unmounted';
  return `<div class="mini"><div class="stripe" style="background:${moduleColor(s.module)}"></div><div class="t">${esc(s.title || s.route || 'Screen')}</div><div class="s">${esc(s.module || '')}</div><div class="mk" style="color:${unm ? C.danger : C.success}">${unm ? '✕ not mounted' : '● mounted'}</div></div>`;
}

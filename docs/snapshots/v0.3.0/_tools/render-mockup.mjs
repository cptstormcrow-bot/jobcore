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

export function renderMockup(screen) {
  const s = screen || {};
  const comps = s.components || {};
  const menus = Array.isArray(s.menus) ? s.menus : [];
  const pickers = Array.isArray(s.pickers) ? s.pickers : [];
  const btns = Array.isArray(s.buttonLabels) ? s.buttonLabels : [];
  const kind = s.kind || '';
  const title = s.title || s.route || 'Screen';
  const n = (k) => Number(comps[k]) || 0;
  const chromeKinds = ['module-root', 'sub-view', 'drill-in'];
  let h = '<div class="phone"><div class="phone-screen">';
  h += '<div class="m-status"><span>9:41</span><span>●●●●</span></div>';
  if (n('AppChrome') > 0 || chromeKinds.includes(kind)) {
    h += `<div class="m-chrome"><span>${menus.includes('drawer') ? '☰' : '&nbsp;'}</span><span class="m-title">${esc(title)}</span><span>${menus.includes('switcher') ? '<span class="m-logo"></span>' : ''}${menus.includes('options') ? '⋮' : ''}</span></div>`;
    if (kind === 'sub-view' || kind === 'drill-in') h += `<div class="m-crumb">${esc(s.module || '')} › ${esc(title)}</div>`;
  }
  h += '<div class="m-body">';
  if (s.flowStage && s.flowStage !== 'none') h += `<span class="m-chip" style="background:${statusColor(s.flowStage)}">${esc(String(s.flowStage).replace(/_/g, ' '))}</span>`;
  let drawn = false;
  const inputs = Math.min(4, n('TextField') + n('TextInput'));
  for (let i = 0; i < inputs; i++) { h += `<div><div class="m-lbl">Field ${i + 1}</div><div class="m-field"><span>&nbsp;</span></div></div>`; drawn = true; }
  for (const p of pickers) {
    drawn = true;
    if (p === 'Select') h += '<div class="m-field"><span>Select…</span><span>▾</span></div>';
    else if (p === 'DatePicker' || p === 'DateTimePicker') h += '<div class="m-field"><span>YYYY-MM-DD</span><span>📅</span></div>';
    else if (p === 'AxisPicker') h += '<div class="m-seg"><span>One</span><span>Two</span><span>Three</span></div>';
    else if (['Modal', 'AddTaskDialog', 'WarningSheet', 'JobClockModal'].includes(p)) h += `<div class="m-over">${esc(p)}<div class="m-dialog">${esc(p)}</div></div>`;
    else h += `<div class="m-field"><span>${esc(p)}</span><span>▾</span></div>`;
  }
  if (n('Card') || n('ListItem') || n('FlatList') || n('SectionList')) {
    drawn = true;
    for (let i = 0; i < 3; i++) h += '<div class="m-card"><b>Item title</b><i>Supporting detail</i></div>';
  }
  if (n('WeekView') || n('MonthView') || n('CalendarHeader') || n('DateRangeCalendar')) {
    drawn = true;
    h += `<div class="m-grid">${'<span></span>'.repeat(35)}</div>`;
  }
  for (const k of ['Checkbox', 'Toggle', 'Switch']) {
    if (n(k)) { drawn = true; h += `<div class="m-row"><u></u>${k}</div>`; }
  }
  if (n('EmptyState') && !drawn) h += '<div class="m-empty">Nothing here yet</div>';
  let bl = btns.slice(0, 4);
  if (!bl.length && kind === 'route' && (s.route === '/sign-in' || s.route === '/sign-up')) bl = ['Continue'];
  bl.forEach((b, i) => { h += `<div class="m-btn${i === 1 ? ' s' : i > 1 ? ' o' : ''}">${esc(b)}</div>`; });
  h += '</div>';
  if (menus.includes('tabs')) h += '<div class="m-tabs"><span class="a">Jobs</span><span>Calendar</span></div>';
  h += '</div>';
  if (s.mounted === false || s.mounted === 'exported-unmounted') h += '<div class="m-ribbon">NOT MOUNTED</div>';
  h += '</div>';
  return h;
}

export function renderMiniNode(screen) {
  const s = screen || {};
  const unm = s.mounted === false || s.mounted === 'exported-unmounted';
  return `<div class="mini"><div class="stripe" style="background:${moduleColor(s.module)}"></div><div class="t">${esc(s.title || s.route || 'Screen')}</div><div class="s">${esc(s.module || '')}</div><div class="mk" style="color:${unm ? C.danger : C.success}">${unm ? '✕ not mounted' : '● mounted'}</div></div>`;
}

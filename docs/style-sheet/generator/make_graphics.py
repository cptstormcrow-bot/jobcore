"""JobCore style-sheet graphics. 1 app px = 3 image px (final), drawn at 6x then downsampled.
In the docx an image of N px is shown N/3 pt wide, i.e. 1 app px = 1 pt on the page (about 2.2x phone size)."""
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', 'assets', 'fonts')
OUT = os.path.join(HERE, '..', 'assets', 'img')
os.makedirs(OUT, exist_ok=True)
K = 6
FINAL = 3

C = dict(primary='#1B2A4A', accent='#E1AF80', text='#212529', textLight='#495057', textMuted='#868E96',
         sand='#D9C7A0', sandInactive='#E8E0CD', blue='#2563eb', danger='#C62828',
         border='#ADB5BD', divider='#CED4DA', white='#FFFFFF', offWhite='#F8F9FA',
         callout='#D6336C', black='#000000')

_fc = {}
def font(name, size):
    key = (name, size)
    if key not in _fc:
        f = {'inter': 'Inter_400Regular.ttf', 'interb': 'Inter_700Bold.ttf', 'pop': 'Poppins_600SemiBold.ttf'}[name]
        _fc[key] = ImageFont.truetype(os.path.join(FONTS, f), int(round(size * K)))
    return _fc[key]

class Cv:
    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.im = Image.new('RGB', (w * K, h * K), bg or C['white'])
        self.d = ImageDraw.Draw(self.im)
    def rect(self, x, y, w, h, fill=None, r=0, outline=None, ow=1):
        b = [x * K, y * K, (x + w) * K - 1, (y + h) * K - 1]
        if r: self.d.rounded_rectangle(b, radius=r * K, fill=fill, outline=outline, width=int(ow * K))
        else: self.d.rectangle(b, fill=fill, outline=outline, width=int(ow * K))
    def text(self, x, y, s, f='inter', size=12, fill=None, anchor='la'):
        self.d.text((x * K, y * K), s, font=font(f, size), fill=fill or C['text'], anchor=anchor)
    def tw(self, s, f, size):
        return font(f, size).getlength(s) / K
    def line(self, x1, y1, x2, y2, fill=None, w=1, dash=False):
        fill = fill or C['callout']
        if dash:
            L = math.hypot(x2 - x1, y2 - y1); n = max(int(L / 4), 1)
            for i in range(0, n, 2):
                a, b = i / n, min((i + 1) / n, 1)
                self.d.line([((x1 + (x2 - x1) * a) * K, (y1 + (y2 - y1) * a) * K), ((x1 + (x2 - x1) * b) * K, (y1 + (y2 - y1) * b) * K)], fill=fill, width=int(w * K))
        else:
            self.d.line([x1 * K, y1 * K, x2 * K, y2 * K], fill=fill, width=int(w * K))
    def arrow_h(self, x1, x2, y, label, above=True, col=None):
        col = col or C['callout']
        self.line(x1, y, x2, y, col, 1)
        for x, s in ((x1, 1), (x2, -1)):
            self.line(x, y - 3, x, y + 3, col, 1)
            self.d.polygon([(x * K, y * K), ((x + 4 * s) * K, (y - 2) * K), ((x + 4 * s) * K, (y + 2) * K)], fill=col)
        if label:
            self.text((x1 + x2) / 2, y - 13 if above else y + 2, label, 'inter', 10, col, 'ma')
    def arrow_v(self, x, y1, y2, label, side='r', col=None):
        col = col or C['callout']
        self.line(x, y1, x, y2, col, 1)
        for y, s in ((y1, 1), (y2, -1)):
            self.line(x - 3, y, x + 3, y, col, 1)
            self.d.polygon([(x * K, y * K), ((x - 2) * K, (y + 4 * s) * K), ((x + 2) * K, (y + 4 * s) * K)], fill=col)
        if label:
            if side == 'r': self.text(x + 5, (y1 + y2) / 2 - 6, label, 'inter', 10, col, 'la')
            else: self.text(x - 5, (y1 + y2) / 2 - 6, label, 'inter', 10, col, 'ra')
    def save(self, name):
        im = self.im.resize((self.w * FINAL, self.h * FINAL), Image.LANCZOS)
        im.save(os.path.join(OUT, name), dpi=(72 * FINAL, 72 * FINAL)); print(name, im.size)

def btn(cv, x, y, label, bg=None, border=None):
    w = cv.tw(label, 'interb', 14) + 28
    cv.rect(x, y, w, 32, bg or C['sand'], r=6)
    if border: cv.rect(x + 2, y + 30, w - 4, 2, border)
    cv.text(x + w / 2, y + 16, label, 'interb', 14, C['black'], 'mm')
    return w

W = 504
# 1. button states
cv = Cv(W, 215)
cv.text(8, 4, 'PayrollButton - four states (1 app px = 1 pt)', 'interb', 11, C['textLight'])
names = [('Default', 'Save', None, None), ('Disabled', 'Save', C['sandInactive'], None),
         ('Danger tone', 'Delete', C['danger'], None), ('Selected', 'Week', None, C['blue'])]
subs = ['sand #D9C7A0', 'sandInactive #E8E0CD', 'danger #C62828', '2 px underline #2563eb']
x = 64
for i, (nm, lab, bg, bd) in enumerate(names):
    y = 70
    w = btn(cv, x, y, lab, bg, bd)
    cv.text(x + w / 2, y + 44, nm, 'interb', 11, C['text'], 'ma')
    cv.text(x + w / 2, y + 58, subs[i], 'inter', 9, C['textMuted'], 'ma')
    x += max(w, 96) + 14
bx, by = 64, 70; bw = cv.tw('Save', 'interb', 14) + 28
cv.arrow_v(bx - 10, by, by + 32, 'height 32', side='l')
cv.arrow_h(bx, bx + 14, by - 8, '14')
cv.arrow_h(bx + bw - 14, bx + bw, by - 8, '14')
cv.text(bx + bw + 8, by + 22, 'radius 6', 'inter', 10, C['callout'])
cv.line(bx + bw - 3, by + 29, bx + bw + 7, by + 29, C['callout'], 0.6)
for a,b,c,d in ((bx+bw/2,by-3,bx+bw/2,by),(bx+bw/2,by+32,bx+bw/2,by+35),(bx-3,by+16,bx,by+16),(bx+bw,by+16,bx+bw+3,by+16)):
    cv.line(a,b,c,d,C['callout'],0.8)
cv.text(8, 150, 'Label: Inter bold 14 / line 18, black #000, centred on BOTH axes (dashed cross).', 'inter', 10, C['textLight'])
cv.text(8, 164, 'alignSelf: flex-start. Hit area grows 6 pt above and below (hitSlop), so the tap target is 44 pt tall.', 'inter', 10, C['textLight'])
cv.text(8, 178, 'Width = 14 + label + 14. Nothing else sets the width.', 'inter', 10, C['textLight'])
cv.save('btn_states.png')

# 2. resize flow
cv = Cv(W, 270)
cv.text(8, 4, 'Resizing flow - the button grows with its label and never stretches', 'interb', 11, C['textLight'])
cv.rect(8, 26, 488, 190, C['offWhite'], r=6, outline=C['divider'])
cv.text(16, 30, 'container (full width of the screen)', 'inter', 9, C['textMuted'])
y = 46
for lab in ['OK', 'Add Payment', 'Approve Selected Estimates']:
    w = btn(cv, 16, y, lab)
    cv.arrow_h(16, 30, y + 42, '14', above=False)
    cv.arrow_h(16 + w - 14, 16 + w, y + 42, '14', above=False)
    cv.text(16 + w + 10, y + 8, 'width = %d pt  (label %d + 28)' % (round(w), round(w - 28)), 'inter', 10, C['callout'])
    y += 56
cv.rect(16, 224, 480, 32, None, r=6, outline=C['danger'], ow=1)
cv.line(16, 224, 496, 256, C['danger'], 1); cv.line(16, 256, 496, 224, C['danger'], 1)
cv.rect(140, 232, 232, 16, C['white'])
cv.text(256, 240, 'NEVER: width / flex / stretch', 'interb', 11, C['danger'], 'mm')
cv.save('btn_resize.png')

# 3. tab bar
PW = 360
cv = Cv(W, 215)
cv.text(8, 4, 'DefaultTabBar on a 360 pt wide phone screen', 'interb', 11, C['textLight'])
ox, oy = 44, 30
cv.rect(ox, oy, PW, 140, C['offWhite'], outline=C['border'])
cv.text(ox + PW - 6, oy + 4, 'header (AppChrome) above', 'inter', 9, C['textMuted'], 'ra')
ty = oy + 28
x = ox; tabs = []
for lab, sel in [('Overview', True), ('Payments', False), ('Photos', False), ('Notes', False)]:
    f = 'interb' if sel else 'inter'
    w = cv.tw(lab, f, 14) + 24; h = 4 + 18 + 4 + 2
    cv.rect(x, ty, w, h, C['sand'] if sel else C['sandInactive'])
    if sel: cv.rect(x, ty + h - 2, w, 2, C['blue'])
    cv.text(x + w / 2, ty + 4 + 9, lab, f, 14, '#212529', 'mm')
    tabs.append((x, w, h)); x += w
cv.text(ox + 6, ty + 70, 'body scrolls here - the tab bar stays put', 'inter', 9, C['textMuted'])
x0, w0, h0 = tabs[0]
cv.arrow_h(x0, x0 + 12, ty - 8, '12')
cv.arrow_h(x0 + w0 - 12, x0 + w0, ty - 8, '12')
cv.text(x0 - 4, ty + 1, 'v 4', 'inter', 9, C['callout'], 'ra')
cv.text(ox + PW + 6, ty + h0 - 12, 'underline 2 px', 'inter', 9, C['callout'])
cv.text(ox + PW + 6, ty + h0 - 1, '#2563eb', 'inter', 9, C['callout'])
cv.text(x0 + 4, ty + h0 + 5, 'active: sand, bold 700', 'inter', 9, C['text'])
cv.text(tabs[1][0] + 4, ty + h0 + 18, 'inactive: sandInactive, weight 400, no underline', 'inter', 9, C['text'])
cv.text(ox, oy + 150, 'Tabs wrap to a second row (flexWrap), they do not scroll sideways. Label #212529, 14 pt.', 'inter', 10, C['textLight'])
cv.text(ox, oy + 164, 'Anchored directly under the header, full width, outside the scrolling body.', 'inter', 10, C['textLight'])
cv.save('tabbar.png')

# 4. title bar
def detailed(cv, ox, oy, inset, label):
    cv.text(ox, oy - 14, label, 'interb', 10, C['text'])
    cv.rect(ox, oy, PW, 112, C['offWhite'], outline=C['border'])
    mt = 40
    cv.rect(ox + 6, oy + mt, 24, 34, None, outline=C['border'])
    for i in range(3): cv.rect(ox + 11, oy + mt + 10 + i * 6, 14, 2, C['textLight'])
    cv.rect(ox + PW - 30, oy + mt, 24, 34, None, outline=C['border'])
    for i in range(3): cv.rect(ox + PW - 21, oy + mt + 9 + i * 6, 3, 3, C['textLight'])
    bx = ox + 34 + inset; bw = PW - 68 - 2 * inset; by = oy + 24
    bh = 14 + 20 + 18 + 14
    cv.rect(bx, by, bw, bh, C['primary'], r=10)
    band = '#3A4C75'
    cv.rect(bx + 6, by, bw - 12, 14, band); cv.rect(bx + 6, by + bh - 14, bw - 12, 14, band)
    cv.text(bx + 16, by + 14, 'Field Tech-Assigned Jobs', 'pop', 15, C['white'])
    cv.text(bx + 16, by + 14 + 20, 'subtitle 12 pt', 'inter', 12, C['accent'])
    pk = '#FFB3C9'
    cv.text(bx + bw - 12, by + 1, '14', 'inter', 10, pk, 'ra')
    cv.text(bx + bw - 12, by + bh - 13, '14', 'inter', 10, pk, 'ra')
    cv.arrow_h(bx, bx + 16, by + bh + 10, '', above=False)
    cv.text(bx + 20, by + bh + 4, '16 side padding: title starts 16 from the bar edge', 'inter', 9, C['callout'])
    if inset:
        cv.arrow_h(ox + 34, ox + 34 + inset, by - 5, '')
        cv.text(ox + 34 + inset / 2, by - 19, '5', 'inter', 10, C['callout'], 'ma')
        cv.arrow_h(ox + PW - 34 - inset, ox + PW - 34, by - 6, '')
        cv.text(ox + PW - 34 - inset / 2, by - 19, '5', 'inter', 10, C['callout'], 'ma')
    cv.text(ox + 18, oy + mt + 38, 'menu', 'inter', 8, C['textMuted'], 'ma')
    cv.text(ox + PW - 18, oy + mt + 38, 'options', 'inter', 8, C['textMuted'], 'ma')
cv = Cv(W, 356)
cv.text(8, 4, 'Title bar (AppChrome): standard screen vs JOB screen', 'interb', 11, C['textLight'])
detailed(cv, 72, 40, 0, 'Standard: bar fills the row between the hamburger and the options menu')
detailed(cv, 72, 184, 5, 'JOB screens: inset 5 px each side so both menus stay visible (Round 5)')
cv.text(72, 310, 'radius 10  |  bar #1B2A4A  |  title Poppins 15 white  |  subtitle Inter 12 gold #E1AF80', 'inter', 10, C['textLight'])
cv.text(72, 324, 'Pale bands show the 14 pt of blue above and below the text block (balanced vertically).', 'inter', 10, C['textLight'])
cv.text(72, 338, 'Gold-tone variant: bar colour sand #D9C7A0.', 'inter', 10, C['textLight'])
cv.save('titlebar.png')

# 5. job title bar zones
cv = Cv(W, 120)
cv.text(8, 4, 'Job title bar - three zones', 'interb', 11, C['textLight'])
ox, oy = 72, 28
cv.rect(ox, oy, PW, 62, C['primary'], r=10)
cv.text(ox + 16, oy + 14, 'Job #1042', 'pop', 14, C['white'])
cv.text(ox + 16, oy + 34, 'Oct 31, 2026', 'inter', 12, C['accent'])
cv.text(ox + PW / 2, oy + 14, 'Customer Name', 'pop', 14, C['white'], 'ma')
cv.text(ox + PW / 2, oy + 34, '123 Main St', 'inter', 12, C['accent'], 'ma')
cv.text(ox + PW - 16, oy + 24, 'Schedule', 'interb', 13, C['accent'], 'ra')
cv.line(ox + PW - 16 - cv.tw('Schedule', 'interb', 13), oy + 42, ox + PW - 16, oy + 42, C['accent'], 1)
for tx, t, al in ((ox + 16, 'LEFT: Job #N + date', 'la'), (ox + PW / 2, 'CENTRE: customer block', 'ma'), (ox + PW - 16, 'RIGHT: schedule link', 'ra')):
    cv.text(tx, oy + 70, t, 'inter', 10, C['callout'], al)
cv.save('titlebar_job.png')

# 6. picker
cv = Cv(W, 250)
cv.text(8, 4, 'TechSelect picker sheet', 'interb', 11, C['textLight'])
ox, oy = 44, 24
cv.rect(ox, oy, PW, 210, '#5A6478')
sw = 288; sx = ox + (PW - sw) / 2
cv.rect(sx, oy + 20, sw, 170, C['white'], r=10)
cv.text(sx + sw / 2, oy + 32, 'Choose a Field Tech', 'pop', 16, C['text'], 'ma')
for i, n in enumerate(['Alex Rivera', 'Sam Okafor', 'Jordan Lee']):
    yy = oy + 66 + i * 40
    cv.rect(sx + 8, yy - 1, sw - 16, 1, C['divider'])
    cv.text(sx + sw / 2, yy + 20, n, 'inter', 16, C['text'], 'mm')
cv.rect(sx + 8, oy + 66 + 3 * 40 - 1, sw - 16, 1, C['divider'])
cv.rect(sx, oy + 2, sw, 14, '#5A6478')
cv.arrow_h(sx, sx + sw, oy + 8, '', col='#FFB3C9')
cv.text(sx + sw / 2, oy + 3, '80% of width = 288 here (max 320)', 'inter', 9, '#FFB3C9', 'ma') if False else None
cv.text(ox + PW + 6, oy + 66, 'dividers #CED4DA', 'inter', 9, C['callout'])
cv.text(ox + PW + 6, oy + 80, 'text centred, 16 pt', 'inter', 9, C['callout'])
cv.text(ox + PW + 6, oy + 8, 'sheet = 80% of', 'inter', 9, C['callout'])
cv.text(ox + PW + 6, oy + 20, 'width, max 320', 'inter', 9, C['callout'])
cv.save('picker.png')

# 7. spacing
cv = Cv(W, 150)
cv.text(8, 4, 'Spacing scale (real size, 1 app px = 1 pt)', 'interb', 11, C['textLight'])
x = 24
for nm, v in (('xs', 4), ('sm', 8), ('md', 16), ('lg', 24), ('xl', 32), ('xxl', 48)):
    cv.rect(x, 80 - v, v, v, C['accent'])
    cv.text(x + v / 2, 88, nm, 'interb', 11, C['text'], 'ma')
    cv.text(x + v / 2, 102, str(v), 'inter', 11, C['callout'], 'ma')
    x += max(v, 24) + 28
cv.text(24, 128, 'Radius: sm 6 (buttons)   md 10 (title bar, cards)   lg 16', 'inter', 11, C['textLight'])
cv.save('spacing.png')

# 8. list + empty
cv = Cv(W, 260)
cv.text(8, 4, 'List rows and empty state (real size)', 'interb', 11, C['textLight'])
ox, oy = 8, 28
cv.rect(ox, oy, 250, 170, C['white'], outline=C['border'])
for i, (a, b) in enumerate((('Job #1042', 'Smith - Oct 30'), ('Job #1043', 'Lopez - Oct 31'))):
    yy = oy + 10 + i * 48
    cv.text(ox + 16, yy + 6, a, 'inter', 16, C['text'])
    cv.text(ox + 16, yy + 27, b, 'inter', 13, C['textLight'])
    cv.rect(ox + 16, yy + 47, 218, 1, C['divider'])
cv.arrow_v(ox + 256, oy + 10, oy + 58, 'min 48')
cv.text(ox + 256, oy + 72, 'divider 1 px', 'inter', 9, C['callout'])
cv.text(ox + 256, oy + 86, 'side gutter 16', 'inter', 9, C['callout'])
cv.text(ox + 256, oy + 100, 'primary 16', 'inter', 9, C['callout'])
cv.text(ox + 256, oy + 114, 'secondary 13', 'inter', 9, C['callout'])
ex = 336
cv.rect(ex, oy, 160, 170, C['white'], outline=C['border'])
cv.text(ex + 80, oy + 50, 'No jobs yet', 'pop', 20, C['text'], 'ma')
cv.text(ex + 80, oy + 84, 'Tap Add Job to', 'inter', 16, C['textMuted'], 'ma')
cv.text(ex + 80, oy + 104, 'create one.', 'inter', 16, C['textMuted'], 'ma')
cv.arrow_h(ex, ex + 24, oy + 140, '24')
cv.text(ox, oy + 180, 'EmptyState: centred, 24 padding, title 20 bold (text colour), message 16 muted.', 'inter', 10, C['textLight'])
cv.text(ox, oy + 194, 'Rows: min height 48, 1 px divider, 16 side gutter. All sizes are real pt.', 'inter', 10, C['textLight'])
cv.save('list_empty.png')

---
classification: sdassemblypros/jobcore
comments: "JobCore Style Sheet — v0.1 DRAFT (for Jeff to mark..."
origin: Codespace/SDAssemblyPros/Jobcore/docs/style-sheet/jobcore-style-sheet-v0.3.md
tags: [sdassemblypros, jobcore]
---
# JobCore Style Sheet — v0.3 (Jeff rulings 2026-10-31 applied)

One page. Every rule below is either **SET** (Jeff already ruled; source cited) or **PROPOSED** (read from the code as it is today, no ruling yet). Mark each row ✔ keep / ✎ change / ✘ drop in the last column. Values come from `app/packages/ui/src/tokens.ts`.

## 1. Global
| Rule | Status | Jeff's call |
|---|---|---|
| No bottom tab bar | SET | |
| No NEW on-screen Back buttons; existing ones Jeff asked for stay | SET (feedback-android-back-not-buttons) | |
| Android `<` follows actual visit history, never a fixed parent | SET (same) | |
| Every screen shows its screen-number badge | SET (jobcore-screen-number-working-rules) | |
| Tight vertical padding | SET | |
| Never inline-style a one-off; use the shared component | SET | |

## 2. Spacing (scale: xs 4 · sm 6 · md 10 · lg 15 · xl 20 · xxl 28)
| Use | Value | Status | Jeff's call |
|---|---|---|---|
| Gap between related items (label/value, icon/text) | xs–sm (4–6), keep | SET (Jeff 2026-10-31) | |
| Gap between rows / cards | sm (6) | SET (Jeff 2026-10-31) | |
| Screen side gutter | md (10) | SET (Jeff 2026-10-31) | |
| Section gap | md–lg (10–15) | SET (Jeff 2026-10-31) | |
| Vertical padding inside rows | tight: sm (6) max | SET (Jeff 2026-10-31) | |

## 3. Headers / title bar
| Rule | Status | Jeff's call |
|---|---|---|
| Every screen uses the Admin & Finance header (`AppChrome`) | SET | |
| Blue title bar fills the row between the hamburger and the options menu | SET | |
| Equal 10 px blue above and below the title text (was 14); side padding 20; both screens match sizing with menu/options | SET (Jeff 2026-10-31) | |
| Title names the screen it is on ("Field Tech-Assigned Jobs") | SET | |
| JOB screens only: title bar inset 10 px each side (was 5), gap between title box and menus; inset is for JOB screens only | SET (Jeff 2026-10-31) |
| BUG: tech login title bar clips text at the bottom | TO FIX | |
| Job title bar = left "Job #N"+date, centre customer block, right schedule link | SET | |

## 4. Tabs
| Rule | Status | Jeff's call |
|---|---|---|
| Use `DefaultTabBar`, never inline a tab bar | SET | |
| Anchored directly under the header, full width, outside the scrolling body | SET | |
| Tab font 13; padding top/bottom reduced by 3 px. Active tab: bold + sand background + 2 px #2563eb underline | SET (Jeff 2026-10-31) | |
| Inactive tab: weight 400, sandInactive background | SET | |

## 5. Buttons
| Rule | Status | Jeff's call |
|---|---|---|
| `PayrollButton` is THE button; `Button`/`SandButton` are legacy | SET | |
| 28 pt tall, 10 px side padding, radius 6, label 13/700 black centred both axes | SET (Jeff 2026-10-31) | |
| Width = label + padding only; never stretch, never pass width/flex | SET (2026-10-20) | |
| Default tone sand; disabled = one shade lighter than sandInactive (#F7F4EB); `danger` tone has white text; used only when Jeff asks | SET (Jeff 2026-10-31) | |
| Selected state = 2 px blue bottom border | SET | |
| ~50 files still use legacy `Button`; converted FIRST as part of this effort | SET (Jeff 2026-10-31) | |

## 6. Pickers
| Rule | Status | Jeff's call |
|---|---|---|
| Every field-tech picker is `TechSelect`: heading "Choose a Field Tech", sheet 80% wide max 320, centred larger text, grey #CED4DA dividers | SET | |
| Non-tech selects keep plain `Select` | SET | |

## 7. Lists (rows)
| Rule | Status | Jeff's call |
|---|---|---|
| Row min height 32 for tappable rows; thin divider line between rows | SET (Jeff 2026-10-31) | |
| Never show raw UUIDs; show "Job #N" and drill into the job | SET (Payments) | |
| Primary text 14; secondary 13 (unchanged) in textLight/textMuted | SET (Jeff 2026-10-31) | |

## 8. Empty states
| Rule | Status | Jeff's call |
|---|---|---|
| Use `EmptyState`: centred, bold 16 title (text colour), 16 muted message, 12 padding | SET (Jeff 2026-10-31) | |
| Message says what to do next, in plain words | SET (Jeff 2026-10-31) | |

## 9. Color and type
| Rule | Status | Jeff's call |
|---|---|---|
| Brand navy #1B2A4A, sand #D9C7A0 replaces accent #E1AF80 in app screens only (accent token stays for website match); sandInactive #E8E0CD becomes #F0EBDC | SET (Jeff 2026-10-31) | |
| Status: success #2E7D32, danger #C62828, warning #FACC15, info #1976D2 | SET (tokens) | |
| Headings Poppins, body Inter; sizes h4 20 · body 16 · label 14 · small 13 | SET (tokens) | |
| No raw hex in new code (use tokens); known exception: #2563eb tab/selected blue | SET | |

## Rulings (2026-10-31)
Tighten top/bottom spacing and remove unneeded text wraps everywhere. Q3 (forms, inputs, cards, dialogs, badges, toasts) is still open.

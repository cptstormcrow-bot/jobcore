---
classification: sdassemblypros/jobcore
comments: "JobCore Style Sheet — v0.1 DRAFT (for Jeff to mark..."
origin: Codespace/SDAssemblyPros/Jobcore/docs/style-sheet/jobcore-style-sheet-v0.1.md
tags: [sdassemblypros, jobcore]
---
# JobCore Style Sheet — v0.1 DRAFT (for Jeff to mark up)

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

## 2. Spacing (scale: xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48)
| Use | Value | Status | Jeff's call |
|---|---|---|---|
| Gap between related items (label/value, icon/text) | xs–sm (4–8) | PROPOSED | |
| Gap between rows / cards | sm (8) | PROPOSED | |
| Screen side gutter | md (16) | PROPOSED | |
| Section gap | md–lg (16–24) | PROPOSED | |
| Vertical padding inside rows | tight: sm (8) max | SET (tight vertical) | |

## 3. Headers / title bar
| Rule | Status | Jeff's call |
|---|---|---|
| Every screen uses the Admin & Finance header (`AppChrome`) | SET | |
| Blue title bar fills the row between the hamburger and the options menu | SET | |
| Equal 14 px blue above and below the title text (balanced vertically) | SET | |
| Title names the screen it is on ("Field Tech-Assigned Jobs") | SET | |
| JOB screens only: title bar inset 5 px each side so the menus are visible | SET (Round 5) | |
| Job title bar = left "Job #N"+date, centre customer block, right schedule link | SET | |

## 4. Tabs
| Rule | Status | Jeff's call |
|---|---|---|
| Use `DefaultTabBar`, never inline a tab bar | SET | |
| Anchored directly under the header, full width, outside the scrolling body | SET | |
| Active tab: bold + sand background + 2 px #2563eb underline | SET | |
| Inactive tab: weight 400, sandInactive background | SET | |

## 5. Buttons
| Rule | Status | Jeff's call |
|---|---|---|
| `PayrollButton` is THE button; `Button`/`SandButton` are legacy | SET | |
| 32 pt tall, 14 px side padding, radius 6, label 14/700 black centred both axes | SET | |
| Width = label + padding only; never stretch, never pass width/flex | SET (2026-10-20) | |
| Default tone sand; `danger` tone only when Jeff asks | SET | |
| Selected state = 2 px blue bottom border | SET | |
| ~50 files still use legacy `Button`; convert when touched | OPEN | |

## 6. Pickers
| Rule | Status | Jeff's call |
|---|---|---|
| Every field-tech picker is `TechSelect`: heading "Choose a Field Tech", sheet 80% wide max 320, centred larger text, grey #CED4DA dividers | SET | |
| Non-tech selects keep plain `Select` | SET | |

## 7. Lists (rows)
| Rule | Status | Jeff's call |
|---|---|---|
| Row min height 48 for tappable rows; thin divider line between rows | PROPOSED (matches picker) | |
| Never show raw UUIDs; show "Job #N" and drill into the job | SET (Payments) | |
| Primary text 16 body; secondary 13–14 in textLight/textMuted | PROPOSED | |

## 8. Empty states
| Rule | Status | Jeff's call |
|---|---|---|
| Use `EmptyState`: centred, bold 20 title (text colour), 16 muted message, 24 padding | PROPOSED (component as built) | |
| Message says what to do next, in plain words | PROPOSED | |

## 9. Color and type
| Rule | Status | Jeff's call |
|---|---|---|
| Brand navy #1B2A4A, gold/accent #E1AF80, sand #D9C7A0 | SET (tokens) | |
| Status: success #2E7D32, danger #C62828, warning #FACC15, info #1976D2 | SET (tokens) | |
| Headings Poppins, body Inter; sizes h4 20 · body 16 · label 14 · small 13 | SET (tokens) | |
| No raw hex in new code (use tokens); known exception: #2563eb tab/selected blue | SET | |

## Open questions for Jeff
1. Are the PROPOSED rows right, or should I tighten any (especially list rows and empty states)?
2. Should the 5 px job-header inset become the default for all screens?
3. Anything missing: forms/inputs, cards, dialogs, badges, toasts?

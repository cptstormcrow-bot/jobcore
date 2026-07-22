# P6 — Sales/Marketing module: reviews in, posts out

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

This phase builds `modules/sales-marketing`, which turns completed work into marketing material:
curated reviews, job photos with consent, and social posts. It is deliberately the **last feature
module**, because it consumes what P3–P5 produce.

It is also the phase most likely to be blocked by someone else's calendar. Direct Facebook and
Instagram publishing requires Meta **App Review** for `pages_manage_posts` and
`instagram_content_publish`, which takes weeks and is not something code can shorten. So this phase
ships a manual path that works on day one and puts the API path behind a feature flag.

## What exists already

- Reviews with a `publish_ok` consent flag and a `platform` field (P5)
- Completed jobs with `after` photos and quality notes (P4)
- Job data with `source`, `payer`, `attach_timing`, service, and community (P2/P3)
- The website already exposes `GET /api/reviews.php` returning `{ok, reviews[]}` ordered by
  `sort_order ASC, id ASC` — **curated order, not chronological**. Read it if useful; **never write
  to it**, and never modify anything on sdassemblypro.com.

## Build this

### 1. Module registration

`modules/sales-marketing`, `requiredRoles: ['sales', 'admin', 'owner']`. Contributes its own nav
entries. A `sales` user sees **non-financial** job fields only — never rates, commissions, or
payroll.

### 2. Migration `0006_marketing.sql`

`marketing_assets` · `post_drafts` · `post_targets` · `campaign_log`.

- A `marketing_asset` references a job photo or a review and carries its own `approved_for_public`
  flag, separate from the customer's `publish_ok`. **Both** must be true before an asset can enter a
  draft. Consent is not inherited by convenience.
- `post_drafts` holds the composed copy, selected assets, and status
  (`draft|approved|posted|failed`). `post_targets` records the intended platform per draft.

### 3. Review library

A browsable list of internal reviews where `publish_ok = true`, filterable by rating, service, and
community. Show the linked job's service and community so a review can be matched to a pitch — but
never show that job's money fields.

Mirror the website's curation model: a manual `sort_order` the sales user controls, defaulting to
newest-first but explicitly reorderable. **Never filter the library in a way that pressures which
customers get asked for reviews** — the asking already happened in P5, identically for everyone.

### 4. Pitch picker and composer

Pick a pitch angle (service line, community, seasonal, before/after), and the composer assembles a
draft: a suggested caption, selected assets, and per-platform character/aspect-ratio guidance. The
sales user edits freely; nothing posts without an explicit approve step.

If you generate suggested copy, it must be clearly marked as a draft suggestion and must never
fabricate a review quote, a customer name, or a claim about work that was not done.

### 5. The manual path — build this first, and make it good

The default and always-available path:

- Export the composed post as an image set plus the caption text.
- Save images to the device camera roll; copy the caption to the clipboard.
- Offer the OS share sheet to hand off to the Facebook or Instagram app directly.
- Log the intent in `campaign_log` with the target platform and timestamp so reporting works
  identically whether the post went out by API or by hand.

This path has **no API dependency and no App Review requirement**. It must be complete enough that
the business can run marketing indefinitely without item 6 ever shipping.

### 6. Direct posting — behind a feature flag, default OFF

`MetaPublishProvider` implementing a small `SocialProvider` interface (`id`, `displayName`,
`postDraft(draft): Promise<PostResult>`), targeting the Facebook Page and Instagram Business
account via the Graph API.

Requirements, all of which must be documented in the module README:

- Requires a Meta App with `pages_manage_posts` and `instagram_content_publish` **approved** — a
  multi-week review process.
- Requires a linked Instagram Business or Creator account; personal accounts cannot publish.
- Long-lived Page access tokens are stored server-side in Supabase, **never** in the app bundle and
  never in client-visible tables.
- Feature flag defaults **OFF**; with it off, the composer silently uses the manual path and the UI
  says so plainly rather than showing a broken button.

Define the interface so a future LinkedIn, Nextdoor, or Google Business Profile provider is a new
file, not a refactor.

### 7. Reporting

Posts by platform and period, assets used, and reviews collected per service and community. Note in
the module README that **paid ads are out of scope and additionally blocked** until Meta Pixel is
installed on the website — which is the website owner's task, not this app's.

## Do NOT build

- Any paid-ads buying, budget, or audience management
- Any change to sdassemblypro.com, including its reviews table, its `api/reviews.php`, its forms, or
  its GTM/GA4 tags — reading the public JSON endpoint is the only permitted interaction
- Any Meta Pixel or tracking-tag installation anywhere — analytics stays Google, and tracking
  machinery is not this app's to maintain
- Any rating-conditional review solicitation or filtering
- Any exposure of rates, commissions, payroll, or payout data to a `sales` user
- Publishing any photo or review lacking **both** consent flags

## Acceptance criteria

1. A `sales` user can browse reviews and job photos but a direct query of `commissions`,
   `price_sheets`, and `payout_batches` returns zero rows.
2. An asset with `publish_ok = false` **or** `approved_for_public = false` cannot be added to a
   draft — enforced server-side, not just in the UI.
3. The full compose → export → camera roll → share-sheet path works with the Meta flag OFF.
4. With the flag OFF, no Graph API call is made and the UI states that direct posting is unavailable.
5. With the flag ON and valid credentials, a draft posts to the Page and IG account and lands as
   `posted` in `campaign_log`.
6. A failed API post lands as `failed` with the error retained, and the manual path remains available
   as a fallback.
7. Access tokens appear in no client-readable table and in no bundled file.
8. Adding a second `SocialProvider` requires no change to the composer.
9. `grep -rn "GTM-\|G-93R\|gtag\|fbq" modules/sales-marketing` returns **no matches**.

## Verification steps

1. Sign in as `sales@…`; run `select * from commissions` and `select * from price_sheets` — expect
   zero rows each.
2. Flip a review's `publish_ok` to false and attempt to add it to a draft via a direct API call, not
   the UI — expect rejection.
3. With the flag OFF, compose and export a post; confirm the images land in the camera roll, the
   caption is on the clipboard, and a `campaign_log` row exists.
4. Inspect network traffic during step 3 — expect zero requests to `graph.facebook.com`.
5. With the flag ON in a Meta test app, post a draft and confirm the returned post id is stored.
6. Force an API failure (revoke the token) and confirm the draft reads `failed`, retains the error,
   and still offers manual export.
7. `grep -rni "access_token\|page_token" modules/sales-marketing apps/mobile` — expect no literal
   token values and no client-side storage.
8. `grep -rn "sdassemblypro" modules/sales-marketing` — any hit must be a read-only reference to the
   public reviews endpoint and nothing else.

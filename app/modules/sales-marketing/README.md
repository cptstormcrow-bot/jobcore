---
classification: sdassemblypros/jobcore
comments: "Sales & Marketing Module"
origin: Codespace/SDAssemblyPros/Jobcore/app/modules/sales-marketing/README.md
tags: [sdassemblypros, jobcore]
---
# Sales & Marketing Module

Composer and reporting for marketing posts, plus direct social publishing via
the `SocialProvider` interface (`src/domain/providers/`).

## Direct publishing feature flag

Direct Facebook/Instagram publishing is gated behind a boolean config value
the org admin sets, defaulting **OFF**. No dedicated feature-flag module
exists elsewhere in this repo to follow a naming convention from, so this
flag is treated as ordinary org config. With the flag OFF, the composer
silently uses the manual export path (see below) — the UI states plainly
that direct posting is unavailable, never a broken button.

## Meta App Review dependency

Direct Facebook/Instagram publishing requires a Meta App with
`pages_manage_posts` and `instagram_content_publish` **approved** by Meta.
This is a multi-week review process external to this codebase — nothing
here can shorten it.

## Instagram account requirement

Personal Instagram accounts cannot publish via the API. Only Instagram
Business or Creator accounts linked to a Facebook Page work with
`MetaPublishProvider`.

## Token storage

Long-lived Page access tokens are stored server-side in Supabase only.
They are never present in the app bundle and never stored in any
client-visible or client-readable table. The `meta-publish` Edge Function
is the only thing that reads them.

## Manual export path (default, always-available fallback)

The manual path is the default and remains available indefinitely, even if
direct posting never ships:

- Export the composed post as an image set + caption
- Save the images to the camera roll
- Copy the caption to the clipboard
- Hand off via the OS share sheet

No API dependency, no App Review requirement.

## Reporting scope

Paid-ads reporting is out of scope for this module, and is additionally
blocked until a Meta Pixel is installed on the website. Installing the
Pixel is the website owner's task, not this app's — this app must never
install any Meta Pixel or tracking tag itself.

## Provider extensibility

The `SocialProvider` interface (`src/domain/providers/types.ts`) is
registered through a barrel (`src/domain/providers/index.ts`) that the
Composer and Reporting screens resolve through, never by importing a
concrete provider directly. Adding a future LinkedIn, Nextdoor, or Google
Business Profile provider is a new file (e.g. `linkedin.ts`) registered in
`index.ts`, alongside the existing `meta.ts` (`MetaPublishProvider`) — not a
refactor to the composer.

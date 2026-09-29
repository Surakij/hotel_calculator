# Review decisions

This branch addresses reliability findings from the supplied 25-point review.

## Implemented

- Batch restore performance (5, 7, 8): room-assignment choices now refresh once
  after loading all rows. Benchmark on this workstation (headless Edge, mixed
  rooms/meals, ten warmed recalc samples): restore times for 10/50/100 rows
  changed from 26/179/1060 ms to 13/45/94 ms. Median recalc at 100 rows was about
  19 ms, with input rates preserved. These are local observations, not universal
  performance guarantees. Run `npm run benchmark` with Playwright available.

- Update requests now have a ten-second timeout. Isolated tests cover retries,
  concurrent checks, invalid manifests, storage failures and the reload guard.
- Release lint verifies all local asset build references, including styles.

- Money formatting (11, 23): Short Share now uses the same cent formatting as
  the table, removing its separate floating-point rounding step. Calculation
  precision is unchanged. Tests cover half-cent values and split periods with
  fractional rates and stacked discounts.
- Release preparation (20): `npm run release:prepare -- 1.6.30` prepares a
  visible release; `npm run release:prepare -- 1.6.29.2` prepares an internal
  build. The command updates package, manifest, app constants and HTML assets.
  It does not commit or publish. Update Unreleased notes and run checks before
  committing. No release command was applied to this branch yet.

- Module extraction (1): move update polling and reload decisions to
  updateManager.js, with draft saving provided by the application.
- DOM reads (8): reuse row values within one recalc pass; no persistent cache.

- Update safety: failed draft writes now prevent navigation. Active input and
  dialogs defer updates because partial fields and import text are not in drafts.
  Unavailable session storage also prevents navigation; it is needed for the
  reload guard. Concurrent checks are suppressed and manifest versions validated.
- Formula resilience (10): limit expressions to 512 characters before recursive
  parsing. Regression cases cover invalid numbers, division by zero, overflow,
  nested signs and excessive nesting through the public calculation API.
- Release maintenance (21, 22): record this branch in Unreleased and add CI for
  lint and unit tests. Browser tests are still run locally before release.

## Deferred

- Further module extraction (1, 12, 13, 16): reasonable incremental work, but moving
  calendars, share grouping, storage or undo is not required for these fixes.
- Shared rules and state (2, 3, 14, 15): preserve current input contracts. Manual
  child ages intentionally differ from imported adult-age classification.
  A universal normalizer or state rewrite needs its own compatibility work.
- Further performance work (4-8, 24, 25): recalc updates existing row controls; it does not
  rebuild the complete row table on every price change. Measure realistic large
  calculations before introducing caches, event delegation or delayed loading.
- Dates (9): current calendar-day helpers already account for ordinary daylight
  saving changes through rounded night differences. No date rewrite in this pass.
- Further rounding policy (11, 23): current totals retain precision until display. Switching to
  rounded line totals would change financial results; that policy needs a
  separate decision and dedicated reconciliation cases.
- Aliases and hotel data (17, 18): several migrations depend on room names, not
  just hotel aliases. JSON generation adds a build step to the file-based app.
- Historical scripts (19): left in place; deleting old tooling is not needed for
  runtime reliability and their external use has not been established.

No production deployment or version bump is part of this branch.

# StockLens implementation evidence

This branch is prepared for review. No production URL has been verified and no legacy account data has been imported. The owner confirmed existing accounts/watchlists must be preserved, but their source location is still unknown.

## Automated checks

- Native SQLite unit/API coverage (63 passing tests): async storage, rollback, account separation, revisions, password recovery, TOTP/OTP replay, persistent throttles and untrusted forwarded headers.
- Real official @libsql/client HTTP driver against isolated libSQL containers: commit/rollback/reconnect, app restart retaining login/watchlist, revision races, credential changes during delayed login, concurrent MFA enrollment and overlapping startup migrations.
- Import fixture checked against an isolated empty remote destination: unchanged password hashes, MFA key validation, watchlist conversion without holdings, revision preservation, discarded sessions/pending enrollment, occupied-target refusal and rollback.
- Real HTTP 401 database startup fails closed; no local database file is created. No production credentials are used in tests.
- Playwright: registration/login, research, MFA, email login, virtual users, PWA/offline privacy, plus all seven routes at 390/768/1440px. Responsive coverage exercises keyboard More/focus, long Thai titles, failed-save input retention, slow/error/empty news, stale-price timestamps, unavailable AI/email/Push and expired sessions.
- Docker Compose build and /api/health smoke. The Blueprint has plan: free and no disk, paid database or cron resource.

CI runs these gates and uploads responsive screenshots. Run locally with the scripts in package.json. The remote-storage CI job uses disposable loopback protocol servers, not a live Turso account.

## Rendered evidence

Screenshots use isolated test accounts and clearly labelled test news. No fixture news is bundled into the production UI.

| Screen | 390px before / after | 768px before / after | 1440px before / after |
| --- | --- | --- | --- |
| Account | [before](screenshots/before-auth-390.png) / [after](screenshots/after-auth-390.png) | [before](screenshots/before-auth-768.png) / [after](screenshots/after-auth-768.png) | [before](screenshots/before-auth-1440.png) / [after](screenshots/after-auth-1440.png) |
| Overview | [before](screenshots/before-overview-390.png) / [after](screenshots/after-overview-390.png) | [before](screenshots/before-overview-768.png) / [after](screenshots/after-overview-768.png) | [before](screenshots/before-overview-1440.png) / [after](screenshots/after-overview-1440.png) |

The user subsequently supplied two UI references: a dark floating lime navigation dock and a white/purple sliding login card. These override the earlier framed-sheet visual direction. The updated account form and dock are tested at all three widths, including email retention, panel placement, five destinations, active-bead alignment, keyboard use and reduced motion. See [the reference update and screenshots](REFERENCE_UI.md).

Taste/Impeccable are applied with the supplied reference as visual authority. Purple gradients and the selected lime glow are deliberate features from those references. Core privacy/error/service-state coverage remains in the existing browser suites.

The 6 November account refinement adds equal 50/50 desktop panes and one frame height for registration/login, with natural mobile flow. A regression first failed on the previous variable-height frame, then passed after the layout fix. Current local checks: all 63 unit/API tests plus reference UI (320px, 390/768/1440px and short desktop), general UI, responsive, MFA/privacy-race and email-login browser suites pass. Screenshots were inspected and replaced. The [design notes](AUTH_UI_REFINEMENT.md) pin the newly used Anthropic/Vercel skill revisions; this local rerun does not imply a production migration or live service-provider verification.

## Account-dependent cutover

Follow [FREE_CLOUD.md](FREE_CLOUD.md). Locate the original .data/stocklens.sqlite or a verified backup on the machine/service that ran the old app; keep the original MFA encryption and VAPID keys in a secret channel. Connect Render and provision a matching Turso Free libSQL database. Import before first production startup, then verify login/watchlist on HTTPS and after redeployment. Do not create an empty replacement account database or publish before the migration can be checked.


## Final fresh-review corrections

One independent whole-branch review found five important issues. Regression tests now cover stale password-to-email-challenge issuance after recovery, rollback of TOTP consumption when session creation fails, MFA/recovery secrets returning after dismissal/logout/account switch, and queued news/test Push after account deletion. The cutover runbook now freezes the source before the final backup and defines safe rollback before and after destination writes. An already-dispatched Push cannot be recalled.

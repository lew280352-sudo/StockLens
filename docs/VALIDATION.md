# StockLens implementation evidence

This branch is prepared for review. No production URL has been verified and no legacy account data has been imported. The owner confirmed existing accounts/watchlists must be preserved, but their source location is still unknown.

## Automated checks

- Native SQLite unit/API coverage: async storage, rollback, account separation, revisions, password recovery, TOTP/OTP replay, persistent throttles and untrusted forwarded headers.
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

Taste app direction: framed-sheet, seed 106675503, existing palette/type retained. Its static lint reported zero failures. Live inspection fixed the missing mobile auth h1. The remaining tiny-navigation warning names hidden legacy sidebar text; real Playwright checks reach and measure the visible navigation at all three widths. The auth form is intentionally centred within its panel, which triggers the unused-canvas heuristic.

Impeccable detection was run once on the final UI targets. Its avatar contrast finding was corrected. Its remaining navigation/glow readings refer to legacy style values rather than the live final cascade; visible navigation and toast styles were checked in the running app. The Inter warning is exempted by the approved requirement to preserve the app's fonts. These detector results are advisory evidence, not a claim of zero tool findings.

## Account-dependent cutover

Follow [FREE_CLOUD.md](FREE_CLOUD.md). Locate the original .data/stocklens.sqlite or a verified backup on the machine/service that ran the old app; keep the original MFA encryption and VAPID keys in a secret channel. Connect Render and provision a matching Turso Free libSQL database. Import before first production startup, then verify login/watchlist on HTTPS and after redeployment. Do not create an empty replacement account database or publish before the migration can be checked.

# StockLens implementation evidence

Production URL https://stocklen-znwy.onrender.com has been verified over HTTPS. Registration, login, preferences, onboarding and session revocation passed on a dedicated test account; no legacy account data was imported. The owner subsequently authorized a fresh database on 6 November 2026; legacy discovery/import is no longer a deployment prerequisite.

## Automated checks

- Native SQLite unit/API coverage (68 passing tests): async storage, rollback, account separation, revisions, password recovery, TOTP/OTP replay, persistent throttles, untrusted forwarded headers, first-use setup, session management and read-only legacy discovery.
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

The owner authorized starting fresh instead of migrating the Windows database. Render/Turso are configured on the host; credentials are deliberately absent from the workspace. See [the current status and standalone Windows finder](CUTOVER_STATUS.md). The local preview database and Docker smoke-test database were inspected read-only; both contain zero accounts and are not substitutes for the owner's original data. Live RSS probes successfully parsed all four company feeds; AI/SMTP/VAPID credentials remain absent and inbox/handset delivery is unverified.

Follow [FREE_CLOUD.md](FREE_CLOUD.md). Render and the fresh Turso libSQL database are connected. Set database credentials and fresh MFA/VAPID keys in secrets, deploy the validated source, then verify new-account login/watchlist on HTTPS and after redeployment. No legacy import is required under the current authorization; do not delete or overwrite the original files.

## First use and device management

The new account UI suite covers 390/768/1440px setup, failed-save retention, drafts conflicting with later in-app edits, persisted completion, account-scoped device lists, remote/self revocation and delayed private results after logout. An initial red test confirmed the previous app did not provide these pages/APIs. Existing general/PWA/20-user suites explicitly choose the first-use skip action before exercising their original workflows. The actual HTTP libSQL restart test now verifies onboarding and session records survive replacement and remote revocation also removes a linked Push subscription.

The Windows finder is a standalone Node script using read-only SQLite connections. Its test verifies correct account counts without revealing private columns or changing database bytes. The Windows .cmd wrapper itself has not been exercised on a Windows machine in this Linux workspace.


## Final fresh-review corrections

One independent whole-branch review found five important issues. Regression tests now cover stale password-to-email-challenge issuance after recovery, rollback of TOTP consumption when session creation fails, MFA/recovery secrets returning after dismissal/logout/account switch, and queued news/test Push after account deletion. The cutover runbook now freezes the source before the final backup and defines safe rollback before and after destination writes. An already-dispatched Push cannot be recalled.

## 13 November: appearance and online AI

73 unit/API tests pass, including Gemini header-only credentials, bounded responses, structured output and source-ID validation, a persistent per-provider generation cap, cached results and source-enabled brief fallback. Playwright passes light/dark with reload/cross-tab persistence, denied localStorage, 4.5:1 selected text contrast and all routes at 390/768/1440px. General UI, responsive, reference, account-tools and PWA regressions pass. Gemini transport/quotas use test fixtures; this is not a claim of successful live Gemini generation.

A fresh live probe retained the test account and its AAPL/NVDA watchlist, fetched 38 headlines, and found the running service still selected Ollama with summary HTTP 503. Deploy and actual provider generation must be checked after the update. See [online AI setup](AI_ONLINE.md).

The update is now live on Render: app/appearance asset hashes match commit e36b91b, a fresh login retained the pre-deploy watchlist, and the new free-host profile is active. Live Playwright passed light/dark and reload at 390/1440px. NVDA returned five real source-linked headlines with HTTP 200. The owner configured Groq. Live generation now returns a fresh Thai NVDA summary from five headlines and a follow-up answer with five valid source references, both HTTP 200. The temporary probe account was deleted. [Sanitized production evidence](test-results/production-2026-11-13.json) · [passing CI](https://github.com/lew280352-sudo/StockLens/actions/runs/43383514930).

Groq follow-up fixes expand the Thai summary/answer output budgets to 2400/1600 tokens, reject truncated structured responses, classify bounded provider errors without returning raw text, and distinguish the app daily cap from provider 429 with a validated retry time. Targeted AI/API regressions pass; the live probe verifies model output rather than model-list availability alone.

[CI for code commit 6d0b150](https://github.com/lew280352-sudo/StockLens/actions/runs/43385728800) passed all three jobs. A separate live browser probe rendered the real Groq summary, five source links and the enabled question form at 390/1440px with zero JavaScript errors; its temporary account was deleted too.

The theme selector now offers only light and dark, preserving existing explicit choices and using dark for legacy system preferences. The repeated breadcrumb beside the brand was removed. The appearance and reference suites cover both themes and navigation without the breadcrumb.

## Account overview and intentional sign-out

The topbar avatar now opens #account instead of logging out. The page shows the current account name/email, saved watchlist count, enabled-source count and company list, with links to devices, settings, sources and export. The only direct logout control is a red button at the end of that page. No backend or account schema changes are required.

Playwright verifies avatar navigation preserves the session, counts follow saved edits, #account survives reload, light/dark profiles fit 390/768/1440px and logout remains reachable. Existing general, responsive, reference, appearance, research, security/privacy-race and PWA suites pass through the updated account logout flow. The isolated 20-user scenario report records 20 passed and zero failed, including logout/login persistence.

## Article-body summaries

83 unit/API tests pass, including extracted body-only facts in model input, content-hash cache invalidation, no scripts/resource execution, approved publisher/path checks, rejected redirects, bounded HTML/text, persistent coalesced cache and two concurrent page reads. API coverage verifies authentication, source ownership, rechecking logout/source changes before generation, and explicit errors rather than headline substitution. The article browser suite covers source links, the news entry action, complete/partial/blocked states, light/dark at 390/768/1440px and delayed results after logout. Existing general and PWA suites pass.

Article text caching is best effort: a remote-cache failure does not discard successfully extracted source text. A real isolated libSQL HTTP integration test verifies article-cache persistence across reconnects, and an injected cache outage verifies a fresh body is still returned. The production Docker image also extracted a real NVIDIA article successfully.

## Direct first sign-in and scoped AI notice

Fresh accounts now enter the overview after signing in, without the setup page interrupting login or reload. Setup remains available from More. The AI error notice in the footer appears only on AI Insights. The account browser suite checks the first login, reload, optional setup and notice visibility across app routes in both themes at 390/768/1440px; general UI and PWA regressions pass too.

## Password character feedback

84 unit/API tests pass. New passwords and recovery resets reject non-ASCII characters on the server without consuming a recovery code. Password fields reject unsupported typing and whole pasted insertions, with an accessible red warning beneath the field; a rejected value requires correction before submission. English letters, digits, printable ASCII symbols and ordinary spaces retain their existing behavior. Playwright covers masked/revealed and confirmation fields, IME composition, autofill fallback, programmatic submission, recovery/security forms and both themes at mobile/desktop widths. The existing reference UI suite still passes its 320px and short-viewport layout checks.

## Free watchlist price display

The watchlist price panel now embeds TradingView Market Data when no Finnhub key or no usable API prices are available. It keeps source branding and delayed-data disclosure; widget values are display-only and never copied into the app API/database/AI. 84 unit/API tests pass. The new quote UI suite covers no-key/empty and changed watchlists, BRK.B, both themes at 390/768/1440px, refresh, source links if embeds fail, partial native quotes, iframe policy and late-response logout privacy. Existing general, responsive and PWA suites pass. Real-browser probes rendered NVIDIA prices and all 36 catalog symbols without credentials. Explicit widget background colors preserve readable dark/light surfaces when the browser paints cross-origin frames.

## Six-period price comparisons

85 unit/API tests pass. Finnhub quotes retain a valid previous close and compute dollar/percent changes; unknown, zero, negative and invalid baselines are omitted. The new comparison UI suite covers six ranges, followed-symbol selection, native daily changes, both themes at 390/768/1440px, keyboard focus, close/reopen, removing the selected company, no-key charts and delayed-response/account-switch privacy. Existing quote, responsive and PWA suites pass. A separate real-browser probe rendered NVIDIA charts with distinct dollar/percent changes for all six ranges through TradingView Symbol Overview, without requesting a paid historical API. The graph controls explicitly select one provider range at a time, and chart values remain inside the provider iframe.

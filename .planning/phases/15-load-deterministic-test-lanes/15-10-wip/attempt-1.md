# 15-10 attempt 1 (for the `## Attempts` table of docs/test-evidence/2026-11-09.md)

- Step: 1 (verify run 1 of 3)
- SHA: 81473a3930c32824e81c17c2db96469527a2088e
- audit:deps before the runs: exit 0, "All found vulnerabilities were already reviewed and decided to be ignored", 5 ignored (4 low, 1 moderate), 08:38:42Z
- Run: start 08:39:07Z, end 09:17:15Z, exit 1
- Unit stage: `Test Files  365 passed (365)`, `Tests  7175 passed (7175)`, Duration 201.81s (green)
- Builds root/sub/configured: green; csp/seo/budget asserts: green
- E2E stage: `Running 2354 tests using 4 workers`; `12 failed`, `4 skipped`, `2338 passed (29.3m)`; chain stopped here
- Failure shape (all 12): the page never hydrated (`<html hidden>` still present, `[data-settings-page][data-hydrated="true"]` never attached) or SvelteKit's error page rendered (`Internal Error`, `500: Something went wrong`). Trace console: `Failed to load resource: net::ERR_NETWORK_CHANGED` for every `_app/immutable/**` chunk in flight, then `TypeError: Failed to fetch dynamically imported module`.
- Root cause: the Intel Wi-Fi 7 BE201 adapter (driver Netwaw18 24.20.0.4, 2026-01-06) drops and re-joins the WLAN every 1-3 minutes under load (WLAN-AutoConfig event 8003 "The network is disconnected by the driver", then 8001 reconnect 3-5 s later). Each drop/re-join fires a Windows network-state change; Chromium's NetworkChangeNotifier aborts every in-flight request, loopback included, with ERR_NETWORK_CHANGED. 42 such disconnects in the 5 h before 09:17Z; 10 inside this run's E2E window (08:48:13, 08:55:21, 08:56:13, 08:59:32, 09:00:48, 09:02:22, 09:07:29, 09:08:31, 09:09:16, 09:10:32) plus 09:14:35, 09:15:22, 09:16:14, 09:17:00.
- Per-failure wall clock (trace context start -> first ERR_NETWORK_CHANGED): 08:48:13 +0.7s agent-a11y; 08:49:36 +1.7s a11y-keyed; 08:55:27 +1.0s marketing; 08:55:28 +0.6s investor/sweep; 08:56:12 +0.5s layout; 08:59:31 +0.6s settings-storage; 08:59:38 +0.8s settings-security; 09:07:28 +1.5s feedback; 09:08:36 +1.7s investor/deals; 09:09:21 +0.5s investor/print; 09:16:13 +1.0s feedback.configured; 09:16:14 +0.8s studio-social.
- Same cause for the 15-01 deferred item: 15-01's three browser-startup failures were at 06:50Z, 06:59Z and 07:29Z; WLAN 8003 events exist at 06:50:42, 06:59:44 and 07:29:18.
- Fix: none in the repository (no retry, no timeout raise). The host network must be stable before the protocol restarts from Task 1 step 1 at the same SHA (plus any docs commits).
- Load during the run: CPU utility about 50% during E2E (4 workers + serve-pages); idle baseline 2-10%; VS Code (39 processes), Chrome (40), mesh-llm, 15 idle MCP node servers.

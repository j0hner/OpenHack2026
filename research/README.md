# Source access research

The committed `cors-results.json`, `cors-data-results.json`, and `cors-verify-results.json` contain bounded GET probe summaries from 2026-11-13, including exact URLs, status, response format, CORS headers, and short body previews. `probe-cors.mjs` can repeat these checks.

Full downloaded response bodies under `cors-evidence/` are generated local research artifacts and are excluded from Git. The small `vuv-rest-metadata.txt` snapshot is retained because the integration plan references its layer mapping. Existing local response files are left unchanged.

These are server-side header probes, not end-to-end browser tests or licensing determinations. See `docs/data-integration.md` for interpretation and the rollout plan.

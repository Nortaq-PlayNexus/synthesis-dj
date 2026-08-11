# Security policy

## Supported versions

The project is currently pre-stable (v1.0.0). Security fixes are backported to the
latest release only.

| Version      | Supported      |
| ------------ | -------------- |
| latest (1.x) | ✅             |
| older 1.x    | ⚠️ best-effort |

## Reporting a vulnerability

Do **not** open a public issue for security problems. Instead, email
`dev@synthesis-dj.example` with:

- The affected version(s) and platform.
- A description of the vulnerability and the potential impact.
- Proof of concept or reproduction steps (if available).
- Your suggestion for remediation, if you have one.

You should receive an acknowledgment within 72 hours. We will follow up with a plan
and coordinate a disclosure timeline. Please do not disclose the issue publicly until
we have released a fix and announced it.

## Known security posture

- **Context isolation** is enabled; the renderer has no Node access
  (`nodeIntegration: false`, `sandbox: true` for the logo-render window).
- The preload exposes a minimal, audited bridge (`window.synthesis`).
- A strict Content Security Policy is shipped in `index.html`. The only intentional
  wildcard is `connect-src *`, required for the optional LLM advisor; it permits the
  user to point the app at their own endpoints.
- All external URLs are opened via the system browser (`shell.openExternal`); no
  renderer-initiated navigation reaches the app window.
- LLM API keys are held in renderer memory only and are never written to disk.
- No telemetry, no analytics, no network calls except the user-initiated optional LLM
  request.

## Dependency scanning

`npm audit` runs as part of the default npm flow (`.npmrc` sets `audit=true`). CI
does not hard-fail on transitive dev-toolchain advisories that have no upstream fix;
review `npm audit` output before releases and document any known-deferred findings in
the release notes.

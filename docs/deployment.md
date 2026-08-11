# Deployment & packaging

SYNTHESIS is a desktop Electron app. It can be run from source or distributed as
platform installers built with `electron-builder`.

## Prerequisites

- Node.js 18+ and npm.
- Platform build tools for your target OS:
  - **Windows** — nothing extra for NSIS; code-signing optional.
  - **macOS** — needs macOS to build `.dmg`/`.zip`; signing optional.
  - **Linux** — needs `dpkg`/`rpm` tools; see electron-builder docs.

## Building installers

```bash
npm run dist        # build for the current platform
npm run dist:win    # explicit Windows target
```

Output lands in `dist/`. All app code is under `src/` and the package declares no
production `dependencies` (everything is a devDependency), so the packaged app is
self-contained with just Electron + `src/` + `assets/`.

> No code signing is configured by default. To sign, set `CSC_LINK` / `CSC_KEY_PASSWORD`
> (or the platform equivalents) and add a `win`/`mac` identity block in the
> `build` config in `package.json`. Unsigned builds work but trigger OS warnings.

## Publishing via GitHub Actions

Tagging a release triggers `.github/workflows/release.yml`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds Windows (NSIS), macOS (dmg/zip) and Linux (AppImage/deb/rpm)
installers in parallel, uploads them as artifacts, and drafts a GitHub release
(softprops/action-gh-release) with auto-generated release notes. `GH_TOKEN` is
provided by the standard `GITHUB_TOKEN` secret.

### Release workflow details

- Matrix: `windows-latest --win`, `macos-latest --mac`, `ubuntu-latest --linux`.
- `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` disables accidental signing attempts in CI.
- Requires `contents: write` permission (already set in the workflow).

## Running from source in production

```bash
npm ci
npm start
```

Set `ELECTRON_DISABLE_SANDBOX=1` (or pass `--no-sandbox`) only on headless/container
Linux environments.

## Docker

A `Dockerfile` is provided for headless smoke verification of the analysis engine
inside a container. It installs the Linux sandbox dependencies, runs the Electron
smoke test under Xvfb, and is primarily a CI/verification aid rather than a
runtime image.

## Update strategy

- **App**: version lives in `package.json` (single source of truth). Bump it, update
  `CHANGELOG.md`, tag `v*`.
- **Electron**: currently pinned to latest (`electron@latest` in devDependencies).
  Electron releases are frequent; re-run `npm test` + `npm run smoke` after bumping,
  and update screenshots if the Chromium rendering changes.

## Checklist before a release

1. `npm run verify` is green.
2. `npm run screenshots` regenerated and committed if the UI changed.
3. `CHANGELOG.md` and `README.md` reflect the new version.
4. Tag `vX.Y.Z` and push — CI drafts the release.

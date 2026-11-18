# Setup guide (Windows)

Requirements: Node.js 24 (tested with v24.21.0) and npm 11. Each app is installed and started from its own folder.

## Customer app (Expo)

```powershell
cd C:\upgrowa-workspace\keygo\Customer
npm install            # first time only
npx expo start         # add --clear after changing config or assets
```

Open it with Expo Go on a phone, an emulator, or press `w` for the web preview.
Demo sign-in: `ananya.s@example.com` / `keygo123`.

Checks:

```powershell
npx tsc --noEmit
npx expo lint
```

### Android APK

```powershell
cd C:\upgrowa-workspace\keygo\Customer
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

The `preview` profile in `eas.json` produces an installable APK. App ID: `com.keygo.app` (placeholder).

## Admin portal (Next.js)

```powershell
cd C:\upgrowa-workspace\keygo\Admin
npm install            # first time only; .npmrc sets legacy-peer-deps
npm run dev            # http://localhost:3000
```

Demo sign-in: `owner@keygo.in` / `keygo123` (also `admin@`, `manager@`, `staff@keygo.in`).

Checks:

```powershell
npm run typecheck
npm run build
```

## Server

Not implemented yet. See `Server/README.md`.

## Notes

- Stop a dev server with `Ctrl+C` before moving or renaming its folder; Windows locks folders that are in use.
- On a slow connection, `npm install` may time out. Retry with
  `npm install --fetch-timeout=600000 --fetch-retries=5`.

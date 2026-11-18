# Folder structure

```text
keygo/
├── Customer/                 Expo customer app (own package.json, node_modules, configs)
│   ├── src/
│   │   ├── app/              Expo Router screens: (tabs)/, booking/, car/[id], rental/[id]/…, login, register, onboarding
│   │   ├── components/       home/ (hero, stats, showroom card, planner, entrance videos), kit/ (UI kit), ui/
│   │   ├── context/          AppContext (mock in-memory state)
│   │   ├── data/             mockData.ts, pricing.ts (temporary mock prices)
│   │   ├── services/         auth, workspace, mockClient — replace with API calls later
│   │   ├── lib/  hooks/  theme/  types/  constants/  assets/
│   ├── assets/               images/, videos/, expo.icon/
│   ├── scripts/              Python asset-processing scripts, reset-project.js (Expo template)
│   ├── app.json  eas.json  metro.config.js  eslint.config.js  tsconfig.json
│   └── package.json  package-lock.json  AGENTS.md  CLAUDE.md  README.md  .gitignore  .easignore
│
├── Admin/                    Next.js admin portal (own package.json, node_modules, configs)
│   ├── src/
│   │   ├── app/              Next.js routes: dashboard, fleet, bookings, customers, … , settings, login
│   │   ├── features/         One folder per sidebar section (tabs and forms)
│   │   ├── components/       kit/ (UI kit), portal/ (shell, sidebar, tabs), ui/
│   │   ├── config/           navigation.ts (sidebar sections, tabs, roles)
│   │   ├── services/         Mock services per section — replace with API calls later
│   │   ├── shims/            expo-router shim backed by next/navigation
│   │   ├── context/  data/  lib/  hooks/  theme/  types/
│   ├── public/               favicon, vehicle images
│   ├── next.config.mjs  tsconfig.json  .npmrc (legacy-peer-deps)
│   └── package.json  package-lock.json  AGENTS.md  .gitignore
│
├── Server/                   Planned NestJS backend (README only)
├── Documentation/            This documentation
├── .claude/  .vscode/        Editor and assistant settings
├── .gitignore  README.md  LICENSE
└── .pre-redesign-backup.zip  Snapshot of the source before the redesign
```

## Rules

- Each app installs and runs from its own folder. Never run `npm install` at the root.
- Customer imports only from `Customer/`, Admin only from `Admin/`. Assets are referenced with relative paths
  inside each app.
- Expo's native folders (`ios/`, `android/`) are generated and are not committed.

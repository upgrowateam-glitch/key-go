# KeyGo

Car rental platform: a customer mobile app, an admin web portal and a planned backend.

| Folder | What it is | Start it |
|---|---|---|
| [`Customer/`](Customer/) | Expo (React Native) customer app | `cd Customer` → `npx expo start` |
| [`Admin/`](Admin/) | Next.js admin portal | `cd Admin` → `npm run dev` → http://localhost:3000 |
| [`Server/`](Server/) | NestJS API (planned, not implemented) | — |
| [`Documentation/`](Documentation/) | Overview, folder structure, setup, proposed database and API | — |

Each app has its own `package.json`, dependencies and configuration. Install and run each one from its own folder;
there is nothing to install at the root.

Both frontends currently use mock data. Start with
[`Documentation/setup-guide.md`](Documentation/setup-guide.md) and
[`Documentation/project-overview.md`](Documentation/project-overview.md).

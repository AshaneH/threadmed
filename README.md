# ThreadMed

A literature synthesis workbench for evidence-based medicine. Import papers from Zotero, annotate with PICO codes, and build your synthesis matrix.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 18 | Tested with 20.x and 25.x |
| **Python** | ≥ 3.10 | Required by node-gyp to compile `better-sqlite3`. node-gyp v10+ supports 3.12+; if npm bundles an older node-gyp, install `node-gyp` globally |
| **C++ Build Tools** | VS 2022 | Windows only — install via Visual Studio Installer |
| **Windows SDK** | 10.0.22621+ | Included in "Desktop development with C++" workload |

### Windows Setup

1. Install [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. In the installer, check **"Desktop development with C++"** (includes Windows SDK)
3. Ensure Python 3 is installed and on your PATH

### macOS / Linux

```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential python3
```

## Getting Started

```bash
# Clone the repo
git clone https://github.com/AshaneH/threadmed.git
cd threadmed

# Install dependencies (skip native compilation initially)
npm install --ignore-scripts

# Download the Electron binary
node node_modules/electron/install.js

# Compile better-sqlite3 for Electron
npx node-gyp rebuild \
  --directory node_modules/better-sqlite3 \
  --runtime=electron \
  --target=$(node -p "require('./node_modules/electron/package.json').version") \
  --dist-url=https://electronjs.org/headers

# Start development
npm run dev
```

> **Why `--ignore-scripts`?** npm's bundled node-gyp (v9) may not support newer Python versions. Using the global `node-gyp` (v10+) directly avoids this. The `rebuild` npm script automates the manual step above.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Electron + Vite dev server with hot reload |
| `npm run build` | Production build (main + preload + renderer) |
| `npm run start` | Preview production build |
| `npm run rebuild` | Recompile better-sqlite3 for Electron |
| `npm run typecheck` | Run TypeScript checks on both node and web configs |

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── database/
│   │   ├── connection.ts  # SQLite connection (WAL mode, pragmas)
│   │   ├── schema.ts      # Table definitions + EBM node seeding
│   │   ├── fts.ts         # FTS5 virtual table + sync triggers
│   │   └── repositories/  # Data access layer
│   │       ├── papers.ts
│   │       ├── nodes.ts
│   │       └── annotations.ts
│   ├── ipc/handlers.ts    # IPC channel handlers
│   ├── services/pdf-namer.ts
│   └── index.ts           # App entry point
├── preload/
│   ├── index.ts           # Context bridge (typed API)
│   └── index.d.ts         # window.api type declarations
└── renderer/
    ├── index.html
    └── src/
        ├── App.tsx
        ├── app.css          # Design tokens (dark/light themes)
        ├── context/ThemeContext.tsx
        ├── components/
        │   ├── layout/      # AppShell, Sidebar, StatusBar
        │   └── views/       # LibraryView, SettingsView
        ├── hooks/useIpc.ts
        ├── lib/utils.ts     # cn() class merge utility
        └── types/index.ts   # Shared TypeScript interfaces
```

## Tech Stack

- **Runtime**: Electron 33 (Chromium + Node 20)
- **Frontend**: React 18, TypeScript 5, Tailwind CSS 4
- **Database**: SQLite via better-sqlite3 (WAL mode, FTS5)
- **Build**: electron-vite, Vite 6
- **UI**: Shadcn-style components, lucide-react icons, react-resizable-panels

## License

MIT — see [LICENSE](./LICENSE)

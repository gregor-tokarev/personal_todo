# AGENTS.md

## Build/Lint/Test Commands
- **Install deps**: `npm ci` (workspace-aware, installs all packages)
- **Build all**: `npm run build` (Turbo orchestrates all workspace builds)
- **Dev server**: `npm run dev` (starts all services in development mode)
- **Type check**: `npm run type-check` (Vue app: `vue-tsc`, backend: `tsc`)
- **Lint**: `npm run lint` (uses Prettier + Tailwind plugin)
- **Run single test**: `npx vitest run path/to/file.test.ts` (add Vitest to sync-client first)
- **Backend migrations**: `npm run migrations:gen` && `npm run migrations:push`

## Code Style Guidelines
- **Imports**: Group third-party, internal workspace, and relative imports with blank lines
- **Formatting**: Prettier with Tailwind plugin, 2-space indentation, single quotes, trailing commas
- **Types**: Explicit TypeScript types, avoid `any`, use `Record<string, unknown>` for generic objects
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for constants
- **Error handling**: Wrap async DB/network calls in try/catch, use custom error classes, log with Sentry
- **Async patterns**: Prefer `await` over fire-and-forget IIFEs, ensure errors are caught
- **Vue**: Use `<script setup lang="ts">`, Composition API, Pinia for state management
- **Backend**: tRPC for type-safe APIs, Drizzle ORM, Lucia for auth
- **Sync protocol**: Always include `protocolVersion` in payloads, reject mismatches with errors

## Notes
- Monorepo with Turbo for orchestration
- No existing Cursor/Copilot rules found
- Sync-client needs test framework setup (Vitest recommended)
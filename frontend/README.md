# TaskPilot frontend

Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui and TanStack Query.
See the [root README](../README.md) for setup and the [spec](../docs/TASKPILOT_SPEC.md) for details.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` |
| `npm test` | Vitest + Testing Library |
| `npm run gen:api` | Regenerate `src/lib/api/schema.d.ts` from the running backend's OpenAPI schema |
| `npm run format` | Prettier |

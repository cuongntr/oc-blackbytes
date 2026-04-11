# AGENTS.md — oc-blackbytes

## Project

Single-file OpenCode plugin. Entry point: `src/index.ts` → `dist/index.js`.

## Commands

```
bun test          # run tests
bun run build     # compile src/index.ts → dist/index.js
bun run check     # lint + format check (Biome)
bun run lint      # lint only
bun run format    # format and fix
```

Linting and formatting use Biome. Run `bun run check` before committing.

## Architecture

- `src/index.ts` is the only source file. Exports `MyPlugin` (named + default).
- Plugin factory receives `{ client, directory, worktree }` and returns hook implementations.
- Current hooks: `shell.env` (injects env vars), `event` (logs events via `client.app.log`).

## Important

- Types are imported from `@opencode-ai/plugin` (`Plugin`, `Hooks`, `PluginInput`).
- No `tsconfig.json`. Bun transpiles TypeScript natively via `bun build`.
- Tests use `bun:test`. Mock the `client.app.log` function; cast mock context with `as any` since full SDK types are complex.
- `dist/` is a build artifact — do not edit directly.

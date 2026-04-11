# oc-blackbytes

An OpenCode plugin tailored to streamline my everyday workflow.

## Develop

```bash
bun test
bun run build
```

## Local consumer test

Point an OpenCode project at this package path in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/oc-blackbytes"]
}
```

Then verify it loads:

```bash
opencode debug config
```

## Publish

Before publishing, ensure `version` is bumped appropriately.

```bash
bun run build
npm publish
```

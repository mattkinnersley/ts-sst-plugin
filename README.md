<h1 align="center">TypeScript SST Plugin</h1>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b6099257-62ae-4bc3-82f7-6a2e39477954" alt="animated" />
</p>

# What is this?

This is a TypeScript plugin for [SST](https://sst.dev/) that enables ['Go to Definition'](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_definition) for your SST config.

# How does it work?

It works by finding any instance of certain path targets in your config files and finds the definition from that path in your codebase. The current targets are:
- `handler: 'path/to/function.handler'`
- `.subscribe('path/to/dynamodb/subscriber')`
- `path: 'path/to/web/app/root'` (jumps to package.json)

# How do I use it?

1. Install the plugin

```bash
npm i -D ts-sst-plugin
```

2. Configure the plugin in your `tsconfig.json`

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "ts-sst-plugin" }]
  }
}
```

3. If your are using VS Code, configure it to use your workspace TypeScript version.

`Cmd + Shift + p` -> `TypeScript: Select TypeScript Version...` -> `Use Workspace Version`

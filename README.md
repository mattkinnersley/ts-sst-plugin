<h1 align="center">TypeScript SST Plugin</h1>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b6099257-62ae-4bc3-82f7-6a2e39477954" alt="animated" />
</p>

# What is this?

This is a TypeScript plugin for [SST](https://sst.dev/) that enables certain Language Service features for SST configs that TypeScript cannot do natively. This plugin enables the following features:

- [Go to Definition](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_definition) and [Diagnostics](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic) for function handlers, subscribers and front end apps.

# How does it work?

It works by finding any instance of certain path targets in your config files and finds the definition from that path in your codebase. The current targets are:

- `handler: 'path/to/function.handler'` (looks for `.ts` and `.js` files)
- `.subscribe('path/to/subscriber')` (looks for `.ts` and `.js` files)
- `path: 'path/to/app/root'` (jumps to package.json)

The nature of these targets means it works for a number of different SST components such as `Function`, `Cron`, `StaticSite`, `dynamo.subscribe()`, `bus.subscribe()` and more.

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

## Configuration

You can configure this plugin in your `tsconfig.json`. For now, the only configuration is the diagnostic category of the `check-paths` rule which you can configure like so:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "ts-sst-plugin", "rules": { "check-paths": <number> } }]
  }
}
```

Provide the number that corresponds to the category of diagnostic you wish to use:

```ts
enum DiagnosticCategory {
  Warning = 0,
  Error = 1,
  Suggestion = 2,
  Message = 3,
}
```

As a general rule, `Warning` underlines the path in yellow, `Error` underlines it in red, `Suggestion` underlines it with an ellipses and `Message` seems to do the same thing as `Error`.

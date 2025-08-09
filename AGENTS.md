This is a monorepo for Folders.io protocol providers. Each provider is a package in the `packages/` directory.

When adding a new provider, please follow these steps:

1.  Create a new directory for your provider under `packages/`.
2.  Your package should have its own `package.json` file.
3.  The main source file should be in `src/` and named `folders-<protocol>.js`.
4.  The code should be written in modern JavaScript with ESM syntax (`import`/`export`).
5.  Use Zod to validate the options passed to your provider's constructor.
6.  Add tests for your provider in the `src/test/` directory.
7.  Ensure all dependencies are listed in your `package.json`.
8.  Run `yarn install` from the root directory to install all dependencies.

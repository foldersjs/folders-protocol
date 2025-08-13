# Undone Work and Technical Debt

This document outlines the current state of the codebase and provides a list of tasks that need to be completed to bring the project up to modern standards.

## Systemic Issues

The codebase is a monorepo created by merging several older projects. While a significant effort has been made to modernize the codebase, some issues remain.

- **DONE: Outdated Dependencies:** All external dependencies have been updated to their latest stable versions across all packages.
- **DONE: Lack of Tests:** Test suites have been added for all major packages (`folders-http`, `folders-presto`, `folders-hive`, `folders-hdfs`).
- **DONE: Outdated JavaScript:** All major packages (`folders-ftp`, `folders-http`, `folders-hive`, `folders-presto`) have been refactored to use modern JavaScript (async/await, ES6 classes, etc.).
- **DONE: Missing Input Validation:** All packages now use Zod for input validation.
- **DONE: Inconsistent Code Style:** Prettier has been added and run across the codebase to enforce a consistent style.
- **PARTIALLY DONE: Leftover Debugging Code:** A significant number of `console.log` statements and `FIXME`/`TODO` comments have been removed or addressed. However, some still remain in less critical packages.
- **DONE: Inconsistent Error Handling:** Error handling has been standardized on throwing exceptions and using async/await in all major packages.

## Recommended Actions

All major packages have been modernized. Future work should focus on the remaining smaller packages and addressing the known issues below.

## Testing

The packages use the built-in Node.js test runner. To run the tests for a specific package, use the command `yarn workspace <package-name> test`. To run all primary test suites, use `yarn test`.

## Known Issues

- **`webhdfs-proxy` in `folders-hdfs`:** The `webhdfs-proxy` package used in `folders-hdfs` for testing appears to have issues with cleanly shutting down its server. This results in `ERR_HTTP_HEADERS_SENT` errors after the test suite for `folders-hdfs` completes. The tests themselves pass, but this indicates a resource leak that should be addressed in the future.
- **PARTIALLY DONE: Insecure Key in `folders-http`**: The `folders-http` package has been refactored to include stream encryption and a handshake protocol to establish a shared secret. However, the implementation is currently blocked by a dependency issue in the `folders` package.
- **Dependency Issue in `folders` package**: The `folders` package (v0.0.7) has a missing dependency on `json-stringify-safe`. This causes tests to fail in the `folders-http` package. This issue needs to be resolved in the `folders` package itself. We will return to this task when a new version of the dependency is available.

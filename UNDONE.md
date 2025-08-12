# Undone Work and Technical Debt

This document outlines the current state of the codebase and provides a list of tasks that need to be completed to bring the project up to modern standards.

## Systemic Issues

The codebase is a monorepo created by merging several older projects. While a significant effort has been made to modernize the codebase, some issues remain.

- **DONE: Outdated Dependencies:** All external dependencies have been updated to their latest stable versions across all packages.
- **Lack of Tests:** While most packages have a basic test setup, the test coverage is not comprehensive. This makes it difficult to refactor the code with confidence.
- **PARTIALLY DONE: Outdated JavaScript:** The `folders-ftp` package has been refactored to use modern JavaScript (async/await). However, many other packages (`folders-http`, `folders-hive`, etc.) still use an old style of JavaScript, with `var` instead of `let`/`const`, and prototype-based classes instead of ES6 classes.
- **DONE: Missing Input Validation:** All packages now use Zod for input validation.
- **DONE: Inconsistent Code Style:** Prettier has been added and run across the codebase to enforce a consistent style.
- **PARTIALLY DONE: Leftover Debugging Code:** A significant number of `console.log` statements and `FIXME`/`TODO` comments have been removed or addressed. However, some still remain.
- **Inconsistent Error Handling:** Error handling is inconsistent, with a mix of callbacks and thrown exceptions. The refactoring of `folders-ftp` is a step towards standardization.

## Recommended Actions

To address these issues, the following actions should be taken for each package:

1.  **Refactor to Modern JavaScript:** Refactor the remaining packages (e.g., `folders-http`, `folders-hive`) to use modern JavaScript features, including ES6 classes, `let`/`const`, arrow functions, and async/await.
2.  **Add Tests:** Add a comprehensive test suite for each package. Use a modern testing framework like Jest or Mocha.
3.  **Standardize Error Handling:** Use a consistent error handling strategy, such as throwing exceptions.
4.  **Continue Code Cleanup:** Remove the remaining `console.log` statements and address the remaining `FIXME`/`TODO` comments.

## Testing

The `folders-ftp` package uses the built-in Node.js test runner. To run the tests, use the command `yarn workspace folders-ftp test`.

## Known Issues

- **`webhdfs-proxy` in `folders-hdfs`:** The `webhdfs-proxy` package used in `folders-hdfs` for testing appears to have issues with cleanly shutting down its server. This results in `ERR_HTTP_HEADERS_SENT` errors after the test suite for `folders-hdfs` completes. The tests themselves pass, but this indicates a resource leak that should be addressed in the future, possibly by replacing `webhdfs-proxy` with a more modern alternative if one becomes available.
- **`presto-client` in `folders-presto`:** The `presto-client` library is callback-based. Attempts to promisify it for use with async/await and to mock it for unit tests have been unsuccessful, leading to "callback not specified" errors. This package needs further work to be properly tested.
- **`stream-nacl.js` in `folders-http`**: The `stream-nacl.js` utility has a `FIXME` comment indicating that it needs a real key and nonce. This is a security risk that should be addressed.

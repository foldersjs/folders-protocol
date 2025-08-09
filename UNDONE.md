# Undone Work and Technical Debt

This document outlines the current state of the codebase and provides a list of tasks that need to be completed to bring the project up to modern standards.

## Systemic Issues

The codebase is a monorepo created by merging several older projects. While this is a good starting point, many of the packages have not been updated to modern standards. The following issues are present in most of the packages:

*   **Outdated Dependencies:** Most packages use very old versions of their dependencies, specified with loose version ranges (e.g., `2.x.x`). This is a significant security risk and makes the project difficult to maintain.
*   **Lack of Tests:** There are no tests for most of the packages. This makes it impossible to refactor the code with confidence.
*   **Outdated JavaScript:** The code is written in an old style of JavaScript, using `var` instead of `let`/`const`, and prototype-based classes instead of ES6 classes. This makes the code harder to read and maintain.
*   **Missing Input Validation:** The `AGENTS.md` file specifies that Zod should be used for input validation, but this is not done in any of the packages.
*   **Inconsistent Code Style:** The code style is inconsistent across the packages.
*   **Leftover Debugging Code:** There are many `console.log` statements and `FIXME`/`TODO` comments scattered throughout the code.
*   **Inconsistent Error Handling:** Error handling is inconsistent, with a mix of callbacks and thrown exceptions.

## Recommended Actions

To address these issues, the following actions should be taken for each package:

1.  **Update Dependencies:** Update all dependencies to their latest stable versions. Use `yarn upgrade-interactive --latest` to make this easier.
2.  **Add Tests:** Add a comprehensive test suite for each package. Use a modern testing framework like Jest or Mocha.
3.  **Refactor to Modern JavaScript:** Refactor the code to use modern JavaScript features, including ES6 classes, `let`/`const`, arrow functions, and async/await.
4.  **Add Zod Validation:** Use Zod to validate the options passed to each provider.
5.  **Standardize Code Style:** Use a tool like Prettier to enforce a consistent code style across the project.
6.  **Clean Up Code:** Remove all `console.log` statements and address all `FIXME`/`TODO` comments.
7.  **Standardize Error Handling:** Use a consistent error handling strategy, such as throwing exceptions or using a standard callback format (`(err, result)`).

As a starting point, the `folders-ftp` package has been refactored to follow these guidelines. This can be used as a template for updating the other packages.

## Testing

The `folders-ftp` package uses the built-in Node.js test runner. To run the tests, use the command `yarn workspace folders-ftp test`.

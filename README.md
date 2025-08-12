# folders-protocol

This monorepo contains a collection of providers for the Folders.io protocol, offering a unified API for interacting with various storage and data backends. Each provider is a separate package located in the `packages/` directory.

The project is currently undergoing a modernization effort to update the codebase to modern JavaScript standards, improve testing, and ensure consistency across all providers.

## Available Providers

The following providers are available:

- `folders-aws`: For interacting with AWS services.
- `folders-ftp`: For interacting with FTP servers.
- `folders-gulp`: For using Gulp tasks as a source.
- `folders-hdfs`: For interacting with HDFS.
- `folders-hive`: For querying Hive databases.
- `folders-http`: For making HTTP requests.
- `folders-ldap`: For interacting with LDAP directories.
- `folders-presto`: For querying Presto databases.
- `folders-s3`: For interacting with AWS S3.
- `folders-ssh`: For interacting with servers over SSH/SFTP.

## Project Status

The following packages have been updated to modern standards, including up-to-date dependencies, comprehensive tests, and modern JavaScript syntax:

- `folders-aws`
- `folders-ftp`
- `folders-s3`
- `folders-ssh`

The remaining packages are still in the process of being updated. For more details on the modernization effort, known issues, and the project roadmap, please see the [UNDONE.md](UNDONE.md) file.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS version)
- [Yarn](https://yarnpkg.com/) (v4 or later)

### Installation

1.  Clone the repository:

    ```sh
    git clone https://github.com/foldersjs/folders-protocol.git
    cd folders-protocol
    ```

2.  Install the dependencies:
    ```sh
    yarn install
    ```

### Running Tests

To run the tests for a specific package, use the following command:

```sh
yarn workspace <package-name> test
```

For example, to run the tests for the `folders-ftp` package:

```sh
yarn workspace folders-ftp test
```

## Contributing

We welcome contributions! If you would like to contribute a new provider or help with the modernization effort, please read the [AGENTS.md](AGENTS.md) file for guidelines on how to get started.

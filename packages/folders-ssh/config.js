const Config = {};

Config.prefix = 'prefix';
Config.server = {};
Config.client = {};

// Server key
Config.server.debug = true;
Config.server.privateKeyPath = null;
Config.server.privateKey = process.env.SSH_SERVER_PRIVATE_KEY;

// client Configuration

Config.client.privateKeyPath = null;
Config.client.publickKeyPath = null;
Config.client.privateKey = process.env.SSH_CLIENT_PRIVATE_KEY;
Config.client.publicKey = process.env.SSH_CLIENT_PUBLIC_KEY;
Config.client.username = process.env.SSH_CLIENT_USERNAME || 'root';
Config.client.password = process.env.SSH_CLIENT_PASSWORD || 'pass';

export default Config;

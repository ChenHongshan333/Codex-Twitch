import { startServer } from '../server.mjs';

// Separate opt-in process. It never exposes persona minting on a public origin.
startServer({ host: '127.0.0.1', port: Number(process.env.SANDBOX_PORT || 3010), sandboxEnabled: true, publicOrigin: '' });

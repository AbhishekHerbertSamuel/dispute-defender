import { existsSync } from 'node:fs';
import { createApp } from './server.ts';
if (existsSync('.env'))
    process.loadEnvFile('.env');
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid PORT.');
const { server } = createApp();
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Dispute Defender: http://${process.env.HOST || '127.0.0.1'}:${port} (${process.env.APP_MODE || 'demo'})`));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => server.close(() => process.exit(0)));

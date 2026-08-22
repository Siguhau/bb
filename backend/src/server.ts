import 'dotenv/config';

import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const app = createApp();
const server = app.listen(port, () => {
  console.info(`Backend listening on port ${port}`);
});

function shutDown(signal: NodeJS.Signals): void {
  server.close((error) => {
    if (error) {
      console.error(`Failed to close server after ${signal}.`, error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutDown('SIGINT'));
process.once('SIGTERM', () => shutDown('SIGTERM'));

import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();

  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3000);

  try {
    await app.listen({ host, port });
    console.log(`Server läuft auf http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

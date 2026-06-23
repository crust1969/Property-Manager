import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { getDatabase, closeDatabase, runMigrations, seedCategories } from '../database/index.js';
import type Database from 'better-sqlite3';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

/**
 * Fastify plugin that initializes the SQLite database,
 * runs pending migrations, and seeds default categories.
 */
async function databasePlugin(fastify: FastifyInstance): Promise<void> {
  const db = getDatabase();

  // Run all pending migrations
  runMigrations(db);

  // Seed standard categories
  seedCategories(db);

  // Decorate fastify instance with db
  fastify.decorate('db', db);

  // Close database on server shutdown
  fastify.addHook('onClose', () => {
    closeDatabase();
  });
}

export const databasePluginRegistration = fp(databasePlugin, {
  name: 'database',
});

import Database from '@tauri-apps/plugin-sql';
import type { DatabaseAdapter } from '@/db/repository';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:tasky.db');
  }
  return db;
}

export function createAdapter(database: Database): DatabaseAdapter {
  return {
    async execute(sql: string, params?: unknown[]): Promise<void> {
      await database.execute(sql, params as unknown[]);
    },
    async select<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return database.select<T[]>(sql, params as unknown[]) as unknown as T[];
    },
  };
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// mysql2's export map omits types for './promise' under this tsconfig.
const mysql = require('mysql2/promise') as {
  createPool: (options: Record<string, unknown>) => NewsPool;
};

type NewsPool = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], unknown]>;
  getConnection: () => Promise<NewsConnection>;
  end: () => Promise<void>;
};

type NewsConnection = {
  query: (sql: string, params?: unknown[]) => Promise<[any[], unknown]>;
  release: () => void;
};

export type NewsLocale = 'es' | 'en';

@Injectable()
export class NewsMysqlService implements OnModuleDestroy {
  private readonly pools = new Map<NewsLocale, NewsPool>();

  constructor(private readonly config: ConfigService) {}

  locale(value?: string): NewsLocale {
    return String(value || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
  }

  async query<T>(locale: NewsLocale, sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const [rows] = await this.pool(locale).query(sql, params);
      return rows as T[];
    } catch (error) {
      if (locale === 'en') return [];
      throw error;
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
  }

  private pool(locale: NewsLocale) {
    const current = this.pools.get(locale);
    if (current) return current;

    const database =
      locale === 'en'
        ? this.config.get<string>('NEWS_MYSQL_DATABASE_EN') || 'musicmundial_en'
        : this.config.get<string>('NEWS_MYSQL_DATABASE_ES') || 'musicmundial_es';

    const pool = mysql.createPool({
      host: this.config.get<string>('NEWS_MYSQL_HOST') || '127.0.0.1',
      port: Number(this.config.get('NEWS_MYSQL_PORT') || 3306),
      user: this.config.get<string>('NEWS_MYSQL_USER') || 'root',
      password: this.config.get<string>('NEWS_MYSQL_PASSWORD') ?? 'password',
      database,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 8,
    });
    this.pools.set(locale, pool);
    return pool;
  }
}

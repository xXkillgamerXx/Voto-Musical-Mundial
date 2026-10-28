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

type LocaleMysql = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  prefix: string;
};

@Injectable()
export class NewsMysqlService implements OnModuleDestroy {
  private readonly pools = new Map<NewsLocale, NewsPool>();

  constructor(private readonly config: ConfigService) {}

  locale(value?: string): NewsLocale {
    return String(value || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
  }

  async query<T>(locale: NewsLocale, sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const [rows] = await this.pool(locale).query(this.withPrefix(locale, sql), params);
      return rows as T[];
    } catch (error) {
      if (locale === 'en') return [];
      throw error;
    }
  }

  async exec(locale: NewsLocale, sql: string, params: unknown[] = []): Promise<{ insertId: number; affectedRows: number }> {
    const [result] = await this.pool(locale).query(this.withPrefix(locale, sql), params);
    const header = result as { insertId?: number; affectedRows?: number };
    return {
      insertId: Number(header.insertId || 0),
      affectedRows: Number(header.affectedRows || 0),
    };
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((pool) => pool.end()));
  }

  private withPrefix(locale: NewsLocale, sql: string) {
    const prefix = this.settings(locale).prefix;
    if (!prefix || prefix === 'wpgn_') return sql;
    return sql.replace(/wpgn_/g, prefix);
  }

  private settings(locale: NewsLocale): LocaleMysql {
    const host = this.config.get<string>('NEWS_MYSQL_HOST') || '127.0.0.1';
    const port = Number(this.config.get('NEWS_MYSQL_PORT') || 3306);
    if (locale === 'en') {
      return {
        host,
        port,
        user:
          this.config.get<string>('NEWS_MYSQL_USER_EN') ||
          this.config.get<string>('NEWS_MYSQL_USER') ||
          'root',
        password:
          this.config.get<string>('NEWS_MYSQL_PASSWORD_EN') ??
          this.config.get<string>('NEWS_MYSQL_PASSWORD') ??
          'password',
        database: this.config.get<string>('NEWS_MYSQL_DATABASE_EN') || 'musicmundial_en',
        prefix: this.config.get<string>('NEWS_MYSQL_PREFIX_EN') || 'wpgn_',
      };
    }
    return {
      host,
      port,
      user:
        this.config.get<string>('NEWS_MYSQL_USER_ES') ||
        this.config.get<string>('NEWS_MYSQL_USER') ||
        'root',
      password:
        this.config.get<string>('NEWS_MYSQL_PASSWORD_ES') ??
        this.config.get<string>('NEWS_MYSQL_PASSWORD') ??
        'password',
      database: this.config.get<string>('NEWS_MYSQL_DATABASE_ES') || 'musicmundial_es',
      prefix: this.config.get<string>('NEWS_MYSQL_PREFIX_ES') || 'wpgn_',
    };
  }

  private pool(locale: NewsLocale) {
    const current = this.pools.get(locale);
    if (current) return current;

    const cfg = this.settings(locale);
    const pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 8,
    });
    this.pools.set(locale, pool);
    return pool;
  }
}

import mysql, { type Pool } from 'mysql2/promise';

const globalForMysql = globalThis as typeof globalThis & { mysqlPool?: Pool };

export const pool = globalForMysql.mysqlPool ?? mysql.createPool({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'event_app',
  password: process.env.MYSQL_PASSWORD ?? 'local_app_password',
  database: process.env.MYSQL_DATABASE ?? 'event_ticket_reservation',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: 'Z',
});

if (process.env.NODE_ENV !== 'production') globalForMysql.mysqlPool = pool;

import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';

const sql = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'event_app', password: process.env.MYSQL_PASSWORD ?? 'local_app_password',
  database: process.env.MYSQL_DATABASE ?? 'event_ticket_reservation',
});
const mongo = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://event_app:local_mongo_password@127.0.0.1:27017/?authSource=event_ticket_reservation');
try {
  await sql.query('SELECT 1');
  await mongo.connect();
  await mongo.db(process.env.MONGODB_DATABASE ?? 'event_ticket_reservation').command({ ping: 1 });
  console.log('MySQL and MongoDB are reachable. Schema and starter records are loaded by compose.yaml.');
} finally {
  await sql.end();
  await mongo.close();
}

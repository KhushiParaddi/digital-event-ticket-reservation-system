import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';

const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'AdminDemo2026!';
const customerPassword = process.env.DEMO_CUSTOMER_PASSWORD ?? 'CustomerDemo2026!';
const sql = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'event_app', password: process.env.MYSQL_PASSWORD ?? 'local_app_password',
  database: process.env.MYSQL_DATABASE ?? 'event_ticket_reservation',
});
const mongo = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://event_app:local_mongo_password@127.0.0.1:27017/?authSource=event_ticket_reservation');
function embed(text) {
  const vector=Array.from({length:64},()=>0);
  for(const token of text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]){let hash=2166136261;for(let i=0;i<token.length;i++)hash=Math.imul(hash^token.charCodeAt(i),16777619);vector[(hash>>>0)%64]+=(hash&1)===0?1:-1;}
  const norm=Math.sqrt(vector.reduce((sum,value)=>sum+value*value,0))||1;return vector.map(value=>value/norm);
}

try {
  const adminHash=await bcrypt.hash(adminPassword,12);
  const customerHash=await bcrypt.hash(customerPassword,12);
  await sql.execute("UPDATE Users SET password_hash=?,role='ADMIN' WHERE email='aarav@example.com'",[adminHash]);
  await sql.execute("UPDATE Users SET password_hash=?,role='CUSTOMER' WHERE email<>'aarav@example.com'",[customerHash]);
  await mongo.connect();
  const collection=mongo.db(process.env.MONGODB_DATABASE??'event_ticket_reservation').collection('event_content');
  await collection.createIndex({eventId:1},{unique:true});
  await collection.createIndex({published:1,updatedAt:-1});
  const docs=[
    {eventId:1,title:'Monsoon Indie Night',description:'An open-air evening with independent bands, new sounds, and local food under the monsoon sky.',tags:['music','indie','live','outdoor'],published:true},
    {eventId:2,title:'Design Futures Summit',description:'A full day of talks and workshops about product design, accessibility, and emerging technology.',tags:['design','conference','technology','workshop'],published:true},
    {eventId:3,title:'Chennai Laugh Festival',description:'A lively stand-up comedy night featuring fresh performers and crowd favourites.',tags:['comedy','stand-up','live','arts'],published:true},
    {eventId:4,title:'Kolkata Food and Music Fair',description:'Explore local street food, live music, and cultural performances across a weekend festival.',tags:['food','festival','music','culture'],published:true},
    {eventId:5,title:'Pune Jazz Weekend',description:'Two days of jazz sets, improvisation, and late-night lounge performances.',tags:['jazz','music','live','weekend'],published:true},
  ];
  for(const doc of docs)await collection.updateOne({eventId:doc.eventId},{$set:{...doc,vector:embed(`${doc.title} ${doc.description} ${doc.tags.join(' ')}`),updatedAt:new Date()}},{upsert:true});
  console.log('Demo accounts hashed and MongoDB event content seeded.');
} finally { await sql.end(); await mongo.close(); }

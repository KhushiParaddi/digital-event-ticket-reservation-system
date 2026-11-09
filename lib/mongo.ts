import { MongoClient, type Collection, type Db } from 'mongodb';

export interface EventContent {
  eventId: number;
  title: string;
  description: string;
  tags: string[];
  published: boolean;
  vector: number[];
  updatedAt: Date;
}

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

export async function eventContent(): Promise<Collection<EventContent>> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://event_app:local_mongo_password@127.0.0.1:27017/?authSource=admin';
  const client = await (globalForMongo.mongoClientPromise ?? createClient(uri));
  const db: Db = client.db(process.env.MONGODB_DATABASE ?? 'event_ticket_reservation');
  const collection = db.collection<EventContent>('event_content');
  await collection.createIndex({ eventId: 1 }, { unique: true });
  await collection.createIndex({ published: 1, updatedAt: -1 });
  return collection;
}

async function createClient(uri: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const promise = client.connect();
  globalForMongo.mongoClientPromise = promise;
  promise.catch(() => {
    if (globalForMongo.mongoClientPromise === promise) globalForMongo.mongoClientPromise = undefined;
  });
  return promise;
}

// Deterministic 64-dimensional token vectors make local semantic recommendations
  // possible without shipping private event text to an external embedding service.
export function embedText(text: string): number[] {
  const vector = Array.from({ length: 64 }, () => 0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) hash = Math.imul(hash ^ token.charCodeAt(i), 16777619);
    const slot = (hash >>> 0) % vector.length;
    vector[slot] += (hash & 1) === 0 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

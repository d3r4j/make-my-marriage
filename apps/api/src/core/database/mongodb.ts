import { MongoClient, type Db } from 'mongodb';

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDatabase(): Promise<Db> {
  if (database) return database;

  const mongoClient = getMongoClient();
  await mongoClient.connect();
  database = mongoClient.db(process.env['MONGODB_DATABASE'] || undefined);

  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection('sessions').createIndex({ userId: 1 }),
    database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('auth_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    database.collection('auth_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('auth_tokens').createIndex({ userId: 1, purpose: 1 }),
    database.collection('weddings').createIndex({ publicSlug: 1 }, { unique: true }),
    database.collection('wedding_memberships').createIndex({ userId: 1, weddingId: 1 }, { unique: true }),
    database.collection('websites').createIndex({ weddingId: 1 }, { unique: true }),
    database.collection('qr_codes').createIndex({ tokenHash: 1 }, { unique: true }),
  ]);

  return database;
}

export function getMongoClient(): MongoClient {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MongoDB is not configured. Set MONGODB_URI.');

  client ??= new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  return client;
}

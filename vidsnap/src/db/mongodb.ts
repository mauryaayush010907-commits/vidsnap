import { MongoClient, Db, Collection } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.DATABASE_URL ?? process.env.MONGODB_URI ?? "";
const MONGODB_DB = process.env.MONGODB_DB ?? "videosnap";

if (!MONGODB_URI) {
  throw new Error(
    "DATABASE_URL / MONGODB_URI is not defined. Set it in your environment."
  );
}

export interface Contact {
  _id?: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function connectToDatabase(): Promise<{
  client: MongoClient;
  db: Db;
  contacts: Collection<Contact>;
}> {
  try {
    // Use cached connection if available
    if (cachedClient && cachedDb) {
      console.log("Using cached MongoDB connection");

      return {
        client: cachedClient,
        db: cachedDb,
        contacts: cachedDb.collection<Contact>("contacts"),
      };
    }

    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();

    const db = client.db(MONGODB_DB);
    const contacts = db.collection<Contact>("contacts");

    // Create indexes
    await contacts.createIndex({ createdAt: 1 });
    await contacts.createIndex({ email: 1 });

    // Cache connection
    cachedClient = client;
    cachedDb = db;

    return {
      client,
      db,
      contacts,
    };
  } catch (error) {
    console.error("=================================");
    console.error("MONGODB CONNECTION ERROR");
    console.error(error);
    console.error("=================================");

    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    if (cachedClient) {
      await cachedClient.close();

      cachedClient = null;
      cachedDb = null;

      console.log("MongoDB connection closed");
    }
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
  }
}
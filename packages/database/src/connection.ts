import mongoose from "mongoose";

export interface MongoOptions {
  uri: string;
  dbName?: string;
}

/**
 * Creates a mongoose connection. Reuses connection where possible. `dbName`
 * lets the license platform and customer platform target separate databases.
 */
export async function connectMongo(options: MongoOptions): Promise<mongoose.Connection> {
  const mongooseInstance = new mongoose.Mongoose();
  await mongooseInstance.connect(options.uri, {
    dbName: options.dbName,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 20,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
  });
  return mongooseInstance.connection;
}

export function isConnected(connection: mongoose.Connection | null | undefined): boolean {
  return !!connection && connection.readyState === 1;
}

/**
 * Runs `fn` inside a MongoDB transaction session (replica set required).
 * Falls back to running WITHOUT a transaction on standalone deployments.
 */
export async function withTransaction<T>(
  connection: mongoose.Connection,
  fn: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  if (!connection || connection.readyState !== 1) {
    throw new Error("MongoDB not connected");
  }
  const session = await connection.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
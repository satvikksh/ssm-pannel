import mongoose from "mongoose";

/**
 * Returns an existing registered model or creates a new one. Avoids the
 * "OverwriteModelError" when modules hot-reload in development.
 */
export function getModel<T extends mongoose.Schema = mongoose.Schema>(
  name: string,
  schema: T,
  collection?: string,
): mongoose.Model<any> {
  if (mongoose.models[name]) return mongoose.models[name] as mongoose.Model<any>;
  return mongoose.model(name, schema, collection);
}

export { mongoose };
import mongoose from "mongoose";

import { env } from "./env";

export const connectMongo = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  return mongoose.connection;
};

import mongoose, { Schema, type HydratedDocument } from "mongoose";

export type IUser = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isPaid: boolean;
  createdAt: Date;
};

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  avatarUrl: { type: String },
  isPaid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model<IUser>("User", userSchema);

export default User;

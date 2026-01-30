import mongoose, { Schema, type HydratedDocument } from "mongoose";
import type { ProductId } from "../config/products";

export type ISubscription = {
  userId: mongoose.Types.ObjectId;
  productId: ProductId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  createdAt: Date;
};

export type SubscriptionDocument = HydratedDocument<ISubscription>;

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  productId: { type: String, required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

subscriptionSchema.index({ userId: 1, productId: 1 });

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;

import mongoose, { Schema, type HydratedDocument } from "mongoose";
import type { ProductId } from "../config/products";

/** Default validity in days for new subscriptions (purchase or admin grant). */
export const SUBSCRIPTION_VALIDITY_DAYS = 30;

export type ISubscription = {
  userId: mongoose.Types.ObjectId;
  productId: ProductId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  /** Until when the subscription is valid. Omitted for legacy subscriptions (treated as no expiry). */
  validUntil?: Date;
};

export type SubscriptionDocument = HydratedDocument<ISubscription>;

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  productId: { type: String, required: true },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
  createdAt: { type: Date, default: Date.now },
  validUntil: { type: Date }
});

subscriptionSchema.index({ userId: 1, productId: 1 });

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;

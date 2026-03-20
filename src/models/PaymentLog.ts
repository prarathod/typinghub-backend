import mongoose, { Schema, type HydratedDocument } from "mongoose";

export type PaymentEventType =
  | "order_created"
  | "verify_started"
  | "verify_signature_failed"
  | "access_granted"
  | "verify_error";

export type IPaymentLog = {
  eventType: PaymentEventType;
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  productIds: string[];
  amountPaise: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
};

export type PaymentLogDocument = HydratedDocument<IPaymentLog>;

const paymentLogSchema = new Schema<IPaymentLog>(
  {
    eventType: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userEmail: { type: String },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    productIds: { type: [String], default: [] },
    amountPaise: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

paymentLogSchema.index({ razorpayOrderId: 1 });
paymentLogSchema.index({ userId: 1 });
paymentLogSchema.index({ createdAt: -1 });

const PaymentLog = mongoose.model<IPaymentLog>("PaymentLog", paymentLogSchema);

export default PaymentLog;

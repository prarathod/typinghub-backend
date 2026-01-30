import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";

import { env } from "../config/env";
import {
  getBundleAmountPaise,
  getBundleRules,
  getProductById,
  PRODUCTS,
  type ProductId
} from "../config/products";
import { requireAuth } from "../middleware/auth";
import User from "../models/User";
import type { UserDocument } from "../models/User";
import Subscription from "../models/Subscription";

const router = Router();
const CURRENCY = "INR";

/** In-memory store: orderId -> productIds. For multi-instance use Redis. */
const pendingOrders = new Map<string, string[]>();

const getRazorpay = () =>
  new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET
  });

router.get("/products", (_req: Request, res: Response) => {
  res.json({
    products: PRODUCTS.map((p) => ({
      productId: p.productId,
      name: p.name,
      amountPaise: p.amountPaise,
      language: p.language,
      category: p.category
    })),
    bundleRules: getBundleRules()
  });
});

router.post("/create-order", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserDocument;
    const body = req.body as { productIds?: unknown };
    const rawIds = Array.isArray(body.productIds) ? body.productIds : [];
    const productIds = rawIds.filter((id): id is string => typeof id === "string");

    if (productIds.length === 0) {
      return res.status(400).json({ message: "productIds array is required and must not be empty." });
    }

    const invalid = productIds.filter((id) => !getProductById(id));
    if (invalid.length > 0) {
      return res.status(400).json({
        message: `Invalid productIds: ${invalid.join(", ")}.`
      });
    }

    const amountPaise = getBundleAmountPaise(productIds);
    if (amountPaise <= 0) {
      return res.status(400).json({ message: "Could not compute order amount." });
    }

    const razorpay = getRazorpay();
    const receipt = `th_${user._id.toString().slice(-12)}_${Date.now().toString(36)}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: CURRENCY,
      receipt: receipt.length > 40 ? receipt.slice(0, 40) : receipt
    });

    pendingOrders.set(order.id, productIds);

    res.status(201).json({
      orderId: order.id,
      amount: amountPaise,
      currency: CURRENCY,
      keyId: env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Failed to create order." });
  }
});

router.post("/verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      };

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Missing payment details."
      });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const productIds = pendingOrders.get(razorpay_order_id);
    pendingOrders.delete(razorpay_order_id);

    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ message: "Order not found or already processed." });
    }

    const user = req.user as UserDocument;

    await Promise.all(
      productIds.map((productId) =>
        Subscription.create({
          userId: user._id,
          productId: productId as ProductId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id
        })
      )
    );

    await User.updateOne(
      { _id: user._id },
      { $set: { isPaid: true } }
    );

    const subscriptions = await Subscription.find({ userId: user._id })
      .select("productId")
      .lean();
    const subscriptionIds = subscriptions.map((s) => s.productId as string);

    const updated = await User.findById(user._id).lean();
    if (!updated) {
      return res.status(500).json({ message: "User not found." });
    }
    const u = updated as {
      _id: { toString(): string };
      name: string;
      email: string;
      avatarUrl?: string;
      isPaid?: boolean;
    };
    res.json({
      success: true,
      user: {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        isPaid: true
      },
      subscriptions: subscriptionIds
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ message: "Payment verification failed." });
  }
});

export default router;

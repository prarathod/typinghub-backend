import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";

import { env } from "../config/env";
import {
  getBundleAmountPaise,
  getBundleRules,
  getProductById,
  isSaleActive,
  PRODUCTS,
  type ProductId
} from "../config/products";
import { requireAuth } from "../middleware/auth";
import PaymentLog from "../models/PaymentLog";
import User from "../models/User";
import type { UserDocument } from "../models/User";
import Subscription, { SUBSCRIPTION_VALIDITY_DAYS } from "../models/Subscription";

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
  const sale = isSaleActive();
  const SALE_AMOUNT_PAISE = 5900;
  res.json({
    products: PRODUCTS.map((p) => ({
      productId: p.productId,
      name: p.name,
      amountPaise: sale ? SALE_AMOUNT_PAISE : p.amountPaise,
      originalAmountPaise: p.amountPaise,
      language: p.language,
      category: p.category
    })),
    bundleRules: getBundleRules(),
    sale: sale
      ? { active: true, saleEndUtc: "2026-03-20T18:29:00Z" }
      : { active: false }
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

    PaymentLog.create({
      eventType: "order_created",
      userId: user._id,
      userEmail: user.email,
      razorpayOrderId: order.id,
      productIds,
      amountPaise
    }).catch(() => {/* non-blocking */});

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
  const user = req.user as UserDocument;
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

    PaymentLog.create({
      eventType: "verify_started",
      userId: user._id,
      userEmail: user.email,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      productIds: [],
      amountPaise: 0
    }).catch(() => {/* non-blocking */});

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      PaymentLog.create({
        eventType: "verify_signature_failed",
        userId: user._id,
        userEmail: user.email,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        productIds: [],
        amountPaise: 0
      }).catch(() => {/* non-blocking */});
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const productIds = pendingOrders.get(razorpay_order_id);
    pendingOrders.delete(razorpay_order_id);

    if (!productIds || productIds.length === 0) {
      return res.status(400).json({ message: "Order not found or already processed." });
    }

    await Promise.all(
      productIds.map(async (productId) => {
        const existing = await Subscription.findOne(
          { userId: user._id, productId },
          null,
          { sort: { validUntil: -1 } }
        ).lean();

        const now = new Date();
        const baseDate =
          existing?.validUntil && existing.validUntil > now
            ? existing.validUntil
            : now;
        const validUntil = new Date(
          baseDate.getTime() + SUBSCRIPTION_VALIDITY_DAYS * 24 * 60 * 60 * 1000
        );

        await Subscription.deleteMany({ userId: user._id, productId });
        await Subscription.create({
          userId: user._id,
          productId: productId as ProductId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          validUntil
        });
      })
    );

    await User.updateOne(
      { _id: user._id },
      { $set: { isPaid: true } }
    );

    PaymentLog.create({
      eventType: "access_granted",
      userId: user._id,
      userEmail: user.email,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      productIds,
      amountPaise: 0
    }).catch(() => {/* non-blocking */});

    const subscriptions = await Subscription.find({ userId: user._id })
      .select("productId validUntil")
      .lean();
    const subscriptionItems = subscriptions.map((s) => ({
      productId: s.productId as string,
      validUntil: s.validUntil ? s.validUntil.toISOString() : null
    }));

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
      subscriptions: subscriptionItems
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    const { razorpay_order_id, razorpay_payment_id } = (req.body ?? {}) as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
    };
    PaymentLog.create({
      eventType: "verify_error",
      userId: user?._id,
      userEmail: user?.email,
      razorpayOrderId: razorpay_order_id ?? "unknown",
      razorpayPaymentId: razorpay_payment_id,
      productIds: [],
      amountPaise: 0,
      meta: { error: err instanceof Error ? err.message : String(err) }
    }).catch(() => {/* non-blocking */});
    res.status(500).json({ message: "Payment verification failed." });
  }
});

export default router;

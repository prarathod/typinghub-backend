import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";

import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import User from "../models/User";
import type { UserDocument } from "../models/User";

const router = Router();
const ADVANCE_AMOUNT_PAISE = 100; // ₹1 (testing)
const CURRENCY = "INR";

const getRazorpay = () =>
  new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET
  });

router.post("/create-order", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as UserDocument;
    if (user.isPaid) {
      return res
        .status(400)
        .json({ message: "You already have an active plan." });
    }

    const razorpay = getRazorpay();
    const receipt = `adv_${user._id.toString().slice(-12)}_${Date.now().toString(36)}`;
    const order = await razorpay.orders.create({
      amount: ADVANCE_AMOUNT_PAISE,
      currency: CURRENCY,
      receipt: receipt.length > 40 ? receipt.slice(0, 40) : receipt
    });

    res.status(201).json({
      orderId: order.id,
      amount: ADVANCE_AMOUNT_PAISE,
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

    const user = req.user as UserDocument;
    await User.updateOne(
      { _id: user._id },
      { $set: { isPaid: true } }
    );

    const updated = await User.findById(user._id).lean();
    if (!updated) {
      return res.status(500).json({ message: "User not found." });
    }
    const u = updated as { _id: { toString(): string }; name: string; email: string; avatarUrl?: string };
    res.json({
      success: true,
      user: {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        isPaid: true
      }
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ message: "Payment verification failed." });
  }
});

export default router;

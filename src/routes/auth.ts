import { Router } from "express";
import passport from "passport";

import { env } from "../config/env";
import { PRODUCTS } from "../config/products";
import { requireAuth } from "../middleware/auth";
import Subscription from "../models/Subscription";
import type { UserDocument } from "../models/User";
import { signToken } from "../utils/jwt";

const router = Router();
const ALL_PRODUCT_IDS = PRODUCTS.map((p) => p.productId);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.CLIENT_URL}/?auth=failed`
  }),
  async (req, res) => {
    const user = req.user as UserDocument | undefined;
    if (!user) {
      return res.redirect(`${env.CLIENT_URL}/?auth=failed`);
    }

    // Increment session version so previous tokens (other devices) become invalid — one device at a time
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    const token = signToken(user);
    const maxAgeMs = 1000 * 60 * 60 * 24 * 7; // 7 days
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAgeMs
    });

    const redirectUrl = new URL("/auth/callback", env.CLIENT_URL);
    redirectUrl.searchParams.set("token", token);
    res.redirect(redirectUrl.toString());
  }
);

router.get("/me", requireAuth, async (req, res) => {
  const user = req.user as UserDocument;
  const now = new Date();
  const subscriptions = await Subscription.find({ userId: user._id })
    .select("productId validUntil")
    .lean();
  const subscriptionItems = subscriptions.map((s) => ({
    productId: s.productId as string,
    validUntil: s.validUntil ? s.validUntil.toISOString() : null
  }));
  let activeProductIds = subscriptionItems
    .filter((s) => !s.validUntil || new Date(s.validUntil) > now)
    .map((s) => s.productId);
  if (user.isPaid && activeProductIds.length === 0 && subscriptionItems.length === 0) {
    activeProductIds = [...ALL_PRODUCT_IDS];
  }
  res.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isPaid: user.isPaid
    },
    subscriptions: subscriptionItems,
    activeProductIds
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.status(204).send();
});

export default router;

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
  (req, res) => {
    const user = req.user as UserDocument | undefined;
    if (!user) {
      return res.redirect(`${env.CLIENT_URL}/?auth=failed`);
    }

    const token = signToken(user);
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    const redirectUrl = new URL("/auth/callback", env.CLIENT_URL);
    redirectUrl.searchParams.set("token", token);
    res.redirect(redirectUrl.toString());
  }
);

router.get("/me", requireAuth, async (req, res) => {
  const user = req.user as UserDocument;
  const subscriptions = await Subscription.find({ userId: user._id })
    .select("productId")
    .lean();
  let subscriptionIds = subscriptions.map((s) => s.productId as string);
  if (user.isPaid && subscriptionIds.length === 0) {
    subscriptionIds = [...ALL_PRODUCT_IDS];
  }
  res.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isPaid: user.isPaid
    },
    subscriptions: subscriptionIds
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.status(204).send();
});

export default router;

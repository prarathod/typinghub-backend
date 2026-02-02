import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";

import { PRODUCTS, type ProductId } from "../config/products";
import { requireAdmin } from "../middleware/adminAuth";
import Paragraph, { type Category } from "../models/Paragraph";
import Submission from "../models/Submission";
import Subscription from "../models/Subscription";
import User from "../models/User";
import { signAdminToken } from "../utils/adminJwt";

const ADMIN_GRANT_ORDER_ID = "admin-grant";

const router = Router();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "tph-pr-admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "tph-admin-2024";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signAdminToken(username);
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24
    });
    res.json({ token, username });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Failed to login" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("admin_token");
  res.status(204).send();
});

router.get("/me", requireAdmin, (req: Request, res: Response) => {
  res.json({ username: req.admin?.username, role: "admin" });
});

router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const search = req.query.search as string | undefined;
    const isPaidFilter = req.query.isPaid as string | undefined;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (isPaidFilter === "true") filter.isPaid = true;
    else if (isPaidFilter === "false") filter.isPaid = false;

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    const itemsWithCounts = await Promise.all(
      items.map(async (user) => {
        const submissionCount = await Submission.countDocuments({
          userId: user._id
        });
        return { ...user, submissionCount };
      })
    );

    const totalPages = Math.ceil(total / limit);
    res.json({ items: itemsWithCounts, total, page, limit, totalPages });
  } catch (err) {
    console.error("Admin users list error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.get("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const submissionCount = await Submission.countDocuments({ userId: user._id });
    res.json({ ...user, submissionCount });
  } catch (err) {
    console.error("Admin user by id error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.put("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const { name, email, isPaid } = req.body as {
      name?: string;
      email?: string;
      isPaid?: boolean;
    };
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (isPaid !== undefined) update.isPaid = isPaid;

    const user = await User.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Admin user update error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.get("/users/:id/subscriptions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const userId = new mongoose.Types.ObjectId(id);
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const subs = await Subscription.find({ userId }).select("productId razorpayOrderId").lean();
    const productIds = subs.map((s) => s.productId as string);
    const adminGrantedProductIds = subs
      .filter((s) => s.razorpayOrderId === ADMIN_GRANT_ORDER_ID)
      .map((s) => s.productId as string);
    res.json({ productIds, adminGrantedProductIds, products: PRODUCTS });
  } catch (err) {
    console.error("Admin user subscriptions error:", err);
    res.status(500).json({ message: "Failed to fetch user subscriptions" });
  }
});

router.put("/users/:id/subscriptions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const userId = new mongoose.Types.ObjectId(id);
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const body = req.body as { productIds?: unknown };
    const rawIds = Array.isArray(body.productIds) ? body.productIds : [];
    const productIds = rawIds.filter((id): id is string => typeof id === "string");
    const validProductIds = PRODUCTS.map((p) => p.productId);
    const toGrant = [...new Set(productIds.filter((pid) => validProductIds.includes(pid as ProductId)))];

    await Subscription.deleteMany({ userId, razorpayOrderId: ADMIN_GRANT_ORDER_ID });
    for (const productId of toGrant) {
      const existing = await Subscription.findOne({ userId, productId }).lean();
      if (!existing) {
        await Subscription.create({
          userId,
          productId: productId as ProductId,
          razorpayOrderId: ADMIN_GRANT_ORDER_ID
        });
      }
    }
    const subs = await Subscription.find({ userId }).select("productId").lean();
    res.json({ productIds: subs.map((s) => s.productId as string) });
  } catch (err) {
    console.error("Admin user subscriptions update error:", err);
    res.status(500).json({ message: "Failed to update user subscriptions" });
  }
});

router.delete("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const userId = new mongoose.Types.ObjectId(id);
    await Submission.deleteMany({ userId });
    await Subscription.deleteMany({ userId });
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Admin user delete error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.get("/paragraphs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const language = req.query.language as string | undefined;
    const category = req.query.category as string | undefined;

    const filter: Record<string, unknown> = {};
    if (language) filter.language = language;
    if (category) filter.category = category;

    const [items, total] = await Promise.all([
      Paragraph.find(filter)
        .sort({ order: 1, title: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Paragraph.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);
    res.json({ items, total, page, limit, totalPages });
  } catch (err) {
    console.error("Admin paragraphs list error:", err);
    res.status(500).json({ message: "Failed to fetch paragraphs" });
  }
});

router.get("/paragraphs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid paragraph ID" });
    }
    const paragraph = await Paragraph.findById(id).lean();
    if (!paragraph) {
      return res.status(404).json({ message: "Paragraph not found" });
    }
    res.json(paragraph);
  } catch (err) {
    console.error("Admin paragraph by id error:", err);
    res.status(500).json({ message: "Failed to fetch paragraph" });
  }
});

router.post("/paragraphs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const required = ["title", "isFree", "language", "category", "text"];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null) {
        return res.status(400).json({ message: `Missing required field: ${key}` });
      }
    }

    const order =
      typeof body.order === "number" ? body.order : typeof body.order === "string" ? parseInt(String(body.order), 10) : 0;
    const orderNum = Number.isFinite(order) ? order : 0;

    const paragraph = await Paragraph.create({
      title: String(body.title),
      isFree: Boolean(body.isFree),
      language: body.language as "english" | "marathi",
      category: body.category as Category,
      order: orderNum,
      text: String(body.text),
      solvedCount: 0,
      published: body.published !== undefined ? Boolean(body.published) : false
    });

    res.status(201).json(paragraph.toObject());
  } catch (err) {
    console.error("Admin paragraph create error:", err);
    res.status(500).json({ message: "Failed to create paragraph" });
  }
});

router.put("/paragraphs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid paragraph ID" });
    }
    const body = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = String(body.title);
    if (body.isFree !== undefined) update.isFree = Boolean(body.isFree);
    if (body.language !== undefined) update.language = body.language;
    if (body.category !== undefined) update.category = body.category;
    if (body.order !== undefined) {
      const o = typeof body.order === "number" ? body.order : parseInt(String(body.order), 10);
      update.order = Number.isFinite(o) ? o : 0;
    }
    if (body.text !== undefined) update.text = String(body.text);
    if (body.published !== undefined) update.published = Boolean(body.published);

    const paragraph = await Paragraph.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!paragraph) {
      return res.status(404).json({ message: "Paragraph not found" });
    }
    res.json(paragraph);
  } catch (err) {
    console.error("Admin paragraph update error:", err);
    res.status(500).json({ message: "Failed to update paragraph" });
  }
});

router.delete("/paragraphs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : rawId?.[0];
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid paragraph ID" });
    }
    await Submission.deleteMany({ paragraphId: new mongoose.Types.ObjectId(id) });
    const paragraph = await Paragraph.findByIdAndDelete(id);
    if (!paragraph) {
      return res.status(404).json({ message: "Paragraph not found" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Admin paragraph delete error:", err);
    res.status(500).json({ message: "Failed to delete paragraph" });
  }
});

router.get("/submissions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const paragraphId = req.query.paragraphId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";

    const filter: Record<string, unknown> = {};
    if (paragraphId && mongoose.isValidObjectId(paragraphId)) {
      filter.paragraphId = new mongoose.Types.ObjectId(paragraphId);
    }
    if (userId && mongoose.isValidObjectId(userId)) {
      filter.userId = new mongoose.Types.ObjectId(userId);
    }

    const sort: Record<string, 1 | -1> = {};
    if (sortBy === "timeTakenSeconds") sort.timeTakenSeconds = 1;
    else if (sortBy === "wpm") sort.wpm = -1;
    else if (sortBy === "accuracy") sort.accuracy = -1;
    else sort.createdAt = -1;

    const [items, total] = await Promise.all([
      Submission.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("paragraphId", "title")
        .populate("userId", "name email")
        .lean(),
      Submission.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);
    res.json({ items, total, page, limit, totalPages });
  } catch (err) {
    console.error("Admin submissions list error:", err);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
});

router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalParagraphs, totalSubmissions] = await Promise.all([
      User.countDocuments(),
      Paragraph.countDocuments(),
      Submission.countDocuments()
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSubmissions = await Submission.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const topUsers = await Submission.aggregate([
      { $match: { userId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$userId",
          avgWpm: { $avg: "$wpm" },
          avgAccuracy: { $avg: "$accuracy" },
          submissionCount: { $sum: 1 }
        }
      },
      { $sort: { avgWpm: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          userName: "$user.name",
          userEmail: "$user.email",
          avgWpm: { $round: ["$avgWpm", 1] },
          avgAccuracy: { $round: ["$avgAccuracy", 1] },
          submissionCount: 1
        }
      }
    ]);

    const popularParagraphs = await Submission.aggregate([
      {
        $group: {
          _id: "$paragraphId",
          submissionCount: { $sum: 1 }
        }
      },
      { $sort: { submissionCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "paragraphs",
          localField: "_id",
          foreignField: "_id",
          as: "paragraph"
        }
      },
      { $unwind: "$paragraph" },
      {
        $project: {
          paragraphId: "$_id",
          paragraphTitle: "$paragraph.title",
          submissionCount: 1
        }
      }
    ]);

    const submissionsByDay = await Submission.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalUsers,
      totalParagraphs,
      totalSubmissions,
      recentSubmissions,
      topUsers,
      popularParagraphs,
      submissionsByDay
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

export default router;

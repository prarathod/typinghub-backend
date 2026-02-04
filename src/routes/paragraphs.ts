import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";

import { getProductIdForParagraph } from "../config/products";
import { optionalAuth, requireAuth } from "../middleware/auth";
import Paragraph, { type AccessType, type Category } from "../models/Paragraph";
import Submission from "../models/Submission";
import Subscription from "../models/Subscription";
import type { UserDocument } from "../models/User";

type ParagraphForAccess = {
  isFree?: boolean;
  accessType?: AccessType;
  language: string;
  category: string;
};

function getEffectiveAccessType(p: ParagraphForAccess): AccessType {
  if (p.accessType) return p.accessType;
  return p.isFree !== false ? "free" : "paid";
}

async function userHasAccessToParagraph(
  userId: mongoose.Types.ObjectId | null | undefined,
  isPaidUser: boolean,
  paragraph: ParagraphForAccess
): Promise<boolean> {
  const accessType = getEffectiveAccessType(paragraph);
  if (accessType === "free") return true;
  if (accessType === "free-after-login") return !!userId;
  const productId = getProductIdForParagraph(
    paragraph.language as "english" | "marathi",
    paragraph.category as Category
  );
  if (!userId) return false;
  if (!productId) return true;
  const now = new Date();
  const sub = await Subscription.findOne({ userId, productId }).lean();
  if (sub) {
    if (!sub.validUntil) return true;
    if (sub.validUntil > now) return true;
    return false;
  }
  if (isPaidUser) {
    const activeCount = await Subscription.countDocuments({
      userId,
      $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gt: now } }]
    });
    if (activeCount === 0) return true;
  }
  return false;
}

const router = Router();
const LANGUAGE_VALUES = ["english", "marathi"] as const;
const CATEGORY_VALUES = ["lessons", "court-exam", "mpsc"] as const;
const PRICE_VALUES = ["all", "free", "paid"] as const;
const MAX_LIMIT = 24;
const DEFAULT_LIMIT = 24;
const LESSONS_FETCH_CAP = 500;

/** Sort by order (asc), then by title. Used for all categories. */
function orderThenTitleComparator(
  a: { order?: number; title: string },
  b: { order?: number; title: string }
): number {
  const aOrder = typeof a.order === "number" ? a.order : 0;
  const bOrder = typeof b.order === "number" ? b.order : 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.title.localeCompare(b.title);
}

type LeanItem = Record<string, unknown> & { _id: unknown; title: string; order?: number };

router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const rawCategory = req.query.category;
    const category = typeof rawCategory === "string"
      ? rawCategory.trim().toLowerCase()
      : Array.isArray(rawCategory) && rawCategory.length > 0
        ? String(rawCategory[0]).trim().toLowerCase()
        : undefined;

    const language = req.query.language as string | undefined;
    const price = req.query.price as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    if (!language || !LANGUAGE_VALUES.includes(language as (typeof LANGUAGE_VALUES)[number])) {
      return res.status(400).json({
        message: "Invalid or missing 'language' query. Use 'english' or 'marathi'."
      });
    }

    if (category && !CATEGORY_VALUES.includes(category as (typeof CATEGORY_VALUES)[number])) {
      return res.status(400).json({
        message: "Invalid 'category' query. Use 'lessons', 'court-exam', or 'mpsc'."
      });
    }

    if (price && !PRICE_VALUES.includes(price as (typeof PRICE_VALUES)[number])) {
      return res.status(400).json({
        message: "Invalid 'price' query. Use 'all', 'free', or 'paid'."
      });
    }

    const filter = {
      language,
      $or: [{ published: true }, { published: { $exists: false } }],
      ...(category && { category: category as Category }),
      ...(price === "free" && { isFree: true }),
      ...(price === "paid" && { isFree: false })
    };
    const queryFilter = filter as unknown as Parameters<typeof Paragraph.find>[0];

    const user = req.user as UserDocument | undefined;
    const [all, total, solvedIds] = await Promise.all([
      (async (): Promise<LeanItem[]> => {
        const list = await Paragraph.find(queryFilter)
          .select("-text")
          .limit(LESSONS_FETCH_CAP)
          .lean();
        const sorted = list as LeanItem[] & { order?: number; title: string }[];
        sorted.sort(orderThenTitleComparator);
        const start = (page - 1) * limit;
        return sorted.slice(start, start + limit);
      })(),
      Paragraph.countDocuments(queryFilter),
      (async () => {
        const uid = user?._id;
        if (!uid) return new Set<string>();
        const ids = await Submission.distinct("paragraphId", { userId: uid });
        return new Set(ids.map((id) => String(id)));
      })()
    ]);

    const items = all.map((it) => {
      const item = it as Record<string, unknown> & { _id: unknown };
      return {
        ...item,
        solvedByUser: solvedIds.has(String(item._id))
      };
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages
    });
  } catch (err) {
    console.error("Paragraphs list error:", err);
    res.status(500).json({ message: "Failed to fetch paragraphs." });
  }
});

router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid paragraph ID." });
    }
    const paragraph = await Paragraph.findOne({
      _id: id,
      $or: [{ published: true }, { published: { $exists: false } }]
    }).lean();
    if (!paragraph) {
      return res.status(404).json({ message: "Paragraph not found." });
    }
    const accessType = getEffectiveAccessType(paragraph as ParagraphForAccess);
    const user = req.user as UserDocument | undefined;
    if (accessType === "free-after-login") {
      if (!user) {
        return res.status(403).json({
          message: "Sign in to access this passage."
        });
      }
    } else if (accessType === "paid") {
      if (!user) {
        return res.status(403).json({
          message: "Sign in to access this passage."
        });
      }
      const hasAccess = await userHasAccessToParagraph(user._id, user.isPaid === true, paragraph as ParagraphForAccess);
      if (!hasAccess) {
        return res.status(403).json({
          message: "Upgrade to access this passage."
        });
      }
    }
    res.json(paragraph);
  } catch (err) {
    console.error("Paragraph by id error:", err);
    res.status(500).json({ message: "Failed to fetch paragraph." });
  }
});

const LEADERBOARD_LIMIT = 10;
const MIN_ACCURACY_LEADERBOARD = 50;

router.get(
  "/:id/submissions/leaderboard",
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = typeof rawId === "string" ? rawId : rawId?.[0];
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid paragraph ID." });
      }
      const paragraph = await Paragraph.findOne({
        _id: id,
        $or: [{ published: true }, { published: { $exists: false } }]
      }).lean();
      if (!paragraph) {
        return res.status(404).json({ message: "Paragraph not found." });
      }

      const filter: Record<string, unknown> = {
        paragraphId: new mongoose.Types.ObjectId(id),
        accuracy: { $gte: MIN_ACCURACY_LEADERBOARD }
      };

      const uid = (req.user as UserDocument | undefined)?._id;
      const top = await Submission.find(filter)
        .sort({ timeTakenSeconds: 1 })
        .limit(LEADERBOARD_LIMIT)
        .populate("userId", "name")
        .lean();

      const leaderboard = top.map((s, i) => {
        const sid = (s as { userId?: { _id?: unknown } }).userId;
        const userIdMatch = sid && typeof sid === "object" && "_id" in sid &&
          uid && String((sid as { _id: unknown })._id) === String(uid);
        return {
          rank: i + 1,
          userName: (s.userId as { name?: string } | null)?.name ?? "Anonymous",
          timeTakenSeconds: s.timeTakenSeconds,
          wpm: s.wpm,
          accuracy: s.accuracy,
          createdAt: (s as { createdAt?: Date }).createdAt,
          isYou: Boolean(userIdMatch)
        };
      });

      let yourRank: number | null = null;
      let yourBest: (typeof leaderboard)[0] | null = null;
      if (uid) {
        const best = await Submission.findOne({
          paragraphId: new mongoose.Types.ObjectId(id),
          userId: uid
        })
          .sort({ timeTakenSeconds: 1 })
          .populate("userId", "name")
          .lean();
        if (best) {
          yourBest = {
            rank: 0,
            userName: (best.userId as { name?: string } | null)?.name ?? "You",
            timeTakenSeconds: best.timeTakenSeconds,
            wpm: best.wpm,
            accuracy: best.accuracy,
            createdAt: (best as { createdAt?: Date }).createdAt,
            isYou: true
          };
          const betterCount = await Submission.countDocuments({
            paragraphId: new mongoose.Types.ObjectId(id),
            accuracy: { $gte: MIN_ACCURACY_LEADERBOARD },
            timeTakenSeconds: { $lt: best.timeTakenSeconds }
          });
          yourRank = betterCount + 1;
        }
      }

      res.json({ leaderboard, yourRank, yourBest });
    } catch (err) {
      console.error("Leaderboard error:", err);
      res.status(500).json({ message: "Failed to fetch leaderboard." });
    }
  }
);

router.get(
  "/:id/submissions/history",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = typeof rawId === "string" ? rawId : rawId?.[0];
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid paragraph ID." });
      }
      const paragraph = await Paragraph.findOne({
        _id: id,
        $or: [{ published: true }, { published: { $exists: false } }]
      }).lean();
      if (!paragraph) {
        return res.status(404).json({ message: "Paragraph not found." });
      }

      const uid = (req.user as UserDocument)._id;
      const list = await Submission.find({
        paragraphId: new mongoose.Types.ObjectId(id),
        userId: uid
      })
        .sort({ createdAt: -1 })
        .select("-userInput")
        .lean();

      const submissions = list.map((s) => ({
        _id: (s as { _id: unknown })._id,
        timeTakenSeconds: s.timeTakenSeconds,
        wpm: s.wpm,
        accuracy: s.accuracy,
        correctWordsCount: s.correctWordsCount,
        incorrectWordsCount: s.incorrectWordsCount,
        createdAt: (s as { createdAt?: Date }).createdAt
      }));

      const stats = {
        totalAttempts: submissions.length,
        bestTimeSeconds:
          submissions.length > 0
            ? Math.min(...submissions.map((x) => x.timeTakenSeconds))
            : 0,
        bestWpm:
          submissions.length > 0 ? Math.max(...submissions.map((x) => x.wpm)) : 0,
        avgAccuracy: submissions.length
          ? Math.round(
              submissions.reduce((a, x) => a + x.accuracy, 0) / submissions.length
            )
          : 0
      };

      res.json({ submissions, stats });
    } catch (err) {
      console.error("History error:", err);
      res.status(500).json({ message: "Failed to fetch history." });
    }
  }
);

router.post(
  "/:id/submissions",
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = typeof rawId === "string" ? rawId : rawId?.[0];
      if (!id || !mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid paragraph ID." });
      }
      const paragraph = await Paragraph.findOne({
        _id: id,
        $or: [{ published: true }, { published: { $exists: false } }]
      }).lean();
      if (!paragraph) {
        return res.status(404).json({ message: "Paragraph not found." });
      }
      const accessType = getEffectiveAccessType(paragraph as ParagraphForAccess);
      const user = req.user as UserDocument | undefined;
      if (accessType === "free-after-login") {
        if (!user) {
          return res.status(403).json({
            message: "Sign in to access this passage."
          });
        }
      } else if (accessType === "paid") {
        if (!user) {
          return res.status(403).json({
            message: "Sign in to access this passage."
          });
        }
        const hasAccess = await userHasAccessToParagraph(user._id, user.isPaid === true, paragraph as ParagraphForAccess);
        if (!hasAccess) {
          return res.status(403).json({
            message: "Upgrade to access this passage."
          });
        }
      }

      const body = req.body as Record<string, unknown>;
      const required = [
        "timeTakenSeconds",
        "accuracy",
        "totalKeystrokes",
        "backspaceCount",
        "wordsTyped",
        "wpm",
        "kpm",
        "incorrectWordsCount",
        "incorrectWords",
        "correctWordsCount",
        "userInput"
      ] as const;
      for (const key of required) {
        if (body[key] === undefined || body[key] === null) {
          return res.status(400).json({ message: `Missing required field: ${key}.` });
        }
      }

      const submission = await Submission.create({
        paragraphId: new mongoose.Types.ObjectId(id),
        userId: (req.user as UserDocument | undefined)?._id,
        timeTakenSeconds: Number(body.timeTakenSeconds),
        accuracy: Number(body.accuracy),
        totalKeystrokes: Number(body.totalKeystrokes),
        backspaceCount: Number(body.backspaceCount),
        wordsTyped: Number(body.wordsTyped),
        wpm: Number(body.wpm),
        kpm: Number(body.kpm),
        incorrectWordsCount: Number(body.incorrectWordsCount),
        incorrectWords: Array.isArray(body.incorrectWords)
          ? (body.incorrectWords as string[])
          : [],
        correctWordsCount: Number(body.correctWordsCount),
        userInput: String(body.userInput)
      });

      res.status(201).json({ _id: submission._id.toString() });
    } catch (err) {
      console.error("Submission create error:", err);
      res.status(500).json({ message: "Failed to store submission." });
    }
  }
);

export default router;

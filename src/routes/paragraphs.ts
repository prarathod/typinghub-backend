import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";

import { getProductIdForParagraph } from "../config/products";
import { optionalAuth, requireAuth } from "../middleware/auth";
import Paragraph, { type Category } from "../models/Paragraph";
import Submission from "../models/Submission";
import Subscription from "../models/Subscription";
import type { UserDocument } from "../models/User";

async function userHasAccessToParagraph(
  userId: mongoose.Types.ObjectId,
  isPaidUser: boolean,
  paragraph: { isFree: boolean; language: string; category: string }
): Promise<boolean> {
  if (paragraph.isFree) return true;
  const productId = getProductIdForParagraph(
    paragraph.language as "english" | "marathi",
    paragraph.category as Category
  );
  if (!productId) return true;
  const sub = await Subscription.findOne({ userId, productId }).lean();
  if (sub) return true;
  if (isPaidUser) {
    const count = await Subscription.countDocuments({ userId });
    if (count === 0) return true;
  }
  return false;
}

const router = Router();
const LANGUAGE_VALUES = ["english", "marathi"] as const;
const CATEGORY_VALUES = ["lessons", "court-exam", "mpsc"] as const;
const PRICE_VALUES = ["all", "free", "paid"] as const;
const MAX_LIMIT = 24;
const DEFAULT_LIMIT = 12;
const LESSONS_FETCH_CAP = 500;

/** Parse "Lesson X.Y" or "X.Y" from title for natural sort. Returns [major, minor]; non-matching get [Infinity, Infinity]. */
function getLessonSortKey(title: string): [number, number] {
  const match =
    title.match(/(?:Lesson\s*)?(\d+)(?:\.(\d+))?/i) ?? title.match(/(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = match[2] ? parseInt(match[2], 10) : 0;
    return [major, minor];
  }
  return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
}

function lessonOrderComparator(
  a: { title: string },
  b: { title: string }
): number {
  const [aMajor, aMinor] = getLessonSortKey(a.title);
  const [bMajor, bMinor] = getLessonSortKey(b.title);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return a.title.localeCompare(b.title);
}

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
    const isLessons = category === "lessons";

    type LeanItem = Record<string, unknown> & { _id: unknown; title: string };
    const [rawItems, total, solvedIds] = await Promise.all([
      (async (): Promise<LeanItem[]> => {
        if (isLessons) {
          const all = await Paragraph.find(queryFilter)
            .select("-text")
            .limit(LESSONS_FETCH_CAP)
            .lean();
          const list = all as LeanItem[];
          list.sort(lessonOrderComparator);
          const start = (page - 1) * limit;
          return list.slice(start, start + limit);
        }
        const list = await Paragraph.find(queryFilter)
          .sort({ title: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select("-text")
          .lean();
        return list as LeanItem[];
      })(),
      Paragraph.countDocuments(queryFilter),
      (async () => {
        const uid = (req.user as UserDocument | undefined)?._id;
        if (!uid) return new Set<string>();
        const ids = await Submission.distinct("paragraphId", { userId: uid });
        return new Set(ids.map((id) => String(id)));
      })()
    ]);

    const items = rawItems.map((it) => {
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
    if (!paragraph.isFree) {
      const user = req.user as UserDocument | undefined;
      if (!user) {
        return res.status(403).json({
          message: "Sign in to access this passage."
        });
      }
      const hasAccess = await userHasAccessToParagraph(user._id, user.isPaid === true, paragraph);
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
      if (!paragraph.isFree) {
        const user = req.user as UserDocument | undefined;
        if (!user) {
          return res.status(403).json({
            message: "Sign in to access this passage."
          });
        }
        const hasAccess = await userHasAccessToParagraph(user._id, user.isPaid === true, paragraph);
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

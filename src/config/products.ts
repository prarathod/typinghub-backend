import type { Category } from "../models/Paragraph";
import type { Language } from "../models/Paragraph";

// Sale window in IST (UTC+5:30)
const SALE_START_UTC = new Date("2026-03-19T03:30:00Z"); // 19 Mar 09:00 AM IST
const SALE_END_UTC   = new Date("2026-03-20T18:29:00Z"); // 20 Mar 11:59 PM IST

const SALE_AMOUNT_PAISE = 5900; // ₹59 per course during sale

const SALE_BUNDLE_TOTAL_PAISE: Record<number, number> = {
  2:  9900, // ₹99
  3: 13900, // ₹139
  4: 17900  // ₹179
};

export function isSaleActive(): boolean {
  const now = new Date();
  return now >= SALE_START_UTC && now <= SALE_END_UTC;
}

export type ProductId =
  | "english-court"
  | "english-court-new"
  | "english-mpsc"
  | "marathi-court"
  | "marathi-mpsc";

export type Product = {
  productId: ProductId;
  name: string;
  amountPaise: number;
  language?: Language;
  category?: Category;
};

export const PRODUCTS: Product[] = [
  {
    productId: "english-court",
    name: "English Court Typing",
    amountPaise: 9900,
    language: "english",
    category: "court-exam"
  },
  {
    // Independently purchasable/tracked product, separate from "english-court".
    // Both unlock the same underlying Court Exam passages (Latest High Court
    // reuses them) — see getAcceptableProductIdsForParagraph below — but each
    // is its own Subscription so admins/pricing UI can grant or select them
    // independently.
    productId: "english-court-new",
    name: "English Typing For Court Exam (New Pattern)",
    amountPaise: 9900,
    language: "english",
    category: "court-exam"
  },
  {
    productId: "english-mpsc",
    name: "English MPSC Typing Exam",
    amountPaise: 9900,
    language: "english",
    category: "mpsc"
  },
  {
    productId: "marathi-court",
    name: "Marathi Court Exam",
    amountPaise: 9900,
    language: "marathi",
    category: "court-exam"
  },
  {
    productId: "marathi-mpsc",
    name: "Marathi MPSC Typing Exam",
    amountPaise: 9900,
    language: "marathi",
    category: "mpsc"
  }
];

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.productId, p]));

export function getProductById(productId: string): Product | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}

/** All product IDs whose ownership unlocks a given paragraph. Usually one, but
 * Court Exam paragraphs are unlocked by either "english-court" or the
 * separately-sold "english-court-new" ("New Pattern"), since Latest High
 * Court reuses Court Exam's passages under a second, independent product. */
export function getAcceptableProductIdsForParagraph(
  language: Language,
  category: Category
): ProductId[] {
  if (category === "lessons") return [];
  const key = `${language}-${category}` as const;
  const map: Record<string, ProductId[]> = {
    "english-court-exam": ["english-court", "english-court-new"],
    "english-mpsc": ["english-mpsc"],
    "marathi-court-exam": ["marathi-court"],
    "marathi-mpsc": ["marathi-mpsc"]
  };
  return map[key] ?? [];
}

export function getProductIdForParagraph(
  language: Language,
  category: Category
): ProductId | null {
  return getAcceptableProductIdsForParagraph(language, category)[0] ?? null;
}

/** Fixed bundle total in paise. 1 course = ₹99. 2 = ₹149, 3 = ₹199, 4 = ₹249. */
const BUNDLE_TOTAL_PAISE: Record<number, number | undefined> = {
  2: 14900,
  3: 19900,
  4: 24900
};

export function getBundleAmountPaise(productIds: string[]): number {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return 0;
  const sale = isSaleActive();
  if (sale) {
    const fixedSaleTotal = SALE_BUNDLE_TOTAL_PAISE[unique.length];
    if (fixedSaleTotal !== undefined) return fixedSaleTotal;
    return unique.length * SALE_AMOUNT_PAISE;
  }
  const fullSum = unique.reduce((sum, id) => {
    const p = getProductById(id);
    return sum + (p ? p.amountPaise : 0);
  }, 0);
  const fixedTotal = BUNDLE_TOTAL_PAISE[unique.length];
  if (fixedTotal !== undefined) return fixedTotal;
  return fullSum;
}

export function getBundleRules(): { count: number; amountPaise: number }[] {
  const sale = isSaleActive();
  return [2, 3, 4].map((count) => ({
    count,
    amountPaise: sale
      ? (SALE_BUNDLE_TOTAL_PAISE[count] ?? count * SALE_AMOUNT_PAISE)
      : (BUNDLE_TOTAL_PAISE[count] ?? 0)
  }));
}

import type { Category } from "../models/Paragraph";
import type { Language } from "../models/Paragraph";

export type ProductId =
  | "english-court"
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
    amountPaise: 100,
    language: "english",
    category: "court-exam"
  },
  {
    productId: "english-mpsc",
    name: "English MPSC Typing Exam",
    amountPaise: 4900,
    language: "english",
    category: "mpsc"
  },
  {
    productId: "marathi-court",
    name: "Marathi Court Exam",
    amountPaise: 4900,
    language: "marathi",
    category: "court-exam"
  },
  {
    productId: "marathi-mpsc",
    name: "Marathi MPSC Typing Exam",
    amountPaise: 4900,
    language: "marathi",
    category: "mpsc"
  }
];

const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.productId, p]));

export function getProductById(productId: string): Product | undefined {
  return PRODUCT_MAP.get(productId as ProductId);
}

export function getProductIdForParagraph(
  language: Language,
  category: Category
): ProductId | null {
  if (category === "lessons") return null;
  const key = `${language}-${category}` as const;
  const map: Record<string, ProductId> = {
    "english-court-exam": "english-court",
    "english-mpsc": "english-mpsc",
    "marathi-court-exam": "marathi-court",
    "marathi-mpsc": "marathi-mpsc"
  };
  return map[key] ?? null;
}

/** Fixed bundle total in paise. 1 course = use full price (no override). 2 = ₹89, 3 = ₹132, 4 = ₹175. */
const BUNDLE_TOTAL_PAISE: Record<number, number | undefined> = {
  2: 8900,
  3: 13200,
  4: 17500
};

export function getBundleAmountPaise(productIds: string[]): number {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return 0;
  const fullSum = unique.reduce((sum, id) => {
    const p = getProductById(id);
    return sum + (p ? p.amountPaise : 0);
  }, 0);
  const fixedTotal = BUNDLE_TOTAL_PAISE[unique.length];
  if (fixedTotal !== undefined) return fixedTotal;
  return fullSum;
}

export function getBundleRules(): { count: number; amountPaise: number }[] {
  return [2, 3, 4].map((count) => ({
    count,
    amountPaise: BUNDLE_TOTAL_PAISE[count] ?? 0
  }));
}

const arabicDiacritics = /[\u0617-\u061A\u064B-\u0652]/g;
const easternArabicDigits = new Map([
  ["٠", "0"], ["١", "1"], ["٢", "2"], ["٣", "3"], ["٤", "4"],
  ["٥", "5"], ["٦", "6"], ["٧", "7"], ["٨", "8"], ["٩", "9"],
  ["۰", "0"], ["۱", "1"], ["۲", "2"], ["۳", "3"], ["۴", "4"],
  ["۵", "5"], ["۶", "6"], ["۷", "7"], ["۸", "8"], ["۹", "9"]
]);

const brandAliases = new Map([
  ["apple", "Apple"],
  ["iphone", "Apple"],
  ["ايفون", "Apple"],
  ["آيفون", "Apple"],
  ["samsung", "Samsung"],
  ["سامسونج", "Samsung"],
  ["toyota", "Toyota"],
  ["تويوتا", "Toyota"],
  ["hyundai", "Hyundai"],
  ["هونداي", "Hyundai"]
]);

const modelAliases = new Map([
  ["iphone 13", "iPhone 13"],
  ["iphone13", "iPhone 13"],
  ["ايفون 13", "iPhone 13"],
  ["آيفون 13", "iPhone 13"],
  ["corolla", "Corolla"],
  ["كورولا", "Corolla"],
  ["elantra", "Elantra"],
  ["النترا", "Elantra"]
]);

const conditionTerms = [
  {
    condition: "damaged",
    terms: ["damaged", "broken", "cracked", "accident", "مكسور", "مضروب", "حادث", "سكراب"]
  },
  {
    condition: "used_excellent",
    terms: [
      "used excellent",
      "excellent condition",
      "مستعمل ممتاز",
      "مستعمل وكالة",
      "حالة ممتازة",
      "نظيف",
      "نظيف جدا",
      "like new"
    ]
  },
  {
    condition: "used_good",
    terms: ["used good", "good condition", "مستعمل جيد", "حالة جيدة"]
  },
  {
    condition: "brand_new",
    terms: ["brand new", "new", "جديد", "جديدة", "وكالة", "sealed"]
  }
];

export const suspiciousTerms = [
  "whatsapp only",
  "واتساب فقط",
  "حول عربون",
  "تحويل بنكي",
  "ادفع مقدم",
  "deposit first",
  "shipping only",
  "الشحن فقط",
  "outside jordan",
  "خارج الاردن",
  "no calls",
  "بدون اتصال"
];

export const urgentTerms = [
  "urgent",
  "must sell",
  "travel reason",
  "مستعجل",
  "لدواعي السفر",
  "سعر نهائي",
  "لقطة"
];

export function normalizeArabic(text) {
  return [...String(text ?? "")]
    .map((char) => easternArabicDigits.get(char) ?? char)
    .join("")
    .replace(/\u0640/g, "")
    .replace(arabicDiacritics, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

export function normalizeText(text) {
  return normalizeArabic(String(text ?? "").normalize("NFKC"))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferBrand(text, fallback = null) {
  const normalized = normalizeText(text);
  for (const [alias, brand] of brandAliases.entries()) {
    if (normalized.includes(normalizeText(alias))) return brand;
  }
  return fallback;
}

export function inferModel(text, fallback = null) {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/g, "");
  for (const [alias, model] of modelAliases.entries()) {
    const normalizedAlias = normalizeText(alias);
    if (normalized.includes(normalizedAlias) || compact.includes(normalizedAlias.replace(/\s+/g, ""))) {
      return model;
    }
  }
  return fallback;
}

export function inferStorageGb(text, fallback = null) {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(64|128|256|512|1024)\s*(gb|g|جيجا)\b/u);
  return match ? Number(match[1]) : fallback;
}

export function inferCondition(text, fallback = null) {
  const normalized = normalizeText(text);
  for (const { condition, terms } of conditionTerms) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) return condition;
  }
  return fallback;
}

export function containsAny(text, terms) {
  const normalized = normalizeText(text);
  return terms.filter((term) => normalized.includes(normalizeText(term)));
}

export function canonicalKey(value) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeText(String(value));
}


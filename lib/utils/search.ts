export type SearchableValue = string | number | boolean | null | undefined;

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const EASTERN_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeDigit(digit: string) {
  const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(digit);
  if (easternIndex >= 0) return String(easternIndex);

  const persianIndex = PERSIAN_DIGITS.indexOf(digit);
  if (persianIndex >= 0) return String(persianIndex);

  return digit;
}

export function normalizeSearchText(value: SearchableValue) {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩۰-۹]/g, normalizeDigit)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function createSearchMatcher(query: SearchableValue) {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);

  return (values: SearchableValue[]) => {
    if (terms.length === 0) return true;

    const haystack = values.map(normalizeSearchText).filter(Boolean).join(" ");
    return terms.every((term) => haystack.includes(term));
  };
}

export function matchesSearchQuery(values: SearchableValue[], query: SearchableValue) {
  return createSearchMatcher(query)(values);
}

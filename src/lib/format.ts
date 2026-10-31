const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** The keyword that marks a case description as needing extra attention. */
export const WARNING_KEYWORD = 'اخطار';

/**
 * «اخطار» can be typed with spaces, ZWNJ or Arabic letter variants.
 * A fresh regex is returned on every call because the global flag keeps state.
 */
export function warningPattern() {
  return /[اأإآ][\u200c\u200d\u200e\u200f\s]*خ[\u200c\u200d\u200e\u200f\s]*ط[\u200c\u200d\u200e\u200f\s]*ا[\u200c\u200d\u200e\u200f\s]*ر/g;
}

/** Text that is safe to search in: no diacritics, ZWNJ, spaces or letter variants. */
export function toKeywordText(value?: string | null) {
  return String(value ?? '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, '');
}

/** True when a case description mentions «اخطار», whatever the spacing. */
export function hasWarningNote(description?: string | null) {
  return toKeywordText(description).includes(WARNING_KEYWORD);
}

export function toPersianDigits(value: string | number) {
  return String(value).replace(/[0-9]/g, digit => PERSIAN_DIGITS[Number(digit)]);
}

/** Converts Persian/Arabic digits to Latin and removes spaces so search terms match consistently. */
export function toSearchText(value: string | number) {
  return String(value)
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .toLowerCase()
    .replace(/\s+/g, '');
}

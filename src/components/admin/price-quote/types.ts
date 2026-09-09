export type PriceQuoteRow = {
  weightLabel: string;
  isPerKg: boolean;
  priceOriginal: number;
};

export type PriceQuoteLine = {
  id: number;
  title: string;
  countries: string | null;
  minWeightKg: number | null;
  markupFlatVnd: number;
  markupPerKgVnd: number;
  rows: PriceQuoteRow[];
};

export type PriceQuoteCategory = {
  id: number;
  slug: string;
  title: string;
  note: string | null;
  sourceFileName: string | null;
  uploadedAt: string | null;
  lines: PriceQuoteLine[];
};

export type PolicyItem = {
  id: number;
  content: string;
};

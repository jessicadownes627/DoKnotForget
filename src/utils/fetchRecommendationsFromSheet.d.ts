export type SheetRecommendation = {
  type: string;
  title: string;
  description: string;
  url: string;
  active: string;
};

export function fetchRecommendationsFromSheet(sheetUrl: string): Promise<SheetRecommendation[]>;

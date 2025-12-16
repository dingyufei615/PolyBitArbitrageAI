/**
 * Converts an ISO Date string (from Polymarket) to Deribit Date Format (DDMMMYY).
 * Example: 2024-12-16T... -> 16DEC24
 * Example: 2024-05-05T... -> 5MAY24 (Deribit does not zero-pad single digit days)
 */
export const convertIsoToDeribitDate = (isoDate: string): string => {
  if (!isoDate) return '';
  
  const date = new Date(isoDate);
  // Deribit uses DMMMYY format. Day is NOT zero-padded.
  const day = date.getUTCDate().toString(); 
  const year = date.getUTCFullYear().toString().slice(-2); // 24
  
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getUTCMonth()];
  
  return `${day}${month}${year}`;
};

export const parsePolymarketOutcomes = (outcomesStr: string, pricesStr: string) => {
  try {
    // Polymarket sometimes returns stringified JSON, sometimes plain arrays/strings
    const names = outcomesStr.startsWith('[') ? JSON.parse(outcomesStr) : [outcomesStr];
    const prices = pricesStr.startsWith('[') ? JSON.parse(pricesStr) : [pricesStr];
    
    return names.map((name: string, index: number) => ({
      name,
      price: parseFloat(prices[index]) || 0
    }));
  } catch (e) {
    console.warn("Error parsing outcomes", e);
    return [];
  }
};
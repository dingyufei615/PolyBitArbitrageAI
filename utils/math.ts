/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * Approximation using Abramowitz and Stegun 26.2.17
 */
function normalCDF(x: number): number {
  if (x < 0) return 1 - normalCDF(-x);
  const t = 1 / (1 + 0.2316419 * x);
  return (
    1 -
    (1 / Math.sqrt(2 * Math.PI)) *
      Math.exp(-0.5 * x * x) *
      (0.31938153 * t +
        -0.356563782 * Math.pow(t, 2) +
        1.781477937 * Math.pow(t, 3) +
        -1.821255978 * Math.pow(t, 4) +
        1.330274429 * Math.pow(t, 5))
  );
}

/**
 * Box-Muller transform to generate normally distributed random numbers
 */
function randn_bm(): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

/**
 * Extracts a strike price from a text string (e.g. "Bitcoin > $95,000")
 */
export const extractStrikePrice = (text: string): number | null => {
  if (!text) return null;
  // Match $100,000 or 100k or just numbers near keywords
  const cleanText = text.replace(/,/g, '').toLowerCase();
  
  // Pattern 1: $number
  const dollarMatch = cleanText.match(/\$(\d+(\.\d+)?)/);
  if (dollarMatch) return parseFloat(dollarMatch[1]);
  
  // Pattern 2: number followed by k (e.g. 100k)
  const kMatch = cleanText.match(/(\d+(\.\d+)?)k\b/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  
  return null;
};

/**
 * Black-Scholes for Digital Call (Binary Option)
 * Returns the probability of S_T > K
 */
export const calculateBlackScholesProb = (
  S: number, // Spot
  K: number, // Strike
  T: number, // Time to expiry in years
  sigma: number, // Volatility (decimal, e.g. 0.60)
  r: number = 0.04 // Risk free rate
): number => {
  if (T <= 0) return S > K ? 1.0 : 0.0;
  
  const d2 = (Math.log(S / K) + (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return normalCDF(d2);
};

/**
 * Monte Carlo Simulation for Barrier/Touch or complex paths
 * "Event Vol" logic: simulates price paths
 */
export const runMonteCarloSimulation = (
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number = 0.04,
  iterations: number = 50000,
  volMultiplier: number = 1.0,
  isTouch: boolean = false // If true, checks if price EVER hits K. If false, checks if price ENDS > K.
): number => {
  if (T <= 0) return S > K ? 1.0 : 0.0;
  
  const effectiveSigma = sigma * volMultiplier;
  const dt = T; // For simple European we can do 1 step. For Touch, we need steps.
  
  // For 'Touch' options (Barrier), we need granular steps. 
  // To keep it performant in JS, we'll do daily steps if T > 1 day, else hourly.
  const steps = isTouch ? Math.max(1, Math.ceil(T * 365)) : 1; 
  const stepDt = T / steps;
  const drift = (r - 0.5 * effectiveSigma * effectiveSigma) * stepDt;
  const volShock = effectiveSigma * Math.sqrt(stepDt);
  
  let successCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    let currentS = S;
    let hit = false;
    
    for (let j = 0; j < steps; j++) {
      const Z = randn_bm();
      currentS = currentS * Math.exp(drift + volShock * Z);
      
      if (isTouch && currentS >= K) {
        hit = true;
        break; 
      }
    }
    
    if (isTouch) {
      if (hit) successCount++;
    } else {
      // European (Close > K)
      if (currentS > K) successCount++;
    }
  }
  
  return successCount / iterations;
};

/**
 * Calculates Spread Percentage
 */
export const calculateSpread = (bid: number, ask: number): number => {
  if (!ask || ask === 0) return 0;
  return ((ask - bid) / ask) * 100;
};
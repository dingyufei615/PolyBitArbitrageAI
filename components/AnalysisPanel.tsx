import React, { useState, useEffect, useMemo } from 'react';
import { DeribitOption, PolyMarket } from '../types';
import { 
  calculateBlackScholesProb, 
  runMonteCarloSimulation, 
  extractStrikePrice, 
  calculateSpread 
} from '../utils/math';
import { Calculator, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface Props {
  spotPrice: number;
  market: PolyMarket;
  polyEventTitle: string;
  matchedOptions: DeribitOption[];
}

const AnalysisPanel: React.FC<Props> = ({ spotPrice, market, polyEventTitle, matchedOptions }) => {
  const [modelType, setModelType] = useState<'BS' | 'MC'>('BS');
  const [volMultiplier, setVolMultiplier] = useState<number>(1.0);
  const [manualStrike, setManualStrike] = useState<string>('');
  const [calculating, setCalculating] = useState(false);
  const [resultProb, setResultProb] = useState<number | null>(null);

  // 1. Determine Strike Price
  const strikePrice = useMemo(() => {
    // Try to extract from specific market question first, then event title
    const s1 = extractStrikePrice(market.question);
    if (s1) return s1;
    const s2 = extractStrikePrice(polyEventTitle);
    if (s2) return s2;
    // Try manual input if parsing fails
    return parseFloat(manualStrike) || 0;
  }, [market.question, polyEventTitle, manualStrike]);

  // 2. Find Relevant Deribit Volatility (Skew Logic)
  // We want the option with strike closest to our target strike
  const relevantOption = useMemo(() => {
    if (!strikePrice || matchedOptions.length === 0) return null;
    
    // Sort by distance to strike
    const sorted = [...matchedOptions].sort((a, b) => {
      const strikeA = parseFloat(a.instrument_name.split('-')[2]);
      const strikeB = parseFloat(b.instrument_name.split('-')[2]);
      return Math.abs(strikeA - strikePrice) - Math.abs(strikeB - strikePrice);
    });
    
    return sorted[0];
  }, [matchedOptions, strikePrice]);

  // 3. Prepare Parameters
  const polyYesPrice = market.bestAsk || 0; // Buying "Yes" means paying the Ask
  const polyNoPrice = market.bestBid || 0;
  
  const timeToExpiry = useMemo(() => {
    const end = new Date(market.endDate).getTime();
    const now = Date.now();
    const diffMs = end - now;
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365)); // Years
  }, [market.endDate]);

  // 4. Calculate Logic
  useEffect(() => {
    if (!strikePrice || !relevantOption) {
      setResultProb(null);
      return;
    }

    setCalculating(true);
    
    // Use a timeout to allow UI to update to "calculating" state for heavy MC
    const timer = setTimeout(() => {
      const sigma = (relevantOption.mark_iv || 0) / 100;
      let prob = 0;

      if (modelType === 'BS') {
        prob = calculateBlackScholesProb(spotPrice, strikePrice, timeToExpiry, sigma);
      } else {
        // Monte Carlo
        // Check if market implies "Touch" or "Close". Defaulting to Close for generic, 
        // but user can infer based on multiplier.
        // Assuming "Close" for now unless text says "Touch".
        const isTouch = market.question.toLowerCase().includes('touch') || market.question.toLowerCase().includes('hit');
        prob = runMonteCarloSimulation(spotPrice, strikePrice, timeToExpiry, sigma, 0.04, 50000, volMultiplier, isTouch);
      }
      
      setResultProb(prob);
      setCalculating(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [spotPrice, strikePrice, timeToExpiry, relevantOption, modelType, volMultiplier]);

  // Spread Check
  const spread = calculateSpread(market.bestBid, market.bestAsk);
  const isLiquidityLow = spread > 5.0; // Warning if spread > 5%

  const edge = resultProb !== null ? (resultProb * 100) - (polyYesPrice * 100) : null;
  const isGoodOpp = edge !== null && edge > 5.0; // >5% edge

  if (!relevantOption && !manualStrike) {
    return (
      <div className="p-4 bg-slate-900/50 rounded-lg text-sm text-slate-400 border border-dashed border-slate-700">
        <div className="flex items-center gap-2 mb-2 text-amber-400">
           <AlertTriangle size={16} />
           <span>Auto-analysis unavailable</span>
        </div>
        <p className="mb-2">Could not automatically extract a valid Strike Price or find matching Deribit Options.</p>
        <div className="flex flex-col gap-1">
            <label className="text-xs">Manual Strike Override:</label>
            <input 
                type="number" 
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white w-32"
                placeholder="e.g. 95000"
                value={manualStrike}
                onChange={(e) => setManualStrike(e.target.value)}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-slate-900 border border-blue-900/30 rounded-lg p-4 animate-fadeIn">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
        <Calculator size={18} className="text-blue-400" />
        <h3 className="font-bold text-slate-200">Probability Engine</h3>
        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 ml-auto">
            Target: ${strikePrice?.toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: Inputs */}
        <div className="space-y-4">
            <div>
                <label className="block text-xs text-slate-500 mb-1">Model Type</label>
                <div className="flex bg-slate-800 rounded p-1">
                    <button 
                        onClick={() => setModelType('BS')}
                        className={`flex-1 text-xs py-1.5 rounded transition-colors ${modelType === 'BS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        European (BS)
                    </button>
                    <button 
                        onClick={() => setModelType('MC')}
                        className={`flex-1 text-xs py-1.5 rounded transition-colors ${modelType === 'MC' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Monte Carlo
                    </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                    {modelType === 'BS' ? 'Standard Black-Scholes for Close price.' : 'Simulated paths. Handles barrier/touch events.'}
                </p>
            </div>

            {modelType === 'MC' && (
                <div>
                    <label className="block text-xs text-slate-500 mb-1">Event Vol Multiplier (x{volMultiplier})</label>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="3.0" 
                        step="0.1" 
                        value={volMultiplier}
                        onChange={(e) => setVolMultiplier(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                </div>
            )}
        </div>

        {/* Column 2: Market Data */}
        <div className="space-y-3 text-sm">
             <div className="flex justify-between">
                <span className="text-slate-500">Spot Price</span>
                <span className="text-slate-200 font-mono">${spotPrice.toLocaleString()}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-slate-500">Deribit IV</span>
                <span className="text-orange-400 font-mono">
                    {relevantOption?.mark_iv.toFixed(1)}%
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-slate-500">Spread Risk</span>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${isLiquidityLow ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {spread.toFixed(2)}%
                </span>
             </div>
             <div className="flex justify-between">
                <span className="text-slate-500">Poly Price (Yes)</span>
                <span className="text-blue-400 font-bold font-mono">
                    {(polyYesPrice * 100).toFixed(1)}%
                </span>
             </div>
        </div>

        {/* Column 3: The Edge */}
        <div className="bg-slate-950 rounded-lg p-3 flex flex-col justify-center items-center text-center relative overflow-hidden border border-slate-800">
            {calculating ? (
                <div className="animate-pulse text-slate-500 text-sm">Running Simulation...</div>
            ) : (
                <>
                    <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Model Probability</span>
                    <span className="text-3xl font-bold text-white mb-2">
                        {resultProb ? (resultProb * 100).toFixed(1) : '-'}%
                    </span>
                    
                    {edge !== null && (
                        <div className={`w-full py-1 mt-2 rounded flex items-center justify-center gap-1 ${isGoodOpp ? 'bg-green-600/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                            <TrendingUp size={14} />
                            <span className="font-bold">Edge: {edge > 0 ? '+' : ''}{edge.toFixed(1)}%</span>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
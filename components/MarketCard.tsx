import React, { useMemo, useState } from 'react';
import { ArbitrageOpportunity, PolyMarket, DeribitOption } from '../types';
import { parsePolymarketOutcomes, convertIsoToDeribitDate } from '../utils/helpers';
import { ChevronDown, ChevronUp, ExternalLink, Activity, TrendingUp, AlertTriangle, ListPlus, Calculator } from 'lucide-react';
import AnalysisPanel from './AnalysisPanel';

interface Props {
  data: ArbitrageOpportunity;
}

// Sub-component for rendering a single outcome bar
const OutcomeBar = ({ outcome, bestBid, bestAsk, isMain = false }: { outcome: any, bestBid: number, bestAsk: number, isMain?: boolean }) => (
  <div className={`${isMain ? 'bg-slate-700/50 p-3' : 'bg-slate-800/50 p-2'} rounded-lg relative overflow-hidden group`}>
     {/* Progress Bar Background */}
     <div 
       className="absolute left-0 top-0 bottom-0 bg-blue-500/10 transition-all duration-500" 
       style={{ width: `${outcome.price * 100}%` }}
     />
     <div className="relative flex justify-between items-center z-10">
        <span className={`font-medium text-slate-200 ${isMain ? 'text-base' : 'text-sm'}`}>{outcome.name}</span>
        <div className="text-right">
          <span className={`${isMain ? 'text-lg' : 'text-base'} font-bold text-blue-400`}>{(outcome.price * 100).toFixed(1)}%</span>
          <div className="text-[10px] text-slate-500">
             {/* Note: bestBid/Ask are often for the 'Yes' outcome in binary markets, strictly displaying raw value here */}
             B: {bestBid} | A: {bestAsk}
          </div>
        </div>
     </div>
  </div>
);

const MarketCard: React.FC<Props> = ({ data }) => {
  const { polyEvent, matchedOptions, spotPrice } = data;
  const [expandedDeribit, setExpandedDeribit] = useState(false);
  const [expandedRelated, setExpandedRelated] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Group matched options by Strike Price
  const optionsByStrike = useMemo(() => {
    const grouped: Record<string, { call?: DeribitOption; put?: DeribitOption }> = {};
    
    matchedOptions.forEach(opt => {
      // Instrument Format: BTC-DDMMMYY-STRIKE-C/P
      const parts = opt.instrument_name.split('-');
      if (parts.length < 4) return;
      const strike = parts[2];
      const type = parts[3]; // C or P
      
      if (!grouped[strike]) grouped[strike] = {};
      if (type === 'C') grouped[strike].call = opt;
      if (type === 'P') grouped[strike].put = opt;
    });

    // Sort by strike price closest to spot
    return Object.entries(grouped).sort((a, b) => {
        return Math.abs(parseInt(a[0]) - spotPrice) - Math.abs(parseInt(b[0]) - spotPrice);
    });
  }, [matchedOptions, spotPrice]);

  // Main Poly Market (Usually the first one is the main binary outcome)
  const mainMarket = polyEvent.markets[0];
  const relatedMarkets = polyEvent.markets.slice(1);
  const deribitDate = convertIsoToDeribitDate(polyEvent.endDate);

  if (!mainMarket) return null;

  const mainOutcomes = parsePolymarketOutcomes(mainMarket.outcomes || "[]", mainMarket.outcomePrices || "[]");

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-6 shadow-lg transition-all hover:border-blue-500/50">
      {/* Header Section - Polymarket Info */}
      <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">POLYMARKET</span>
              <span className="text-slate-400 text-xs font-mono">{polyEvent.ticker}</span>
              <span className="text-slate-500 text-xs ml-auto sm:ml-2">Ends: {new Date(polyEvent.endDate).toLocaleDateString()}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 leading-tight">{polyEvent.title}</h3>
            <p className="text-slate-400 text-sm line-clamp-2">{polyEvent.description}</p>
          </div>
          <div className="ml-4 flex flex-col items-end">
             <div className="text-right mb-2">
                <span className="text-xs text-slate-500 block">Volume</span>
                <span className="text-white font-mono font-medium">${Number(polyEvent.volume).toLocaleString()}</span>
             </div>
          </div>
        </div>

        {/* Main Market Outcomes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {mainOutcomes.map((outcome, idx) => (
            <OutcomeBar 
                key={idx} 
                outcome={outcome} 
                bestBid={mainMarket.bestBid} 
                bestAsk={mainMarket.bestAsk} 
                isMain={true}
            />
          ))}
        </div>
        
        {/* Analysis Toggle Button */}
        <div className="mt-4 flex justify-end">
            <button 
                onClick={() => setShowAnalysis(!showAnalysis)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded border transition-all ${showAnalysis ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-slate-600 text-slate-400 hover:border-blue-500 hover:text-white'}`}
            >
                <Calculator size={14} />
                {showAnalysis ? 'Close Analysis' : 'Analyze Probability & Edge'}
            </button>
        </div>
        
        {/* Analysis Panel */}
        {showAnalysis && (
            <AnalysisPanel 
                spotPrice={spotPrice} 
                market={mainMarket} 
                polyEventTitle={polyEvent.title}
                matchedOptions={matchedOptions}
            />
        )}

        {/* Related Markets Section */}
        {relatedMarkets.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setExpandedRelated(!expandedRelated);
              }}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors w-full group"
            >
              <ListPlus size={14} className="group-hover:text-blue-400"/>
              {expandedRelated ? 'Hide' : 'Show'} {relatedMarkets.length} Related Markets
              {expandedRelated ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expandedRelated && (
              <div className="mt-4 space-y-4 animate-fadeIn pl-2 border-l-2 border-slate-700/50 ml-1">
                {relatedMarkets.map((market) => {
                  const subOutcomes = parsePolymarketOutcomes(market.outcomes || "[]", market.outcomePrices || "[]");
                  return (
                    <div key={market.id} className="group/market">
                       <div className="flex justify-between items-baseline mb-2">
                          <h4 className="text-sm text-slate-300 font-medium">{market.question}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">Vol: ${Number(market.volume).toLocaleString()}</span>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {subOutcomes.map((outcome, idx) => (
                             <OutcomeBar 
                                key={idx} 
                                outcome={outcome} 
                                bestBid={market.bestBid} 
                                bestAsk={market.bestAsk}
                                isMain={false} 
                             />
                          ))}
                       </div>
                       {/* Mini Analysis Button for related markets */}
                       <div className="mt-2 text-right">
                         {/* NOTE: We could add independent analysis panels for related markets here if needed, 
                             but to keep UI clean, we will stick to the main market for now or let the user click a 'focus' button in future. */}
                       </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection & Action Bar */}
      <div 
        className="px-6 py-3 bg-slate-950 border-y border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors"
        onClick={() => setExpandedDeribit(!expandedDeribit)}
      >
        <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-500">
                <Activity size={16} />
            </div>
            <div>
                <span className="text-sm font-semibold text-slate-200">
                    Deribit Volatility Match
                </span>
                <span className="text-xs text-slate-500 ml-2">
                    Found {matchedOptions.length} options for expiry <span className="text-orange-400 font-mono">{deribitDate}</span>
                </span>
            </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs uppercase tracking-wider">
                {expandedDeribit ? 'Hide Chain' : 'View Chain'}
            </span>
            {expandedDeribit ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Deribit Data Section (Expandable) */}
      {expandedDeribit && (
        <div className="bg-slate-950 p-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold text-orange-500 flex items-center gap-2">
                    <TrendingUp size={16}/> 
                    Deribit Option Chain ({deribitDate})
                </h4>
                <div className="text-xs text-slate-400">
                    Spot Price: <span className="text-white font-mono font-bold">${spotPrice.toLocaleString()}</span>
                </div>
            </div>

            {matchedOptions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    <AlertTriangle className="mx-auto mb-2 opacity-50" />
                    No matching options found for expiry date {deribitDate}. <br/>
                    <span className="text-xs">Note: Deribit dates must match DDMMMYY format exactly.</span>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-slate-500 border-b border-slate-800">
                                <th className="p-2 w-1/4">Calls (IV)</th>
                                <th className="p-2 w-1/4 text-right">Bid / Ask</th>
                                <th className="p-2 w-1/6 text-center text-slate-300 font-bold bg-slate-900/50">Strike</th>
                                <th className="p-2 w-1/4 text-left">Puts (IV)</th>
                                <th className="p-2 w-1/4 text-right">Bid / Ask</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-mono">
                            {optionsByStrike.slice(0, 10).map(([strike, { call, put }]) => (
                                <tr key={strike} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                                    {/* Call Side */}
                                    <td className="p-2 text-green-400">
                                        {call ? (
                                            <div className="flex flex-col">
                                                <span>{call.instrument_name.split('-').pop()}</span>
                                                <span className="text-xs text-slate-500">IV: {call.mark_iv}%</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="p-2 text-right text-xs text-slate-400">
                                        {call ? `${call.bid_price || '-'} / ${call.ask_price || '-'}` : ''}
                                    </td>
                                    
                                    {/* Strike */}
                                    <td className={`p-2 text-center font-bold ${Math.abs(Number(strike) - spotPrice) < spotPrice * 0.05 ? 'text-white bg-slate-800' : 'text-slate-500'}`}>
                                        ${Number(strike).toLocaleString()}
                                    </td>

                                    {/* Put Side */}
                                    <td className="p-2 text-red-400">
                                        {put ? (
                                            <div className="flex flex-col">
                                                <span>{put.instrument_name.split('-').pop()}</span>
                                                <span className="text-xs text-slate-500">IV: {put.mark_iv}%</span>
                                            </div>
                                        ) : '-'}
                                    </td>
                                    <td className="p-2 text-right text-xs text-slate-400">
                                        {put ? `${put.bid_price || '-'} / ${put.ask_price || '-'}` : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 text-center text-xs text-slate-500">
                        Showing matched strikes closest to spot price.
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MarketCard;
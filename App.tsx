import React, { useEffect, useState, useCallback } from 'react';
import { fetchDeribitOptions, fetchDeribitSpot, fetchPolymarketData } from './services/api';
import { ArbitrageOpportunity, DeribitOption, PolyEvent } from './types';
import { convertIsoToDeribitDate } from './utils/helpers';
import MarketCard from './components/MarketCard';
import { Search, RefreshCw, Layers, BrainCircuit, Github } from 'lucide-react';

export default function App() {
  const [query, setQuery] = useState('bitcoin price');
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Polymarket Events first (lightweight)
      const polyData = await fetchPolymarketData(query);
      
      if (!polyData.events || polyData.events.length === 0) {
          setOpportunities([]);
          setLoading(false);
          return;
      }

      const polyEvents: PolyEvent[] = polyData.events.map((e: any) => ({
        id: e.id,
        ticker: e.ticker,
        title: e.title,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate,
        volume: e.volume || 0,
        markets: e.markets.map((m: any) => ({
            id: m.id,
            question: m.question,
            outcomes: m.outcomes,
            outcomePrices: m.outcomePrices,
            bestBid: m.bestBid,
            bestAsk: m.bestAsk,
            volume: m.volume,
            endDate: m.endDate
        })),
        image: e.image
      }));

      // 2. Only if we have events, Fetch Deribit Data (Heavy)
      const spotPrice = await fetchDeribitSpot('btc_usdc');
      const deribitOptions = await fetchDeribitOptions('BTC');

      // 3. Match Logic: Polymarket Event Date -> Deribit Expiry
      const matchedData: ArbitrageOpportunity[] = polyEvents.map((polyEvent) => {
         const targetDateCode = convertIsoToDeribitDate(polyEvent.endDate); // e.g., 27DEC24
         
         // Filter Deribit options containing this date code in instrument_name
         const relevantOptions = deribitOptions.filter((opt: DeribitOption) => 
            opt.instrument_name.includes(targetDateCode)
         );

         return {
            polyEvent,
            matchedOptions: relevantOptions,
            spotPrice
         };
      });

      setOpportunities(matchedData);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch market data. Ensure CORS proxy is working or try again.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-tr from-blue-600 to-cyan-400 p-2 rounded-lg">
                    <BrainCircuit className="text-white h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                    PolyBit <span className="font-light">Arbitrage AI</span>
                </h1>
            </div>
            <div className="flex items-center gap-4">
                <a href="#" className="text-slate-500 hover:text-white transition-colors">
                    <Github size={20} />
                </a>
            </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search & Control Header */}
        <div className="mb-10">
            <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Find the Signal in the Noise
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                    Real-time analysis of retail prediction markets vs. institutional option flows.
                    Detect mispriced probabilities instantly.
                </p>
            </div>

            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-200"></div>
                    <div className="relative flex items-center bg-slate-800 rounded-lg p-1">
                        <Search className="ml-3 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 px-4 py-3"
                            placeholder="Search Polymarket (e.g., 'Bitcoin December', 'Ethereum 2024')"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button 
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Scan'}
                        </button>
                    </div>
                </div>
                <p className="text-center text-xs text-slate-500 mt-3">
                    Powered by Gamma API & Deribit v2 Public API via Secure Proxy
                </p>
            </form>
        </div>

        {/* Results Grid */}
        <div className="space-y-6">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-center">
                    {error}
                </div>
            )}

            {!loading && opportunities.length === 0 && !error && (
                <div className="text-center py-20 opacity-50">
                    <Layers size={48} className="mx-auto mb-4 text-slate-600" />
                    <p>No active markets found matching your query.</p>
                </div>
            )}

            {opportunities.map((opp) => (
                <MarketCard key={opp.polyEvent.id} data={opp} />
            ))}
        </div>
      </main>
    </div>
  );
}
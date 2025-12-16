// Polymarket Types
export interface PolyOutcome {
  id: string;
  name: string; // "Yes", "No", or specific name
  price: number;
}

export interface PolyMarket {
  id: string;
  question: string;
  outcomes: string; // JSON string of array or simple string
  outcomePrices: string; // JSON string of array
  bestBid: number;
  bestAsk: number;
  volume: number;
  endDate: string; // ISO String
}

export interface PolyEvent {
  id: string;
  ticker: string;
  title: string; // e.g., "Bitcoin Price on December 16"
  description: string;
  startDate: string;
  endDate: string;
  markets: PolyMarket[];
  image?: string;
  volume: number;
}

export interface PolySearchResponse {
  events: any[]; // Raw events from API need mapping
}

// Deribit Types
export interface DeribitOption {
  instrument_name: string; // e.g., "BTC-27MAR26-300000-C"
  mark_price: number;
  mark_iv: number; // Implied Volatility
  bid_price: number | null;
  ask_price: number | null;
  open_interest: number;
  underlying_price: number;
  underlying_index: string;
  creation_timestamp: number;
}

export interface DeribitResponse {
  jsonrpc: string;
  result: DeribitOption[];
}

export interface DeribitSpotResponse {
  jsonrpc: string;
  result: {
    index_name: string;
    price: number;
    timestamp: number;
  };
}

// Combined/Processed Data for UI
export interface ArbitrageOpportunity {
  polyEvent: PolyEvent;
  matchedOptions: DeribitOption[];
  spotPrice: number;
}
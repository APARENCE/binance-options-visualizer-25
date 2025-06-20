
declare global {
  interface Window {
    LightweightCharts: any;
    tradingChart: any;
    candleSeries: any;
  }
}

export interface BinanceKline {
  t: number; // Kline start time
  T: number; // Kline close time
  s: string; // Symbol
  i: string; // Interval
  f: number; // First trade ID
  L: number; // Last trade ID
  o: string; // Open price
  c: string; // Close price
  h: string; // High price
  l: string; // Low price
  v: string; // Base asset volume
  n: number; // Number of trades
  x: boolean; // Is this kline closed?
  q: string; // Quote asset volume
  V: string; // Taker buy base asset volume
  Q: string; // Taker buy quote asset volume
  B: string; // Ignore
}

export interface BinanceWebSocketMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: BinanceKline;
}

export interface TradingConfig {
  apiKey: string;
  secretKey: string;
  symbol: string;
  interval: string;
}

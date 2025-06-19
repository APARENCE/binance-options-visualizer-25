import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3, Settings, Activity, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Trade {
  id: string;
  type: 'call' | 'put';
  entryPrice: number;
  amount: number;
  timestamp: number;
  duration: number;
  status: 'active' | 'won' | 'lost';
  exitPrice?: number;
  lineSeries?: any;
  symbol: string;
  payout: number;
}

interface PriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const Index = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeAmount, setTradeAmount] = useState<number>(10);
  const [tradeDuration, setTradeDuration] = useState<number>(60);
  const [balance, setBalance] = useState<number>(10000);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [tradeMessage, setTradeMessage] = useState<{ type: 'win' | 'loss'; message: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('forex');
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  const [payout, setPayout] = useState<number>(85);

  // Categorias e moedas organizadas
  const assetCategories = {
    forex: {
      name: 'Forex',
      icon: '💱',
      assets: [
        { value: 'EURUSD', label: 'EUR/USD', flag: '🇪🇺🇺🇸' },
        { value: 'GBPUSD', label: 'GBP/USD', flag: '🇬🇧🇺🇸' },
        { value: 'USDJPY', label: 'USD/JPY', flag: '🇺🇸🇯🇵' },
        { value: 'USDCHF', label: 'USD/CHF', flag: '🇺🇸🇨🇭' },
        { value: 'AUDUSD', label: 'AUD/USD', flag: '🇦🇺🇺🇸' },
        { value: 'USDCAD', label: 'USD/CAD', flag: '🇺🇸🇨🇦' },
        { value: 'NZDUSD', label: 'NZD/USD', flag: '🇳🇿🇺🇸' },
        { value: 'EURGBP', label: 'EUR/GBP', flag: '🇪🇺🇬🇧' },
        { value: 'EURJPY', label: 'EUR/JPY', flag: '🇪🇺🇯🇵' },
        { value: 'GBPJPY', label: 'GBP/JPY', flag: '🇬🇧🇯🇵' },
        { value: 'AUDJPY', label: 'AUD/JPY', flag: '🇦🇺🇯🇵' },
        { value: 'EURAUD', label: 'EUR/AUD', flag: '🇪🇺🇦🇺' }
      ]
    },
    crypto: {
      name: 'Criptomoedas',
      icon: '₿',
      assets: [
        { value: 'BTCUSDT', label: 'Bitcoin', flag: '₿' },
        { value: 'ETHUSDT', label: 'Ethereum', flag: 'Ξ' },
        { value: 'BNBUSDT', label: 'Binance Coin', flag: '🔶' },
        { value: 'ADAUSDT', label: 'Cardano', flag: '🅰️' },
        { value: 'DOTUSDT', label: 'Polkadot', flag: '⚫' },
        { value: 'XRPUSDT', label: 'Ripple', flag: '❌' },
        { value: 'SOLUSDT', label: 'Solana', flag: '🌟' },
        { value: 'AVAXUSDT', label: 'Avalanche', flag: '🔺' }
      ]
    }
  };

  // Opções de expiração
  const expirationOptions = [
    { value: 15, label: '15s' },
    { value: 30, label: '30s' },
    { value: 60, label: '1m' },
    { value: 300, label: '5m' },
    { value: 900, label: '15m' },
    { value: 1800, label: '30m' }
  ];

  // Estatísticas
  const totalTrades = trades.length;
  const wonTrades = trades.filter(t => t.status === 'won').length;
  const lostTrades = trades.filter(t => t.status === 'lost').length;
  const winRate = totalTrades > 0 ? (wonTrades / totalTrades * 100).toFixed(1) : '0';

  useEffect(() => {
    initializeChart();
  }, []);

  useEffect(() => {
    if (chartInstance.current && candleSeriesRef.current) {
      if (wsRef.current) {
        wsRef.current.close();
        setIsConnected(false);
      }
      
      candleSeriesRef.current.setData([]);
      
      if (selectedCategory === 'forex') {
        simulateForexData();
      } else {
        fetchInitialData();
        connectWebSocket();
      }
    }
  }, [symbol, selectedCategory]);

  const initializeChart = () => {
    if (!chartRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
    script.onload = () => {
      createChart();
    };
    
    if (window.LightweightCharts) {
      createChart();
    } else {
      document.head.appendChild(script);
    }
  };

  const createChart = () => {
    if (!chartRef.current || !window.LightweightCharts) return;

    const chart = window.LightweightCharts.createChart(chartRef.current, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: window.LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#333333',
        textColor: '#ffffff',
      },
      timeScale: {
        borderColor: '#333333',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderUpColor: '#00d4aa',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
    });

    chartInstance.current = chart;
    candleSeriesRef.current = candleSeries;

    chart.timeScale().fitContent();
    
    if (selectedCategory === 'forex') {
      simulateForexData();
    } else {
      fetchInitialData();
      connectWebSocket();
    }
  };

  const simulateForexData = () => {
    const forexPrices: { [key: string]: number } = {
      'EURUSD': 1.0850,
      'GBPUSD': 1.2650,
      'USDJPY': 150.25,
      'USDCHF': 0.8850,
      'AUDUSD': 0.6550,
      'USDCAD': 1.3650,
      'NZDUSD': 0.6150,
      'EURGBP': 0.8580,
      'EURJPY': 163.20,
      'GBPJPY': 190.15,
      'AUDJPY': 98.40,
      'EURAUD': 1.6580
    };

    const basePrice = forexPrices[symbol] || 1.0000;
    const data = [];
    
    let currentPrice = basePrice;
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 99; i >= 0; i--) {
      const variation = (Math.random() - 0.5) * 0.001;
      const open = currentPrice;
      const close = open + variation;
      const high = Math.max(open, close) + Math.random() * 0.0005;
      const low = Math.min(open, close) - Math.random() * 0.0005;
      
      data.push({
        time: now - (i * 60),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5))
      });
      
      currentPrice = close;
    }

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(data);
      setCurrentPrice(currentPrice);
      setIsConnected(true);
    }

    const interval = setInterval(() => {
      const variation = (Math.random() - 0.5) * 0.0008;
      const newPrice = currentPrice + variation;
      const newCandle = {
        time: Math.floor(Date.now() / 1000),
        open: currentPrice,
        high: Math.max(currentPrice, newPrice) + Math.random() * 0.0002,
        low: Math.min(currentPrice, newPrice) - Math.random() * 0.0002,
        close: parseFloat(newPrice.toFixed(5))
      };

      if (candleSeriesRef.current) {
        candleSeriesRef.current.update(newCandle);
      }

      setPriceChange(newPrice - currentPrice);
      setCurrentPrice(parseFloat(newPrice.toFixed(5)));
      currentPrice = newPrice;
    }, 1000);

    return () => clearInterval(interval);
  };

  const fetchInitialData = async () => {
    try {
      console.log(`Fetching data for ${symbol}`);
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`);
      const data = await response.json();
      
      const formattedData = data.map((kline: any[]) => ({
        time: kline[0] / 1000,
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
      }));

      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(formattedData);
        const lastPrice = formattedData[formattedData.length - 1].close;
        setCurrentPrice(lastPrice);
        console.log(`${symbol} price updated:`, lastPrice);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao conectar com a API da Binance');
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log(`Connecting to WebSocket for ${symbol}`);
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log(`WebSocket connected for ${symbol}`);
      setIsConnected(true);
      toast.success(`Conectado ao stream da ${symbol}`);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const kline = message.k;
      
      const newPrice = parseFloat(kline.c);
      const oldPrice = currentPrice;
      
      setCurrentPrice(newPrice);
      setPriceChange(newPrice - oldPrice);

      const candle = {
        time: kline.t / 1000,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
      };

      if (candleSeriesRef.current) {
        candleSeriesRef.current.update(candle);
      }
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for ${symbol}`);
      setIsConnected(false);
      if (wsRef.current === ws) {
        toast.error('Conexão perdida. Tentando reconectar...');
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWebSocket();
          }
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  const showTradeResult = (won: boolean, amount: number, payoutPercentage: number) => {
    const profit = won ? (amount * payoutPercentage / 100) : 0;
    const resultMessage = won 
      ? { type: 'win' as const, message: `🎉 GANHOU! +$${profit.toFixed(2)} (${payoutPercentage}%)` }
      : { type: 'loss' as const, message: `❌ PERDEU! -$${amount.toFixed(2)}` };
    
    setTradeMessage(resultMessage);
    
    setTimeout(() => {
      setTradeMessage(null);
    }, 3000);
  };

  const placeTrade = (type: 'call' | 'put') => {
    console.log(`Attempting to place ${type} trade. Connected: ${isConnected}, Amount: ${tradeAmount}, Balance: ${balance}`);
    
    if (tradeAmount > balance) {
      toast.error('Saldo insuficiente');
      return;
    }

    if (tradeAmount <= 0) {
      toast.error('Valor do trade deve ser maior que zero');
      return;
    }

    if (!chartInstance.current) {
      toast.error('Gráfico não carregado');
      return;
    }

    if (currentPrice <= 0) {
      toast.error('Aguarde o preço ser carregado');
      return;
    }

    const lineSeries = chartInstance.current.addLineSeries({
      color: type === 'call' ? '#00d4aa' : '#ff4757',
      lineWidth: 2,
      lineStyle: 1,
    });
    
    lineSeries.setData([{
      time: Math.floor(Date.now() / 1000),
      value: currentPrice
    }]);

    const newTrade: Trade = {
      id: Date.now().toString(),
      type,
      entryPrice: currentPrice,
      amount: tradeAmount,
      timestamp: Date.now(),
      duration: tradeDuration,
      status: 'active',
      lineSeries: lineSeries,
      symbol: symbol,
      payout: payout
    };

    setTrades(prev => [...prev, newTrade]);
    setBalance(prev => prev - tradeAmount);

    toast.success(`Opção ${type.toUpperCase()} de $${tradeAmount} aberta! Payout: ${payout}%`);
    console.log(`Trade placed:`, newTrade);

    setTimeout(() => {
      const finalPrice = currentPrice + (Math.random() - 0.5) * (currentPrice * 0.02);
      const won = (type === 'call' && finalPrice > newTrade.entryPrice) || 
                  (type === 'put' && finalPrice < newTrade.entryPrice);
      
      console.log(`Trade ${newTrade.id} finished. Entry: ${newTrade.entryPrice}, Final: ${finalPrice}, Won: ${won}`);
      
      setTrades(prev => prev.map(t => 
        t.id === newTrade.id 
          ? { ...t, status: won ? 'won' : 'lost', exitPrice: finalPrice }
          : t
      ));

      if (newTrade.lineSeries && chartInstance.current) {
        chartInstance.current.removeSeries(newTrade.lineSeries);
      }

      if (won) {
        const profit = tradeAmount * (payout / 100);
        setBalance(prev => prev + tradeAmount + profit);
        showTradeResult(true, tradeAmount, payout);
      } else {
        showTradeResult(false, tradeAmount, payout);
      }
    }, tradeDuration * 1000);
  };

  const handleDeposit = () => {
    if (accountType === 'demo') {
      toast.error('Para depósitos reais, mude para conta real');
      return;
    }
    toast.success('Redirecionando para depósito...');
  };

  const switchAccountType = (type: 'demo' | 'real') => {
    setAccountType(type);
    if (type === 'demo') {
      setBalance(10000);
      toast.success('Mudou para conta demo');
    } else {
      setBalance(0);
      toast.success('Mudou para conta real');
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const canTrade = currentPrice > 0 && tradeAmount > 0 && tradeAmount <= balance;
  const currentAsset = assetCategories[selectedCategory as keyof typeof assetCategories]?.assets.find(a => a.value === symbol);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Trade Result Message Overlay */}
      {tradeMessage && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 
                        bg-black/95 backdrop-blur-sm border-2 rounded-xl p-8 text-center animate-pulse
                        border-green-500 shadow-lg shadow-green-500/20">
          <div className={`text-4xl font-bold ${tradeMessage.type === 'win' ? 'text-green-400' : 'text-red-400'}`}>
            {tradeMessage.message}
          </div>
        </div>
      )}

      {/* Header - IQ Option Style */}
      <div className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-white">Opções Binárias</h1>
            <Badge variant={isConnected ? "default" : "destructive"} className={`${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
              {isConnected ? 'CONECTADO' : 'DESCONECTADO'}
            </Badge>
          </div>
          <div className="flex items-center space-x-6">
            {/* Account Type Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => switchAccountType('demo')}
                className={`px-4 py-2 text-sm font-medium ${
                  accountType === 'demo' 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                }`}
              >
                DEMO
              </Button>
              <Button
                onClick={() => switchAccountType('real')}
                className={`px-4 py-2 text-sm font-medium ${
                  accountType === 'real' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                }`}
              >
                REAL
              </Button>
            </div>
            
            {/* Deposit Button */}
            <Button
              onClick={handleDeposit}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center space-x-2"
            >
              <CreditCard size={16} />
              <span>DEPÓSITO</span>
            </Button>
            
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Saldo {accountType === 'demo' ? '(Demo)' : '(Real)'}
              </p>
              <p className={`text-2xl font-bold ${accountType === 'demo' ? 'text-orange-400' : 'text-green-400'}`}>
                ${balance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Panel - Trading Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Asset Selection */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center">
                <Activity className="mr-2" size={16} />
                ATIVO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                  <TabsTrigger value="forex" className="text-xs">FOREX</TabsTrigger>
                  <TabsTrigger value="crypto" className="text-xs">CRYPTO</TabsTrigger>
                </TabsList>
                <TabsContent value={selectedCategory} className="mt-3">
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {assetCategories[selectedCategory as keyof typeof assetCategories]?.assets.map((asset) => (
                        <SelectItem key={asset.value} value={asset.value} className="text-white hover:bg-gray-700">
                          <div className="flex items-center space-x-2">
                            <span>{asset.flag}</span>
                            <span>{asset.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Current Price */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <span className="text-lg">{currentAsset?.flag}</span>
                  <span className="text-sm text-gray-400">{currentAsset?.label}</span>
                </div>
                <div className="text-3xl font-mono font-bold text-white">
                  {selectedCategory === 'forex' ? currentPrice.toFixed(5) : currentPrice.toFixed(2)}
                </div>
                <div className={`text-sm font-medium ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{selectedCategory === 'forex' ? priceChange.toFixed(5) : priceChange.toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trade Controls */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium">OPÇÃO BINÁRIA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Valor</label>
                <Input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(Number(e.target.value))}
                  className="bg-gray-800 border-gray-600 text-white h-10"
                  min="1"
                  max={balance}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Expiração</label>
                <Select value={tradeDuration.toString()} onValueChange={(value) => setTradeDuration(Number(value))}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {expirationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()} className="text-white hover:bg-gray-700">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Payout</label>
                <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white">
                  {payout}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => placeTrade('call')}
                  className="bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-bold"
                  disabled={!canTrade}
                >
                  <TrendingUp className="mr-2" size={20} />
                  CALL
                </Button>
                <Button
                  onClick={() => placeTrade('put')}
                  className="bg-red-600 hover:bg-red-700 text-white h-12 text-lg font-bold"
                  disabled={!canTrade}
                >
                  <TrendingDown className="mr-2" size={20} />
                  PUT
                </Button>
              </div>
              {!canTrade && (
                <div className="text-xs text-gray-400 text-center bg-gray-800 p-2 rounded">
                  {currentPrice <= 0 ? 'Aguardando preço...' : 
                   tradeAmount <= 0 ? 'Digite um valor válido' :
                   tradeAmount > balance ? 'Saldo insuficiente' : ''}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center">
                <BarChart3 className="mr-2" size={16} />
                ESTATÍSTICAS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{totalTrades}</div>
                  <div className="text-xs text-gray-400">TRADES</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{winRate}%</div>
                  <div className="text-xs text-gray-400">VITÓRIAS</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-sm font-bold text-green-400">{wonTrades}</div>
                  <div className="text-xs text-gray-400">GANHOS</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-400">{lostTrades}</div>
                  <div className="text-xs text-gray-400">PERDAS</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center - Chart */}
        <div className="lg:col-span-3">
          <Card className="bg-gray-900/50 border-gray-700 h-full">
            <CardContent className="p-4 h-full">
              <div ref={chartRef} className="w-full h-[600px] rounded-lg"></div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Trade History */}
        <div className="lg:col-span-1">
          <Card className="bg-gray-900/50 border-gray-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center">
                <Clock className="mr-2" size={16} />
                OPÇÕES ATIVAS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 max-h-[600px] overflow-y-auto px-4 pb-4">
                {trades.slice(-20).reverse().map((trade) => (
                  <div key={trade.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <Badge 
                        variant={trade.type === 'call' ? 'default' : 'secondary'}
                        className={`text-xs ${trade.type === 'call' ? 'bg-green-600' : 'bg-red-600'}`}
                      >
                        {trade.type.toUpperCase()}
                      </Badge>
                      <Badge 
                        variant={
                          trade.status === 'active' ? 'outline' :
                          trade.status === 'won' ? 'default' : 'destructive'
                        }
                        className={`text-xs ${
                          trade.status === 'won' ? 'bg-green-600' : 
                          trade.status === 'lost' ? 'bg-red-600' : 'border-gray-500'
                        }`}
                      >
                        {trade.status === 'active' ? 'ATIVO' :
                         trade.status === 'won' ? 'GANHOU' : 'PERDEU'}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Valor:</span>
                        <span className="text-white">${trade.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payout:</span>
                        <span className="text-white">{trade.payout}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Entrada:</span>
                        <span className="text-white">
                          {selectedCategory === 'forex' ? trade.entryPrice.toFixed(5) : trade.entryPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ativo:</span>
                        <span className="text-white">{trade.symbol}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {trades.length === 0 && (
                  <div className="text-center text-gray-400 py-8 text-sm">
                    Nenhuma opção ativa
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;

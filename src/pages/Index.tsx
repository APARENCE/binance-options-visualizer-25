import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3, Settings } from 'lucide-react';
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
  lineSeries?: any; // Reference to the chart line
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
  const [balance, setBalance] = useState<number>(1000);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [tradeMessage, setTradeMessage] = useState<{ type: 'win' | 'loss'; message: string } | null>(null);

  // Opções de moedas disponíveis
  const currencyOptions = [
    { value: 'BTCUSDT', label: 'Bitcoin (BTC/USDT)' },
    { value: 'ETHUSDT', label: 'Ethereum (ETH/USDT)' },
    { value: 'BNBUSDT', label: 'Binance Coin (BNB/USDT)' },
    { value: 'ADAUSDT', label: 'Cardano (ADA/USDT)' },
    { value: 'DOTUSDT', label: 'Polkadot (DOT/USDT)' },
    { value: 'XRPUSDT', label: 'Ripple (XRP/USDT)' },
    { value: 'SOLUSDT', label: 'Solana (SOL/USDT)' },
    { value: 'AVAXUSDT', label: 'Avalanche (AVAX/USDT)' },
    { value: 'MATICUSDT', label: 'Polygon (MATIC/USDT)' },
    { value: 'LINKUSDT', label: 'Chainlink (LINK/USDT)' },
    { value: 'LTCUSDT', label: 'Litecoin (LTC/USDT)' },
    { value: 'UNIUSDT', label: 'Uniswap (UNI/USDT)' },
    { value: 'ATOMUSDT', label: 'Cosmos (ATOM/USDT)' },
    { value: 'VETUSDT', label: 'VeChain (VET/USDT)' },
    { value: 'FTMUSDT', label: 'Fantom (FTM/USDT)' }
  ];

  // Opções de expiração
  const expirationOptions = [
    { value: 5, label: '5 segundos' },
    { value: 30, label: '30 segundos' },
    { value: 60, label: '1 minuto' },
    { value: 300, label: '5 minutos' },
    { value: 600, label: '10 minutos' }
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
      // Close existing WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        setIsConnected(false);
      }
      
      // Clear existing chart data
      candleSeriesRef.current.setData([]);
      
      // Fetch new data for the selected symbol
      fetchInitialData();
      connectWebSocket();
    }
  }, [symbol]);

  const initializeChart = () => {
    if (!chartRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
    script.onload = () => {
      createChart();
    };
    
    // Check if script is already loaded
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
        background: { color: '#1a1a1a' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      crosshair: {
        mode: window.LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#485158',
      },
      timeScale: {
        borderColor: '#485158',
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff4757',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff4757',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4757',
    });

    chartInstance.current = chart;
    candleSeriesRef.current = candleSeries;

    chart.timeScale().fitContent();
    
    // Fetch initial data after chart is created
    fetchInitialData();
    connectWebSocket();
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
    // Close existing connection
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
      if (wsRef.current === ws) { // Only reconnect if this is the current connection
        toast.error('Conexão perdida. Tentando reconectar...');
        setTimeout(() => {
          if (wsRef.current === ws) { // Double check before reconnecting
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

  const showTradeResult = (won: boolean, amount: number) => {
    const resultMessage = won 
      ? { type: 'win' as const, message: `🎉 VITÓRIA! +$${(amount * 0.8).toFixed(2)}` }
      : { type: 'loss' as const, message: `❌ DERROTA! -$${amount.toFixed(2)}` };
    
    setTradeMessage(resultMessage);
    
    // Remove a mensagem após 3 segundos
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

    // Adicionar linha no gráfico
    const lineSeries = chartInstance.current.addLineSeries({
      color: type === 'call' ? '#00ff88' : '#ff4757',
      lineWidth: 2,
      lineStyle: 1, // dashed
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
      lineSeries: lineSeries // Store reference to the line
    };

    setTrades(prev => [...prev, newTrade]);
    setBalance(prev => prev - tradeAmount);

    toast.success(`Trade ${type.toUpperCase()} de $${tradeAmount} colocado!`);
    console.log(`Trade placed:`, newTrade);

    // Simular resultado do trade após duração
    setTimeout(() => {
      const finalPrice = currentPrice + (Math.random() - 0.5) * (currentPrice * 0.02); // 2% variation
      const won = (type === 'call' && finalPrice > newTrade.entryPrice) || 
                  (type === 'put' && finalPrice < newTrade.entryPrice);
      
      console.log(`Trade ${newTrade.id} finished. Entry: ${newTrade.entryPrice}, Final: ${finalPrice}, Won: ${won}`);
      
      setTrades(prev => prev.map(t => 
        t.id === newTrade.id 
          ? { ...t, status: won ? 'won' : 'lost', exitPrice: finalPrice }
          : t
      ));

      // Remove the line from chart
      if (newTrade.lineSeries && chartInstance.current) {
        chartInstance.current.removeSeries(newTrade.lineSeries);
      }

      if (won) {
        setBalance(prev => prev + tradeAmount * 1.8); // 80% payout
        showTradeResult(true, tradeAmount);
      } else {
        showTradeResult(false, tradeAmount);
      }
    }, tradeDuration * 1000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Check if buttons should be enabled
  const canTrade = currentPrice > 0 && tradeAmount > 0 && tradeAmount <= balance;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Trade Result Message Overlay */}
      {tradeMessage && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 
                        bg-black/90 backdrop-blur-sm border-2 rounded-lg p-6 text-center animate-pulse">
          <div className={`text-3xl font-bold ${tradeMessage.type === 'win' ? 'text-green-400' : 'text-red-400'}`}>
            {tradeMessage.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
              Binary Options Trading
            </h1>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Saldo</p>
              <p className="text-xl font-bold text-green-400">${balance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de Configurações e Trading */}
        <div className="lg:col-span-1 space-y-6">
          {/* Seletor de Moeda */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Settings className="mr-2" size={20} />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Moeda</label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="bg-black/30 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-700">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BarChart3 className="mr-2" size={20} />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Total de Trades:</span>
                <span className="text-white font-bold">{totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Taxa de Vitória:</span>
                <span className="text-green-400 font-bold">{winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vencidos:</span>
                <span className="text-green-400 font-bold">{wonTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Perdidos:</span>
                <span className="text-red-400 font-bold">{lostTrades}</span>
              </div>
            </CardContent>
          </Card>

          {/* Painel de Trading */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <DollarSign className="mr-2" size={20} />
                Novo Trade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Valor do Trade</label>
                <Input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(Number(e.target.value))}
                  className="bg-black/30 border-white/20 text-white"
                  min="1"
                  max={balance}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Expiração</label>
                <Select value={tradeDuration.toString()} onValueChange={(value) => setTradeDuration(Number(value))}>
                  <SelectTrigger className="bg-black/30 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    {expirationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()} className="text-white hover:bg-gray-700">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => placeTrade('call')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={!canTrade}
                >
                  <TrendingUp className="mr-2" size={16} />
                  CALL
                </Button>
                <Button
                  onClick={() => placeTrade('put')}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={!canTrade}
                >
                  <TrendingDown className="mr-2" size={16} />
                  PUT
                </Button>
              </div>
              {!canTrade && (
                <div className="text-xs text-gray-400 text-center">
                  {currentPrice <= 0 ? 'Aguardando preço...' : 
                   tradeAmount <= 0 ? 'Digite um valor válido' :
                   tradeAmount > balance ? 'Saldo insuficiente' : ''}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preço Atual */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white">{symbol}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${currentPrice.toFixed(2)}</div>
              <div className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico e Histórico */}
        <div className="lg:col-span-3 space-y-6">
          {/* Gráfico */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Gráfico {symbol}</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={chartRef} className="w-full h-96 rounded-lg overflow-hidden"></div>
            </CardContent>
          </Card>

          {/* Histórico de Trades */}
          <Card className="bg-black/20 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Clock className="mr-2" size={20} />
                Histórico de Trades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {trades.slice(-10).reverse().map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={trade.type === 'call' ? 'default' : 'secondary'}>
                        {trade.type.toUpperCase()}
                      </Badge>
                      <span className="text-white">${trade.amount}</span>
                      <span className="text-gray-400">${trade.entryPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={
                          trade.status === 'active' ? 'outline' :
                          trade.status === 'won' ? 'default' : 'destructive'
                        }
                      >
                        {trade.status === 'active' ? 'Ativo' :
                         trade.status === 'won' ? 'Vencido' : 'Perdido'}
                      </Badge>
                      <span className="text-sm text-gray-400">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                {trades.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    Nenhum trade realizado ainda
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

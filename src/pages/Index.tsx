
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeAmount, setTradeAmount] = useState<number>(10);
  const [tradeDuration, setTradeDuration] = useState<number>(60);
  const [balance, setBalance] = useState<number>(1000);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [apiKey] = useState<string>('NejPBydFIlb1xy5YZHErSdN7FqUhKheeaLxBEzu7hOLdVsLBA3Sey0HOFqbRm9yc');
  const [secretKey] = useState<string>('nqBc2HxnDvDj6LI9VvtbH9266xxJfEJyGkspFk5RugzlzT17iuFWADGeQRBneIMH');

  // Estatísticas
  const totalTrades = trades.length;
  const wonTrades = trades.filter(t => t.status === 'won').length;
  const lostTrades = trades.filter(t => t.status === 'lost').length;
  const winRate = totalTrades > 0 ? (wonTrades / totalTrades * 100).toFixed(1) : '0';

  useEffect(() => {
    initializeChart();
    connectWebSocket();
    fetchInitialData();
  }, [symbol]);

  const initializeChart = () => {
    if (!chartRef.current) return;

    // Criar gráfico com Lightweight Charts
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
    script.onload = () => {
      createChart();
    };
    document.head.appendChild(script);
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

    // Salvar referência do gráfico
    (window as any).tradingChart = chart;
    (window as any).candleSeries = candleSeries;

    chart.timeScale().fitContent();
  };

  const fetchInitialData = async () => {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=100`);
      const data = await response.json();
      
      const formattedData = data.map((kline: any[]) => ({
        time: kline[0] / 1000,
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
      }));

      if ((window as any).candleSeries) {
        (window as any).candleSeries.setData(formattedData);
        setCurrentPrice(formattedData[formattedData.length - 1].close);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao conectar com a API da Binance');
    }
  };

  const connectWebSocket = () => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`);
    
    ws.onopen = () => {
      setIsConnected(true);
      toast.success('Conectado ao stream da Binance');
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

      if ((window as any).candleSeries) {
        (window as any).candleSeries.update(candle);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      toast.error('Conexão perdida. Tentando reconectar...');
      setTimeout(connectWebSocket, 3000);
    };
  };

  const placeTrade = (type: 'call' | 'put') => {
    if (tradeAmount > balance) {
      toast.error('Saldo insuficiente');
      return;
    }

    const newTrade: Trade = {
      id: Date.now().toString(),
      type,
      entryPrice: currentPrice,
      amount: tradeAmount,
      timestamp: Date.now(),
      duration: tradeDuration,
      status: 'active'
    };

    setTrades(prev => [...prev, newTrade]);
    setBalance(prev => prev - tradeAmount);

    // Adicionar linha no gráfico
    if ((window as any).tradingChart) {
      const lineSeries = (window as any).tradingChart.addLineSeries({
        color: type === 'call' ? '#00ff88' : '#ff4757',
        lineWidth: 2,
        lineStyle: 1, // dashed
      });
      
      lineSeries.setData([{
        time: Math.floor(Date.now() / 1000),
        value: currentPrice
      }]);
    }

    toast.success(`Trade ${type.toUpperCase()} de $${tradeAmount} colocado!`);

    // Simular resultado do trade após duração
    setTimeout(() => {
      const finalPrice = currentPrice + (Math.random() - 0.5) * 100; // Simulação
      const won = (type === 'call' && finalPrice > newTrade.entryPrice) || 
                  (type === 'put' && finalPrice < newTrade.entryPrice);
      
      setTrades(prev => prev.map(t => 
        t.id === newTrade.id 
          ? { ...t, status: won ? 'won' : 'lost', exitPrice: finalPrice }
          : t
      ));

      if (won) {
        setBalance(prev => prev + tradeAmount * 1.8); // 80% payout
        toast.success(`Trade vencido! +$${(tradeAmount * 0.8).toFixed(2)}`);
      } else {
        toast.error(`Trade perdido! -$${tradeAmount}`);
      }
    }, tradeDuration * 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
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
        {/* Painel de Estatísticas */}
        <div className="lg:col-span-1 space-y-6">
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
                <label className="text-sm text-gray-400 mb-2 block">Duração (segundos)</label>
                <Input
                  type="number"
                  value={tradeDuration}
                  onChange={(e) => setTradeDuration(Number(e.target.value))}
                  className="bg-black/30 border-white/20 text-white"
                  min="30"
                  max="300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => placeTrade('call')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={!isConnected || tradeAmount > balance}
                >
                  <TrendingUp className="mr-2" size={16} />
                  CALL
                </Button>
                <Button
                  onClick={() => placeTrade('put')}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={!isConnected || tradeAmount > balance}
                >
                  <TrendingDown className="mr-2" size={16} />
                  PUT
                </Button>
              </div>
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

        {/* Gráfico */}
        <div className="lg:col-span-3 space-y-6">
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

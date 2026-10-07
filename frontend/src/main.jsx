import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import MarketChart from "./components/MarketChart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const BINANCE_DATA_BASE = "https://data-api.binance.vision";
const BINANCE_REST_BASES = [BINANCE_DATA_BASE, "https://api.binance.com", API_BASE];
const BINANCE_STREAM_BASE = "wss://data-stream.binance.vision/ws";

const markets = [
  ["BTC/USDT", "67,842.10", "+2.41%"],
  ["ETH/USDT", "3,842.18", "+1.84%"],
  ["SOL/USDT", "168.42", "-0.72%"],
  ["BNB/USDT", "612.80", "+0.38%"],
];

function App() {
  const [ticker, setTicker] = useState(null);
  const [connected, setConnected] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [chartConnected, setChartConnected] = useState(false);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [candles, setCandles] = useState([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [amount, setAmount] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [authMode, setAuthMode] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [exchangeName, setExchangeName] = useState("binance");
  const [marketType, setMarketType] = useState("spot");
  const [leverage, setLeverage] = useState(10);
  const [marginMode, setMarginMode] = useState("isolated");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [exchangeMessage, setExchangeMessage] = useState("");
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [balanceView, setBalanceView] = useState("available");
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    const loadCandles = async () => {
      setMarketLoading(true);
      setMarketError("");

      const normalizedSymbol = symbol.replace("/", "").toUpperCase();
      const query = new URLSearchParams({ symbol: normalizedSymbol, interval: timeframe, limit: "120" });
      let lastError = null;

      for (const base of BINANCE_REST_BASES) {
        try {
          const isBackend = base === API_BASE;
          const url = isBackend
            ? `${API_BASE}/api/v1/market/ohlcv/${normalizedSymbol}?timeframe=${timeframe}&limit=120`
            : `${base}/api/v3/klines?${query.toString()}`;
          const response = await fetch(url, { signal: controller.signal });

          if (!response.ok) {
            lastError = new Error(`Market feed returned ${response.status}`);
            continue;
          }

          const payload = await response.json();
          const rawCandles = Array.isArray(payload) ? payload : payload.candles;
          if (!Array.isArray(rawCandles) || rawCandles.length < 2) {
            lastError = new Error("Market feed returned no candle data.");
            continue;
          }

          const normalized = rawCandles.map((candle) => ({
            timestamp: Number(candle.timestamp ?? candle[0]),
            open: Number(candle.open ?? candle[1]),
            high: Number(candle.high ?? candle[2]),
            low: Number(candle.low ?? candle[3]),
            close: Number(candle.close ?? candle[4]),
            volume: Number(candle.volume ?? candle[5]),
          })).filter((candle) => Number.isFinite(candle.timestamp) && Number.isFinite(candle.close));

          if (normalized.length < 2) {
            lastError = new Error("Market feed returned invalid candle data.");
            continue;
          }

          setCandles(normalized.slice(-120));
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
          lastError = error;
        }
      }

      throw lastError || new Error("Unable to load live market data.");
    };

    loadCandles()
      .catch((error) => {
        if (error.name !== "AbortError") {
          setCandles([]);
          setMarketError(error.message);
        }
      })
      .finally(() => setMarketLoading(false));

    return () => controller.abort();
  }, [symbol, timeframe]);

  useEffect(() => {
    const normalizedSymbol = symbol.replace("/", "").toLowerCase();
    let tickerSocket;
    let klineSocket;
    let retryTicker;
    let retryKline;
    let disposed = false;

    const upsertKline = (event) => {
      if (!event?.k) return;
      const k = event.k;
      const nextCandle = {
        timestamp: Number(k.t),
        open: Number(k.o),
        high: Number(k.h),
        low: Number(k.l),
        close: Number(k.c),
        volume: Number(k.v),
      };

      if (!Number.isFinite(nextCandle.timestamp) || !Number.isFinite(nextCandle.close)) return;

      setCandles((current) => {
        const next = current.length ? [...current] : [];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex].timestamp === nextCandle.timestamp) {
          next[lastIndex] = nextCandle;
        } else {
          const existingIndex = next.findIndex((item) => item.timestamp === nextCandle.timestamp);
          if (existingIndex >= 0) next[existingIndex] = nextCandle;
          else next.push(nextCandle);
        }
        return next.slice(-120);
      });

      setTicker((current) => ({
        ...(current || {}),
        type: "ticker",
        symbol: event.s || symbol,
        last: nextCandle.close,
      }));
    };

    const connectTicker = () => {
      if (disposed) return;
      try {
        tickerSocket = new WebSocket(`${BINANCE_STREAM_BASE}/${normalizedSymbol}@ticker`);
        tickerSocket.onopen = () => setConnected(true);
        tickerSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setTicker({
              type: "ticker",
              symbol: data.s || symbol,
              last: Number(data.c),
              bid: Number(data.b),
              ask: Number(data.a),
              high: Number(data.h),
              low: Number(data.l),
              volume: Number(data.v),
            });
          } catch {}
        };
        tickerSocket.onerror = () => setConnected(false);
        tickerSocket.onclose = () => {
          setConnected(false);
          if (!disposed) retryTicker = setTimeout(connectTicker, 1500);
        };
      } catch {
        setConnected(false);
        if (!disposed) retryTicker = setTimeout(connectTicker, 1500);
      }
    };

    const connectKline = () => {
      if (disposed) return;
      try {
        klineSocket = new WebSocket(`${BINANCE_STREAM_BASE}/${normalizedSymbol}@kline_${timeframe}`);
        klineSocket.onopen = () => {
          setChartConnected(true);
          setMarketError("");
        };
        klineSocket.onmessage = (event) => {
          try {
            upsertKline(JSON.parse(event.data));
          } catch {}
        };
        klineSocket.onerror = () => setChartConnected(false);
        klineSocket.onclose = () => {
          setChartConnected(false);
          if (!disposed) retryKline = setTimeout(connectKline, 1500);
        };
      } catch {
        setChartConnected(false);
        if (!disposed) retryKline = setTimeout(connectKline, 1500);
      }
    };

    connectTicker();
    connectKline();

    return () => {
      disposed = true;
      clearTimeout(retryTicker);
      clearTimeout(retryKline);
      tickerSocket?.close();
      klineSocket?.close();
      setConnected(false);
      setChartConnected(false);
    };
  }, [symbol, timeframe]);

  const submitAuth = async () => {
    setAuthMessage("Connecting...");
    const endpoint = authMode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const payload = authMode === "register" ? { full_name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword };
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        const validationMessage = Array.isArray(data.errors) && data.errors.length
          ? data.errors.map((item) => item.msg || item.message).filter(Boolean).join(", ")
          : "";
        throw new Error(data.message || data.detail || validationMessage || "Authentication failed");
      }
      if (authMode === "login") {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
      }
      setAuthMessage(authMode === "register" ? "Account created. You can now sign in." : "Signed in successfully.");
      if (authMode === "login") setAuthMode(null);
    } catch (error) { setAuthMessage(error.message); }
  };

  const accessToken = localStorage.getItem("access_token");

  const loadBalance = async (exchangeId) => {
    if (!accessToken || !exchangeId) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/exchange/${exchangeId}/balance`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error("Unable to load balance.");
      const data = await response.json();
      setBalance(data.balances || {});
      setSelectedExchangeId(exchangeId);
    } catch (error) {
      setExchangeMessage(error.message);
    }
  };

  const loadTradingData = async (exchangeId) => {
    if (!accessToken || !exchangeId) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    try {
      const [positionsResponse, openResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE}/api/v1/exchange/${exchangeId}/positions`, { headers }),
        fetch(`${API_BASE}/api/v1/orders/${exchangeId}/open?symbol=${encodeURIComponent(symbol.replace("/", ""))}`, { headers }),
        fetch(`${API_BASE}/api/v1/orders/${exchangeId}/history?symbol=${encodeURIComponent(symbol.replace("/", ""))}`, { headers }),
      ]);
      if (positionsResponse.ok) {
        const data = await positionsResponse.json();
        setPositions(data.positions || []);
      } else {
        setPositions([]);
      }
      if (openResponse.ok) {
        const data = await openResponse.json();
        setOpenOrders(data.orders || []);
      } else {
        setOpenOrders([]);
      }
      if (historyResponse.ok) {
        const data = await historyResponse.json();
        setOrderHistory(data.orders || []);
      } else {
        setOrderHistory([]);
      }
    } catch {
      setPositions([]);
      setOpenOrders([]);
      setOrderHistory([]);
    }
  };

  const loadExchanges = async () => {
    if (!accessToken) { setExchangeMessage("Sign in first to connect an exchange."); return; }
    const response = await fetch(`${API_BASE}/api/v1/exchange`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) { setExchangeMessage("Unable to load connected exchanges."); return; }
    setExchanges(await response.json());
  };

  const connectExchange = async () => {
    if (!accessToken) {
      setExchangeMessage("Sign in first.");
      setAuthMode("login");
      return;
    }
    setExchangeMessage("Connecting...");
    try {
      const response = await fetch(`${API_BASE}/api/v1/exchange`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ exchange_name: exchangeName, market_type: marketType, api_key: apiKey, api_secret: apiSecret }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Exchange connection failed");
      setApiKey(""); setApiSecret("");
      setExchangeMessage("Exchange connected securely.");
      await loadExchanges();
    } catch (error) { setExchangeMessage(error.message); }
  };

  useEffect(() => {
    if (selectedExchangeId) {
      loadTradingData(selectedExchangeId);
    }
  }, [selectedExchangeId, symbol]);

  const price = ticker?.last ?? 67842.10;
  const high = ticker?.high ?? 68421.90;
  const low = ticker?.low ?? 65903.20;
  const volume = ticker?.volume ?? 2.84e9;

  const chartGeometry = useMemo(() => {
    if (candles.length < 2) return null;

    const visible = candles.slice(-80);
    const highs = visible.map((candle) => candle.high);
    const lows = visible.map((candle) => candle.low);
    const volumes = visible.map((candle) => candle.volume || 0);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const priceRange = Math.max(maxPrice - minPrice, maxPrice * 0.0001, 1);
    const maxVolume = Math.max(...volumes, 1);
    const top = 20;
    const priceBottom = 292;
    const volumeTop = 308;
    const volumeBottom = 350;
    const slot = 900 / visible.length;
    const y = (value) => top + ((maxPrice - value) / priceRange) * (priceBottom - top);

    const points = visible.map((candle, index) => {
      const x = index * slot + slot / 2;
      const openY = y(candle.open);
      const closeY = y(candle.close);
      const highY = y(candle.high);
      const lowY = y(candle.low);
      const volumeHeight = ((candle.volume || 0) / maxVolume) * (volumeBottom - volumeTop);
      return {
        ...candle,
        x,
        highY,
        lowY,
        bodyY: Math.min(openY, closeY),
        bodyHeight: Math.max(Math.abs(closeY - openY), 1.5),
        volumeY: volumeBottom - volumeHeight,
        volumeHeight,
        bullish: candle.close >= candle.open,
      };
    });

    const tickValues = Array.from({ length: 5 }, (_, index) =>
      maxPrice - (priceRange * index) / 4
    );

    return { points, tickValues };
  }, [candles]);

  const effectivePrice = Number(priceInput || price || 0);
  const estimatedCost = Number(amount || 0) * effectivePrice;

  const previewOrder = () => {
    setOrderMessage("");
    const quantity = Number(amount);
    const selectedPrice = Number(priceInput || price);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setOrderMessage("Enter a valid amount.");
      return;
    }
    if (orderType === "limit" && (!Number.isFinite(selectedPrice) || selectedPrice <= 0)) {
      setOrderMessage("Enter a valid limit price.");
      return;
    }
    if (!selectedExchangeId) {
      setOrderMessage("Connect and select an exchange first.");
      return;
    }
    setPreviewOpen(true);
  };

  const formattedPrice = useMemo(
    () => Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [price]
  );

  return (
    <main className="terminal">
      <header className="topbar">
        <div className="brand">TRADE<span>LAB</span></div>
        <div className="search">⌕ Search markets</div>
        <div className="status"><i className={connected ? "online" : ""} /> {connected ? "Live market data" : "Demo market data"}<small>{connected ? "WS" : "Fallback"}</small></div>
        <button className="profile" onClick={() => {
          if (accessToken) {
            setExchangeOpen(true);
            setExchangeMessage("");
            loadExchanges();
          } else {
            setAuthMode("login");
            setAuthMessage("");
          }
        }}>RK</button>
      </header>

      <section className="marketbar">
        <div className="pair"><strong>{symbol}</strong><small>Bitcoin / Tether</small></div>
        <div><b>${formattedPrice}</b><small className="up">Live</small></div>
        <div><small>24h High</small><b>${Number(high).toLocaleString()}</b></div>
        <div><small>24h Low</small><b>${Number(low).toLocaleString()}</b></div>
        <div><small>24h Volume</small><b>${(Number(volume) / 1e9).toFixed(2)}B</b></div>
      </section>

      <section className="workspace">
        <aside className="markets panel">
          <div className="panel-title"><b>Markets</b><span>Spot</span></div>
          <input placeholder="Search pair" />
          {markets.map(([pair, fallbackPrice, change]) => (
            <button className="market-row market-button" key={pair} onClick={() => setSymbol(pair)}>
              <div><b>{pair}</b><small>USDT</small></div>
              <strong>{pair === symbol ? formattedPrice : fallbackPrice}</strong>
              <em className={change.startsWith("-") ? "down" : "up"}>{change}</em>
            </button>
          ))}
        </aside>

        <section className="chart panel">
          <div className="panel-title">
            <b>{symbol} · {timeframe.toUpperCase()}</b>
            <div className="tabs chart-timeframes">
              {["1m", "5m", "15m", "1h", "4h", "1d"].map((value) => (
                <button
                  key={value}
                  className={timeframe === value ? "tab active" : "tab"}
                  onClick={() => setTimeframe(value)}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <MarketChart
            candles={candles}
            symbol={symbol}
            connected={chartConnected}
            loading={marketLoading}
            error={marketError}
          />
        </section>

        <aside className="order panel">
          <div className="panel-title"><b>Order</b><span>{marketType === "usdm" ? "USDT-M" : marketType === "coinm" ? "Coin-M" : "Spot"}</span></div>
          {marketType !== "spot" && (
            <div className="futures-controls">
              <label>Margin mode
                <select value={marginMode} onChange={(e) => setMarginMode(e.target.value)}>
                  <option value="isolated">Isolated</option>
                  <option value="cross">Cross</option>
                </select>
              </label>
              <label>Leverage
                <select value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}>
                  {[1, 2, 3, 5, 10, 20, 25, 50, 75, 100].map((value) => <option key={value} value={value}>{value}×</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="segmented"><button className={side === "buy" ? "active buy" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell</button></div>
          <div className="balance-card">
            <div className="balance-top"><span>{marketType === "spot" ? "Spot account" : "Futures account"}</span><b>{balance?.free?.USDT != null ? `${Number(balance.free.USDT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Connect exchange"}</b></div>
            <div className="balance-tabs">
              <button className={balanceView === "available" ? "active" : ""} onClick={() => setBalanceView("available")}>Available</button>
              <button className={balanceView === "total" ? "active" : ""} onClick={() => setBalanceView("total")}>Total</button>
            </div>
            <small>{balanceView === "available" ? "Free USDT balance" : "Account balance snapshot"}</small>
          </div>
          <label>Order type<select value={orderType} onChange={(e) => { setOrderType(e.target.value); setOrderMessage(""); }}><option value="limit">Limit</option><option value="market">Market</option></select></label>
          <label>Price<input value={orderType === "market" ? "Market price" : priceInput || Number(price).toFixed(2)} onChange={(e) => setPriceInput(e.target.value)} readOnly={orderType === "market"} /></label>
          <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`0.00 ${symbol.split("/")[0]}`} /></label>
          <div className="slider"><span /><span /><span /><span /><span /></div>
          <div className="summary"><span>Est. cost</span><b>{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</b></div>
          {marketType !== "spot" && (
            <div className="summary futures-summary">
              <span>Est. margin</span>
              <b>{(estimatedCost / leverage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</b>
            </div>
          )}
          {orderMessage && <div className="order-message">{orderMessage}</div>}
          <button className="primary" onClick={previewOrder}>{side === "buy" ? "Preview Buy" : "Preview Sell"} {symbol.split("/")[0]}</button>
        </aside>
      </section>

      <section className="bottom panel">
        <div className="panel-title">
          <b>Positions & Orders</b>
          <div className="tabs">
            <button className={activeTab === "positions" ? "tab active" : "tab"} onClick={() => setActiveTab("positions")}>Positions</button>
            <button className={activeTab === "open" ? "tab active" : "tab"} onClick={() => setActiveTab("open")}>Open Orders</button>
            <button className={activeTab === "history" ? "tab active" : "tab"} onClick={() => setActiveTab("history")}>Order History</button>
          </div>
        </div>
        {!selectedExchangeId && (
          <div className="empty"><strong>Connect an exchange</strong><span>Select a connected exchange to load your trading data.</span></div>
        )}
        {selectedExchangeId && activeTab === "positions" && (
          positions.length ? <div className="position-list">{positions.map((item, index) => {
            const positionSide = String(item.side || "—").toUpperCase();
            const contracts = Number(item.contracts ?? item.amount ?? item.quantity ?? 0);
            const entry = Number(item.entryPrice ?? item.entry_price ?? 0);
            const mark = Number(item.markPrice ?? item.mark_price ?? price);
            const pnl = Number(item.unrealizedPnl ?? item.unrealized_pnl ?? 0);
            const margin = Number(item.margin ?? 0);
            const roi = margin > 0 ? (pnl / margin) * 100 : null;
            const liquidation = item.liquidationPrice ?? item.liquidation_price;
            const isLong = positionSide === "LONG";
            return (
              <article className="position-card" key={item.id || item.symbol || index}>
                <div className="position-head">
                  <div><b>{item.symbol || "—"}</b><span className={isLong ? "position-long" : "position-short"}>{positionSide}</span></div>
                  <strong className={pnl >= 0 ? "up" : "down"}>{pnl.toFixed(2)} USDT</strong>
                </div>
                <div className="position-grid">
                  <div><span>Size</span><b>{contracts || "—"}</b></div>
                  <div><span>Entry</span><b>{entry ? entry.toLocaleString() : "—"}</b></div>
                  <div><span>Mark</span><b>{mark ? mark.toLocaleString() : "—"}</b></div>
                  <div><span>Margin</span><b>{margin ? margin.toLocaleString() : "—"}</b></div>
                  <div><span>Leverage</span><b>{item.leverage ? `${item.leverage}×` : "—"}</b></div>
                  <div><span>ROI</span><b className={pnl >= 0 ? "up" : "down"}>{roi === null ? "—" : `${roi.toFixed(2)}%`}</b></div>
                </div>
                <div className="position-foot"><span>Liquidation Price</span><b>{liquidation ? Number(liquidation).toLocaleString() : "—"}</b></div>
              </article>
            );
          })}</div> : <div className="empty"><strong>No active positions</strong><span>Open futures positions will appear here.</span></div>
        )}
        {selectedExchangeId && activeTab === "open" && (
          openOrders.length ? <div className="order-table-wrap"><div className="order-table">
            <div className="order-row order-header"><span>Pair</span><span>Side / Type</span><span>Amount</span><span>Price</span><span>Filled</span><span>Status</span></div>
            {openOrders.map((item, index) => {
              const amountValue = Number(item.amount ?? 0);
              const filledValue = Number(item.filled ?? 0);
              const fillPct = amountValue > 0 ? Math.min(100, (filledValue / amountValue) * 100) : 0;
              const orderSide = String(item.side || "—").toLowerCase();
              return <div className="order-row" key={item.id || item.external_order_id || index}>
                <span><b>{item.symbol || "—"}</b></span>
                <span><b className={orderSide === "buy" ? "up" : "down"}>{String(item.side || "—").toUpperCase()}</b><small>{item.type || "—"}</small></span>
                <span>{amountValue || item.amount || "—"}</span>
                <span>{item.price ?? "Market"}</span>
                <span><b>{filledValue || 0}</b><small>{fillPct.toFixed(0)}%</small></span>
                <span><em className="status-badge">{item.status || "open"}</em></span>
              </div>;
            })}
          </div></div> : <div className="empty"><strong>No open orders</strong><span>Open orders for {symbol} will appear here.</span></div>
        )}
        {selectedExchangeId && activeTab === "history" && (
          orderHistory.length ? <div className="order-table-wrap"><div className="order-table">
            <div className="order-row order-header"><span>Pair</span><span>Side / Type</span><span>Amount</span><span>Avg. Price</span><span>Filled</span><span>Status</span></div>
            {orderHistory.slice(0, 12).map((item, index) => {
              const amountValue = Number(item.amount ?? 0);
              const filledValue = Number(item.filled ?? 0);
              const fillPct = amountValue > 0 ? Math.min(100, (filledValue / amountValue) * 100) : 0;
              const orderSide = String(item.side || "—").toLowerCase();
              const created = item.created_at || item.createdAt || item.timestamp;
              const timeLabel = created ? new Date(created).toLocaleString() : "—";
              return <div className="order-row" key={item.id || item.external_order_id || index}>
                <span><b>{item.symbol || "—"}</b><small>{timeLabel}</small></span>
                <span><b className={orderSide === "buy" ? "up" : "down"}>{String(item.side || "—").toUpperCase()}</b><small>{item.type || "—"}</small></span>
                <span>{amountValue || item.amount || "—"}</span>
                <span>{item.average ?? item.price ?? "—"}</span>
                <span><b>{filledValue || 0}</b><small>{fillPct.toFixed(0)}%</small></span>
                <span><em className="status-badge">{item.status || "—"}</em></span>
              </div>;
            })}
          </div></div> : <div className="empty"><strong>No order history</strong><span>Completed and cancelled orders will appear here.</span></div>
        )}
      </section>

      {previewOpen && (
        <div className="auth-overlay">
          <div className="auth-card">
            <div className="auth-head">
              <div>
                <b>Order preview</b>
                <small>Review the order details before connecting execution.</small>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)}>×</button>
            </div>
            <div className="order-confirm">
              <div><span>Side</span><b className={side === "buy" ? "up" : "down"}>{side.toUpperCase()}</b></div>
              <div><span>Pair</span><b>{symbol}</b></div>
              <div><span>Type</span><b>{orderType.toUpperCase()}</b></div>
              <div><span>Amount</span><b>{amount} {symbol.split("/")[0]}</b></div>
              {orderType === "limit" && <div><span>Limit price</span><b>{Number(priceInput || price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</b></div>}
              <div><span>Estimated cost</span><b>{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</b></div>
              {marketType !== "spot" && <div><span>Margin / leverage</span><b>{marginMode} · {leverage}×</b></div>}
              <div><span>Exchange</span><b>{exchanges.find((item) => item.id === selectedExchangeId)?.exchange_name || "Connected exchange"}</b></div>
            </div>
            <div className="order-message">Preview only — no order has been submitted to the exchange.</div>
            <button className="primary" onClick={() => setPreviewOpen(false)}>Close Preview</button>
          </div>
        </div>
      )}

      {authMode && (
        <div className="auth-overlay">
          <div className="auth-card">
            <div className="auth-head">
              <div>
                <b>{authMode === "register" ? "Create account" : "Welcome back"}</b>
                <small>{authMode === "register" ? "Start with a secure trading account." : "Sign in to manage exchanges and balances."}</small>
              </div>
              <button type="button" onClick={() => setAuthMode(null)}>×</button>
            </div>
            {authMode === "register" && (
              <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Full name" autoComplete="name" />
            )}
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" />
            <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} />
            {authMessage && <div className="order-message">{authMessage}</div>}
            <button className="primary" onClick={submitAuth}>{authMode === "register" ? "Create account" : "Sign in"}</button>
            <button className="auth-switch" onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthMessage(""); }}>
              {authMode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </div>
        </div>
      )}

      {exchangeOpen && (
        <div className="auth-overlay">
          <div className="auth-card exchange-card">
            <div className="auth-head">
              <div>
                <b>Connect exchange</b>
                <small>Credentials are encrypted by the backend and are never shown here.</small>
              </div>
              <button type="button" onClick={() => setExchangeOpen(false)}>×</button>
            </div>
            <select value={exchangeName} onChange={(e) => setExchangeName(e.target.value)}>
              <option value="binance">Binance</option>
              <option value="coinswitch">CoinSwitch</option>
            </select>
            <select value={marketType} onChange={(e) => setMarketType(e.target.value)}>
              <option value="spot">Spot</option>
              <option value="usdm">USDT-M Futures</option>
              <option value="coinm">Coin-M Futures</option>
            </select>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" autoComplete="off" />
            <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API secret" type="password" autoComplete="new-password" />
            {exchangeMessage && <div className="order-message">{exchangeMessage}</div>}
            <button className="primary" onClick={connectExchange}>Connect exchange</button>
            <div className="connected-list">
              {exchanges.length > 0 && <div className="connected-heading">Connected accounts</div>}
              {exchanges.map((exchange) => (
                <button
                  className={selectedExchangeId === exchange.id ? "exchange-item selected" : "exchange-item"}
                  key={exchange.id}
                  onClick={() => loadBalance(exchange.id)}
                >
                  <b>{exchange.exchange_name}</b>
                  <span>{exchange.market_type} · {exchange.is_active ? "Active" : "Inactive"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

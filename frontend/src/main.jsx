import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const markets = [
  ["BTC/USDT", "67,842.10", "+2.41%"],
  ["ETH/USDT", "3,842.18", "+1.84%"],
  ["SOL/USDT", "168.42", "-0.72%"],
  ["BNB/USDT", "612.80", "+0.38%"],
];

function App() {
  const [ticker, setTicker] = useState(null);
  const [connected, setConnected] = useState(false);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [candles, setCandles] = useState([]);
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
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [exchangeMessage, setExchangeMessage] = useState("");
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/v1/market/ohlcv/${symbol.replace("/", "")}?timeframe=1h&limit=60`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("OHLCV request failed")))
      .then((data) => setCandles(data.candles || []))
      .catch(() => setCandles([]));
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => {
    let socket;
    try {
      socket = new WebSocket(`${WS_BASE}/ws/market/binance/${symbol.replace("/", "")}`);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => setConnected(false);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ticker") setTicker(data);
        } catch {
          setConnected(false);
        }
      };
      socket.onerror = () => setConnected(false);
    } catch {
      setConnected(false);
    }
    return () => socket?.close();
  }, [symbol]);

  const submitAuth = async () => {
    setAuthMessage("Connecting...");
    const endpoint = authMode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const payload = authMode === "register" ? { full_name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword };
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");
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
    if (!accessToken) { setExchangeMessage("Sign in first."); return; }
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

  const chartPoints = useMemo(() => {
    if (candles.length < 2) return "";
    const closes = candles.map((candle) => Number(candle.close));
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    return closes.map((close, index) => {
      const x = (index / (closes.length - 1)) * 900;
      const y = 330 - ((close - min) / range) * 300;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [candles]);

  const effectivePrice = Number(priceInput || price || 0);
  const estimatedCost = Number(amount || 0) * effectivePrice;

  const formattedPrice = useMemo(
    () => Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [price]
  );

  return (
    <main className="terminal">
      <header className="topbar">
        <div className="brand">TRADE<span>LAB</span></div>
        <div className="search">⌕ Search markets</div>
        <div className="status"><i className={connected ? "online" : ""} /> {connected ? "Live market data" : "Demo market data"}</div>
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
          <div className="panel-title"><b>{symbol} · 1H</b><div className="tabs">1m&nbsp; 5m&nbsp; 15m&nbsp; 1H&nbsp; 4H&nbsp; 1D</div></div>
          <div className="chart-area">
            <div className="grid" />
            <svg viewBox="0 0 900 360" preserveAspectRatio="none">
              <polyline points={chartPoints || "0,270 60,245 120,260 180,205 240,220 300,170 360,190 420,125 480,155 540,105 600,140 660,92 720,120 780,70 840,94 900,45"} />
            </svg>
            <span className="price-line">${formattedPrice}</span>
          </div>
        </section>

        <aside className="order panel">
          <div className="panel-title"><b>Order</b><span>Spot</span></div>
          <div className="segmented"><button className={side === "buy" ? "active buy" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell</button></div>
          <div className="balance">Available <b>{balance?.free?.USDT != null ? `${Number(balance.free.USDT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Connect exchange"}</b></div>
          <label>Order type<select><option>Limit</option><option>Market</option></select></label>
          <label>Price<input value={Number(price).toFixed(2)} readOnly /></label>
          <label>Amount<input placeholder="0.00 BTC" /></label>
          <div className="slider"><span /><span /><span /><span /><span /></div>
          <div className="summary"><span>Est. cost</span><b>$0.00 USDT</b></div>
          <button className="primary">Buy {symbol.split("/")[0]}</button>
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
          positions.length ? <div className="data-list">{positions.map((item, index) => (
            <div className="data-row" key={item.id || item.symbol || index}>
              <span><b>{item.symbol || "—"}</b><small>{item.side || "—"} · {item.contracts ?? item.amount ?? "—"}</small></span>
              <span><b>{item.unrealizedPnl ?? item.unrealized_pnl ?? "—"}</b><small>Entry {item.entryPrice ?? item.entry_price ?? "—"}</small></span>
            </div>
          ))}</div> : <div className="empty"><strong>No active positions</strong><span>Open futures positions will appear here.</span></div>
        )}
        {selectedExchangeId && activeTab === "open" && (
          openOrders.length ? <div className="data-list">{openOrders.map((item, index) => (
            <div className="data-row" key={item.id || item.external_order_id || index}>
              <span><b>{item.symbol}</b><small>{item.side} · {item.type}</small></span>
              <span><b>{item.amount}</b><small>{item.price ?? "Market"}</small></span>
            </div>
          ))}</div> : <div className="empty"><strong>No open orders</strong><span>Open orders for {symbol} will appear here.</span></div>
        )}
        {selectedExchangeId && activeTab === "history" && (
          orderHistory.length ? <div className="data-list">{orderHistory.slice(0, 8).map((item, index) => (
            <div className="data-row" key={item.id || item.external_order_id || index}>
              <span><b>{item.symbol}</b><small>{item.side} · {item.type} · {item.status}</small></span>
              <span><b>{item.filled}/{item.amount}</b><small>{item.average ?? item.price ?? "—"}</small></span>
            </div>
          ))}</div> : <div className="empty"><strong>No order history</strong><span>Completed and cancelled orders will appear here.</span></div>
        )}
      </section>

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

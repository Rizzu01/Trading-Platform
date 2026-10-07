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
        <button className="profile">RK</button>
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
          <div className="balance">Available <b>$12,480.32</b></div>
          <label>Order type<select><option>Limit</option><option>Market</option></select></label>
          <label>Price<input value={Number(price).toFixed(2)} readOnly /></label>
          <label>Amount<input placeholder="0.00 BTC" /></label>
          <div className="slider"><span /><span /><span /><span /><span /></div>
          <div className="summary"><span>Est. cost</span><b>$0.00 USDT</b></div>
          <button className="primary">Buy {symbol.split("/")[0]}</button>
        </aside>
      </section>

      <section className="bottom panel">
        <div className="panel-title"><b>Positions & Orders</b><div className="tabs">Positions&nbsp;&nbsp; Open Orders&nbsp;&nbsp; Order History</div></div>
        <div className="empty"><strong>No active positions</strong><span>Your open positions and orders will appear here.</span></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

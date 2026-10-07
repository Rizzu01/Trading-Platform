import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const markets = [
  ["BTC/USDT", "67,842.10", "+2.41%"],
  ["ETH/USDT", "3,842.18", "+1.84%"],
  ["SOL/USDT", "168.42", "-0.72%"],
  ["BNB/USDT", "612.80", "+0.38%"],
];

function App() {
  return (
    <main className="terminal">
      <header className="topbar">
        <div className="brand">TRADE<span>LAB</span></div>
        <div className="search">⌕ Search markets</div>
        <div className="status"><i /> System operational</div>
        <button className="profile">RK</button>
      </header>

      <section className="marketbar">
        <div className="pair"><strong>BTC/USDT</strong><small>Bitcoin / Tether</small></div>
        <div><b>$67,842.10</b><small className="up">+2.41%</small></div>
        <div><small>24h High</small><b>$68,421.90</b></div>
        <div><small>24h Low</small><b>$65,903.20</b></div>
        <div><small>24h Volume</small><b>$2.84B</b></div>
      </section>

      <section className="workspace">
        <aside className="markets panel">
          <div className="panel-title"><b>Markets</b><span>Spot</span></div>
          <input placeholder="Search pair" />
          {markets.map(([pair, price, change]) => (
            <div className="market-row" key={pair}>
              <div><b>{pair}</b><small>USDT</small></div>
              <strong>{price}</strong>
              <em className={change.startsWith("-") ? "down" : "up"}>{change}</em>
            </div>
          ))}
        </aside>

        <section className="chart panel">
          <div className="panel-title"><b>BTC/USDT · 1H</b><div className="tabs">1m&nbsp; 5m&nbsp; 15m&nbsp; 1H&nbsp; 4H&nbsp; 1D</div></div>
          <div className="chart-area">
            <div className="grid" />
            <svg viewBox="0 0 900 360" preserveAspectRatio="none">
              <polyline points="0,270 60,245 120,260 180,205 240,220 300,170 360,190 420,125 480,155 540,105 600,140 660,92 720,120 780,70 840,94 900,45" />
            </svg>
            <span className="price-line">$67,842</span>
          </div>
        </section>

        <aside className="order panel">
          <div className="panel-title"><b>Order</b><span>Spot</span></div>
          <div className="segmented"><button className="active buy">Buy</button><button>Sell</button></div>
          <div className="balance">Available <b>$12,480.32</b></div>
          <label>Order type<select><option>Limit</option><option>Market</option></select></label>
          <label>Price<input value="67842.10" readOnly /></label>
          <label>Amount<input placeholder="0.00 BTC" /></label>
          <div className="slider"><span /><span /><span /><span /><span /></div>
          <div className="summary"><span>Est. cost</span><b>$0.00 USDT</b></div>
          <button className="primary">Buy BTC</button>
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

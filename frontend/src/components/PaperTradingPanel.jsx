import React, { useEffect, useState } from "react";

export default function PaperTradingPanel({ open, onClose, symbol, marketType, price, leverage, apiBase }) {
  const [account, setAccount] = useState(null);
  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setMessage("Sign in to use paper trading.");
      return;
    }
    const res = await fetch(apiBase + "/api/v1/paper/account", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Unable to load paper account.");
    setAccount(data);
  };

  useEffect(() => {
    if (!open) return;
    setMessage("");
    load().catch((e) => setMessage(e.message));
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const qty = Number(quantity);
    const executionPrice = Number(price);
    if (!Number.isFinite(qty) || qty <= 0) return setMessage("Enter a valid quantity.");
    if (!Number.isFinite(executionPrice) || executionPrice <= 0) return setMessage("Live market price is required.");
    const token = localStorage.getItem("access_token");
    if (!token) return setMessage("Sign in to use paper trading.");
    setBusy(true); setMessage("");
    try {
      const res = await fetch(apiBase + "/api/v1/paper/orders/market", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          symbol,
          side,
          quantity: qty,
          price: executionPrice,
          market_type: marketType,
          leverage: Number(leverage) || 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Paper order failed.");
      setAccount(data);
      setQuantity("");
      setMessage("Paper order filled.");
    } catch (e) {
      setMessage(e.message);
    } finally { setBusy(false); }
  };

  const reset = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return setMessage("Sign in to reset the paper account.");
    setBusy(true); setMessage("");
    try {
      const res = await fetch(apiBase + "/api/v1/paper/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ balance: 100000 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Unable to reset paper account.");
      setAccount(data); setMessage("Paper account reset.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="paper-overlay">
      <aside className="paper-panel">
        <header className="paper-head">
          <div><b>Paper Trading</b><small>Simulation only · no exchange orders</small></div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="paper-balance">
          <span>Available balance</span>
          <strong>{Number(account?.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</strong>
        </div>
        <div className="paper-mode">{symbol} · {marketType === "usdm" ? "USDⓈ-M Futures" : "Spot"} · {Number(leverage) || 1}×</div>
        <div className="paper-side">
          <button className={side === "BUY" ? "active" : ""} onClick={() => setSide("BUY")}>BUY / LONG</button>
          <button className={side === "SELL" ? "active" : ""} onClick={() => setSide("SELL")}>SELL / SHORT</button>
        </div>
        <label className="paper-field">Quantity<input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" placeholder="0.001" /></label>
        <div className="paper-price">Execution price <b>{Number(price || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}</b></div>
        {message && <div className="paper-message">{message}</div>}
        <button className="paper-submit" onClick={submit} disabled={busy}>{busy ? "Processing…" : "Place paper market order"}</button>
        <button className="paper-reset" onClick={reset} disabled={busy}>Reset to 100,000 USDT</button>
        <section className="paper-section"><b>Open positions</b>
          {(account?.positions || []).length ? account.positions.map((p) => <div className="paper-row" key={p.symbol + p.side}><span>{p.symbol} · {p.side}</span><b>{p.quantity}</b></div>) : <small>No open paper positions.</small>}
        </section>
        <section className="paper-section"><b>Recent paper orders</b>
          {(account?.orders || []).slice(0, 8).map((o) => <div className="paper-row" key={o.id}><span>{o.side} {o.symbol}</span><small>{o.quantity} @ {o.price}</small></div>)}
        </section>
      </aside>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function n(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
}

export default function AICopilot({ open, onClose, symbol, marketType, timeframe, apiBase = DEFAULT_API }) {
  const [context, setContext] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadContext = async () => {
    setError("");
    try {
      const params = new URLSearchParams({ symbol, market_type: marketType, timeframe, limit: "300" });
      const response = await fetch(`${apiBase}/api/v1/ai/market-context?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Real market context unavailable.");
      setContext(data.context);
    } catch (e) {
      setContext(null);
      setError(e.message);
    }
  };

  useEffect(() => {
    if (open) {
      setAnswer("");
      setQuestion("");
      loadContext();
    }
  }, [open, symbol, marketType, timeframe]);

  const quickQuestions = useMemo(() => [
    "Is this showing a strong setup?",
    "What invalidates the current setup?",
    "Is the market trending or ranging?",
    "Explain the main risks.",
  ], []);

  const ask = async (prompt = question) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, market_type: marketType, timeframe, question: prompt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "AI analysis unavailable.");
      setAnswer(data.answer);
      setContext(data.context);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const ind = context?.indicators || {};
  const regime = context?.regime || {};

  return (
    <aside className="ai-copilot-panel" aria-label="AI Trading Copilot">
      <header className="ai-copilot-head">
        <div>
          <span className="ai-kicker">MARKET INTELLIGENCE</span>
          <strong>AI Copilot</strong>
          <small>{symbol} · {marketType === "usdm" ? "Futures" : "Spot"} · {timeframe}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AI Copilot">×</button>
      </header>

      {context && (
        <section className="ai-context">
          <div className="ai-regime">
            <span>Current regime</span>
            <b>{regime.name || "—"}</b>
            <small>{regime.volatility || "—"}</small>
          </div>
          <div className="ai-metric-grid">
            <div><span>Price</span><b>{n(context.price)}</b></div>
            <div><span>EMA 20</span><b>{n(ind.ema20)}</b></div>
            <div><span>EMA 50</span><b>{n(ind.ema50)}</b></div>
            <div><span>RSI</span><b>{n(ind.rsi14)}</b></div>
            <div><span>ADX</span><b>{n(ind.adx14)}</b></div>
            <div><span>Volume</span><b>{n(context.volume, 0)}</b></div>
            {marketType === "usdm" && <div><span>Funding</span><b>{context.fundingRate == null ? "—" : `${(context.fundingRate * 100).toFixed(4)}%`}</b></div>}
            {marketType === "usdm" && <div><span>Open Interest</span><b>{n(context.openInterest)}</b></div>}
          </div>
        </section>
      )}

      <div className="ai-quick">
        {quickQuestions.map((item) => <button key={item} type="button" onClick={() => ask(item)}>{item}</button>)}
      </div>

      <div className="ai-answer">
        {loading ? <div className="ai-loading">Analyzing live context…</div> : answer ? <p>{answer}</p> : <div className="ai-empty">Ask about the live setup. The Copilot can only reason over supplied real market data.</div>}
      </div>

      {error && <div className="ai-error">{error}</div>}

      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this market…" />
        <button type="submit" disabled={loading || !question.trim()}>Ask</button>
      </form>

      {context && <footer className="ai-foot">Data timestamp: {new Date(context.timestamp).toLocaleString()} · Analysis is not a guaranteed signal.</footer>}
    </aside>
  );
}

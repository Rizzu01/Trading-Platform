import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function n(value, digits = 2) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

function pct(value, digits = 2) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}%` : "—";
}

export default function AICopilot({ open, onClose, symbol, marketType, timeframe, apiBase = DEFAULT_API }) {
  const [context, setContext] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [leverage, setLeverage] = useState(5);
  const [setup, setSetup] = useState(null);
  const [risk, setRisk] = useState(null);

  const loadContext = async () => {
    setError("");
    try {
      const params = new URLSearchParams({ symbol, market_type: marketType, timeframe, limit: "300" });
      const response = await fetch(`${apiBase}/api/v1/ai/market-context?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Real market context unavailable.");
      setContext(data.context);
      setSetup(null);
      setRisk(null);
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

  const buildSetup = async () => {
    if (!context) return;
    setSetupLoading(true);
    setError("");
    try {
      const ind = context.indicators || {};
      const price = Number(context.price);
      const atr = Number(ind.atr14);
      const ema20 = Number(ind.ema20);
      const ema50 = Number(ind.ema50);
      const rsi = Number(ind.rsi14);
      const adx = Number(ind.adx14);

      if (!Number.isFinite(price) || !Number.isFinite(atr)) {
        throw new Error("ATR/price data is insufficient for a trade setup.");
      }

      const bullish = ema20 > ema50 && rsi >= 50;
      const bearish = ema20 < ema50 && rsi <= 50;
      const direction = bullish ? "LONG" : bearish ? "SHORT" : "NO TRADE";
      const stopDistance = Math.max(atr * 1.25, price * 0.003);
      const entry = price;
      const stopLoss = direction === "LONG" ? entry - stopDistance : direction === "SHORT" ? entry + stopDistance : entry;
      const takeProfit = direction === "LONG" ? entry + stopDistance * 2 : direction === "SHORT" ? entry - stopDistance * 2 : entry;
      const agreement = [ema20 > ema50, rsi >= 50, adx >= 20, context.regime?.trend === "bullish", context.regime?.trend === "bearish"]
        .filter((v) => direction === "LONG" ? v : direction === "SHORT" ? v : false).length;
      const confidence = direction === "NO TRADE" ? Math.max(25, 100 - Math.abs(rsi - 50) * 2) : Math.min(95, 55 + agreement * 7 + (adx >= 25 ? 8 : 0));

      const next = {
        direction,
        entry,
        stopLoss,
        takeProfit,
        riskReward: 2,
        confidence,
        strategyAgreement: direction === "NO TRADE" ? 0 : Math.max(2, agreement),
        rationale: direction === "LONG"
          ? "EMA20 is above EMA50 and momentum is not bearish."
          : direction === "SHORT"
            ? "EMA20 is below EMA50 and momentum is not bullish."
            : "Trend and momentum are not aligned strongly enough.",
      };
      setSetup(next);

      if (direction !== "NO TRADE") {
        setRiskLoading(true);
        const riskResponse = await fetch(`${apiBase}/api/v1/ai/risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balance: Number(balance),
            risk_percent: Number(riskPercent),
            entry,
            stop_loss: stopLoss,
            leverage: Number(leverage),
          }),
        });
        const riskData = await riskResponse.json().catch(() => ({}));
        if (!riskResponse.ok) throw new Error(riskData.detail || "Risk calculation failed.");
        setRisk(riskData);
      } else {
        setRisk(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSetupLoading(false);
      setRiskLoading(false);
    }
  };

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
            <small>{regime.volatility || "—"} · {regime.trend || "—"} trend</small>
          </div>
          <div className="ai-metric-grid">
            <div><span>Price</span><b>{n(context.price)}</b></div>
            <div><span>EMA 20</span><b>{n(ind.ema20)}</b></div>
            <div><span>EMA 50</span><b>{n(ind.ema50)}</b></div>
            <div><span>RSI</span><b>{n(ind.rsi14)}</b></div>
            <div><span>ADX</span><b>{n(ind.adx14)}</b></div>
            <div><span>ATR</span><b>{n(ind.atr14)}</b></div>
            <div><span>Volume</span><b>{n(context.volume, 0)}</b></div>
            {marketType === "usdm" && <div><span>Funding</span><b>{context.fundingRate == null ? "—" : pct(context.fundingRate * 100, 4)}</b></div>}
            {marketType === "usdm" && <div><span>Open Interest</span><b>{n(context.openInterest)}</b></div>}
          </div>
        </section>
      )}

      {context && (
        <section className="ai-setup-card">
          <div className="ai-section-head">
            <div><span className="ai-kicker">TRADE SETUP</span><strong>{setup?.direction || "Awaiting analysis"}</strong></div>
            <span className={setup?.direction === "LONG" ? "up" : setup?.direction === "SHORT" ? "down" : ""}>{setup ? `${Math.round(setup.confidence)}% confidence` : "Live context"}</span>
          </div>

          {setup ? (
            <>
              <div className="ai-setup-grid">
                <div><span>Entry</span><b>{n(setup.entry)}</b></div>
                <div><span>Stop Loss</span><b>{n(setup.stopLoss)}</b></div>
                <div><span>Take Profit</span><b>{n(setup.takeProfit)}</b></div>
                <div><span>R:R</span><b>1 : {setup.riskReward}</b></div>
                <div><span>Strategy agreement</span><b>{setup.strategyAgreement}/5</b></div>
                <div><span>Max loss</span><b>{risk ? n(risk.maxLoss) : "—"}</b></div>
              </div>
              <small className="ai-rationale">{setup.rationale}</small>
            </>
          ) : (
            <p className="ai-empty">Generate a setup from the current real market context. This is an analytical setup, not an order.</p>
          )}

          <div className="ai-risk-controls">
            <label>Planning balance<input type="number" min="1" value={balance} onChange={(e) => setBalance(e.target.value)} /></label>
            <label>Risk %<input type="number" min="0.1" max="10" step="0.1" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} /></label>
            <label>Leverage<input type="number" min="1" max="125" value={leverage} onChange={(e) => setLeverage(e.target.value)} /></label>
          </div>
          <button type="button" className="ai-primary-button" onClick={buildSetup} disabled={setupLoading || riskLoading}>
            {setupLoading || riskLoading ? "Calculating…" : "Analyze Trade Setup"}
          </button>

          {risk && (
            <div className="ai-risk-result">
              <div><span>Position size</span><b>{n(risk.positionSize)}</b></div>
              <div><span>Notional</span><b>{n(risk.notional)}</b></div>
              <div><span>Margin</span><b>{n(risk.marginRequired)}</b></div>
              <div><span>Liquidation risk</span><b>{risk.liquidationRisk ? "HIGH" : "LOW"}</b></div>
            </div>
          )}
        </section>
      )}

      <div className="ai-quick">
        {quickQuestions.map((item) => <button key={item} type="button" onClick={() => ask(item)}>{item}</button>)}
      </div>

      <div className="ai-answer">
        {loading ? <div className="ai-loading">Analyzing live context…</div> : answer ? <p>{answer}</p> : <div className="ai-empty">Ask about this market. Copilot reasons only over supplied real market data.</div>}
      </div>

      {error && <div className="ai-error">{error}</div>}

      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this market…" />
        <button type="submit" disabled={loading || !question.trim()}>Ask</button>
      </form>

      {context && <footer className="ai-foot">Live data: {new Date(context.timestamp).toLocaleString()} · Backtests do not guarantee future performance.</footer>}
    </aside>
  );
}

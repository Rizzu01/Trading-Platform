import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function pct(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return ${Number(value).toFixed(2)}%;
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function StrategyLab({
  open,
  onClose,
  symbol,
  marketType,
  apiBase = DEFAULT_API,
}) {
  const [strategies, setStrategies] = useState([]);
  const [selectedId, setSelectedId] = useState("adaptive_trend");
  const [signal, setSignal] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => strategies.find((item) => item.id === selectedId) || strategies[0] || null,
    [strategies, selectedId],
  );

  useEffect(() => {
    if (!open) return;
    setMessage("");
    fetch(${apiBase}/api/v1/strategies)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to load strategies.");
        return data;
      })
      .then((data) => {
        setStrategies(data.strategies || []);
        if (data.strategies?.[0]?.id && !data.strategies.some((item) => item.id === selectedId)) {
          setSelectedId(data.strategies[0].id);
        }
      })
      .catch((error) => setMessage(error.message));
  }, [open, apiBase]);

  useEffect(() => {
    if (!open || !selected) return;
    setLoading(true);
    setSignal(null);
    setMessage("");

    const params = new URLSearchParams({
      symbol,
      market_type: marketType,
      timeframe: selected.timeframe,
    });

    fetch(${apiBase}/api/v1/strategies/${selected.id}/signal?${params.toString()})
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Signal unavailable.");
        return data;
      })
      .then(setSignal)
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [open, selected?.id, selected?.timeframe, symbol, marketType, apiBase]);

  const runBacktest = async () => {
    if (!selected) return;
    setBacktesting(true);
    setBacktest(null);
    setMessage("");

    try {
      const response = await fetch(${apiBase}/api/v1/strategies/${selected.id}/backtest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          market_type: marketType,
          timeframe: selected.timeframe,
          limit: 500,
          initial_capital: 10000,
          fee_bps: 5,
          slippage_bps: 2,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Backtest unavailable.");
      setBacktest(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBacktesting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="strategy-overlay">
      <section className="strategy-lab-card" role="dialog" aria-modal="true" aria-label="Strategy Lab">
        <header className="strategy-lab-head">
          <div>
            <b>Strategy Lab</b>
            <span>Research-backed signals · live market screening · no guaranteed returns</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Strategy Lab">×</button>
        </header>

        <div className="strategy-lab-body">
          <aside className="strategy-library">
            <div className="strategy-library-title">Strategies</div>
            {strategies.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === selected?.id ? "strategy-item active" : "strategy-item"}
                onClick={() => {
                  setSelectedId(item.id);
                  setBacktest(null);
                  setMessage("");
                }}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.timeframe} · {item.direction}</small>
                </span>
                <em className={item.tier}>{item.tier === "research-backed" ? "Research" : "Experimental"}</em>
              </button>
            ))}
          </aside>

          <main className="strategy-detail">
            {selected ? (
              <>
                <div className="strategy-detail-head">
                  <div>
                    <div className="strategy-title-row">
                      <h2>{selected.name}</h2>
                      <span className={selected.tier}>{selected.tier}</span>
                    </div>
                    <p>{selected.description}</p>
                  </div>
                  <button className="strategy-run" type="button" onClick={runBacktest} disabled={backtesting || loading}>
                    {backtesting ? "Running…" : "Run 500-bar backtest"}
                  </button>
                </div>

                <div className="strategy-grid">
                  <div className="strategy-stat">
                    <span>Market</span>
                    <b>{symbol} · {marketType === "usdm" ? "USDⓈ-M Futures" : "Spot"}</b>
                  </div>
                  <div className="strategy-stat">
                    <span>Timeframe</span>
                    <b>{selected.timeframe}</b>
                  </div>
                  <div className="strategy-stat">
                    <span>Direction</span>
                    <b>{selected.direction}</b>
                  </div>
                </div>

                <div className="strategy-signal-card">
                  <div className="strategy-signal-top">
                    <span>Current signal</span>
                    <strong className={signal?.signal === 1 ? "up" : signal?.signal === -1 ? "down" : ""}>
                      {loading ? "Checking…" : signal?.signal === 1 ? "LONG" : signal?.signal === -1 ? "SHORT" : "FLAT"}
                    </strong>
                  </div>
                  <div className="strategy-signal-metrics">
                    <div><span>Confidence</span><b>{signal ? ${signal.confidence}/100 : "—"}</b></div>
                    <div><span>ATR stop distance</span><b>{signal?.stop_distance ? formatNumber(signal.stop_distance) : "—"}</b></div>
                    <div><span>Reason</span><b>{signal?.reason || "—"}</b></div>
                  </div>
                </div>

                <div className="strategy-rules">
                  <div className="strategy-section-title">Rules</div>
                  {selected.rules.map((rule) => <div key={rule}>• {rule}</div>)}
                </div>

                {backtest && (
                  <div className="strategy-backtest">
                    <div className="strategy-section-title">
                      <span>Backtest result</span>
                      <em>{backtest.validation?.status || "screening"}</em>
                    </div>
                    <div className="strategy-results-grid">
                      <div><span>Return</span><b className={backtest.return_pct >= 0 ? "up" : "down"}>{pct(backtest.return_pct)}</b></div>
                      <div><span>Max drawdown</span><b className="down">{pct(backtest.max_drawdown_pct)}</b></div>
                      <div><span>Win rate</span><b>{pct(backtest.win_rate_pct)}</b></div>
                      <div><span>Profit factor</span><b>{formatNumber(backtest.profit_factor)}</b></div>
                      <div><span>Trades</span><b>{backtest.trade_count}</b></div>
                      <div><span>Final equity</span><b>$${formatNumber(backtest.final_equity)}</b></div>
                    </div>
                    <small>{backtest.validation?.note}</small>
                  </div>
                )}

                {message && <div className="strategy-message">{message}</div>}

                <div className="strategy-disclaimer">
                  Research evidence is not a profit guarantee. A strategy should move to live execution only after walk-forward validation, realistic costs, paper trading, and exchange-specific execution checks.
                </div>
              </>
            ) : (
              <div className="strategy-empty">Loading strategy catalogue…</div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

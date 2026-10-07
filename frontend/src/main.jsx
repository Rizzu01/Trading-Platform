import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import MarketChart from "./components/MarketChart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const BINANCE_DATA_BASE = "https://data-api.binance.vision";
const BINANCE_REST_BASES = [BINANCE_DATA_BASE, "https://api.binance.com", API_BASE];
const BINANCE_STREAM_BASE = "wss://data-stream.binance.vision/ws";

async function refreshSession() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const response = await fetch(API_BASE + "/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return false;
  }
}

async function authFetch(url, options = {}) {
  const makeHeaders = (token) => ({
    ...(options.headers || {}),
    ...(token ? { Authorization: "Bearer " + token } : {}),
  });

  let token = localStorage.getItem("access_token");
  let response = await fetch(url, { ...options, headers: makeHeaders(token) });

  if (response.status !== 401) return response;

  const refreshed = await refreshSession();
  if (!refreshed) return response;

  token = localStorage.getItem("access_token");
  return fetch(url, { ...options, headers: makeHeaders(token) });
}

const MARKETS = [
  { symbol: "BTC/USDT", name: "Bitcoin" },
  { symbol: "ETH/USDT", name: "Ethereum" },
  { symbol: "SOL/USDT", name: "Solana" },
  { symbol: "BNB/USDT", name: "BNB" },
];

const SUPPORTED_EXCHANGES = [
  { value: "binance", label: "Binance", marketTypes: ["spot", "usdm"] },
  { value: "coinswitch", label: "CoinSwitch", marketTypes: ["spot"] },
];

const MARKET_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

function formatApiError(status, data, fallback = "Request failed.") {
  if (status === 401) return "Session expired. Please sign in again.";
  if (status === 403) return "You do not have permission for this action.";
  if (status === 501) return data?.message || "This feature is not available for this exchange yet.";
  if (status === 409) return data?.message || "This account already exists.";
  if (status === 422) {
    const validation = Array.isArray(data?.errors)
      ? data.errors.map((item) => item.msg || item.message).filter(Boolean).join(", ")
      : "";
    return validation || data?.message || "Please check the entered values.";
  }
  return data?.message || data?.detail || fallback;
}

function getBalanceAsset(balance, asset) {
  if (Array.isArray(balance)) {
    const row = balance.find((item) => item.asset === asset);
    return row ? {
      free: Number(row.free || 0),
      used: Number(row.used || 0),
      total: Number(row.total || 0),
    } : null;
  }
  if (balance && typeof balance === "object") {
    const row = balance[asset];
    return row ? {
      free: Number(row.free || 0),
      used: Number(row.used || 0),
      total: Number(row.total || 0),
    } : null;
  }
  return null;
}

function formatMarketNumber(value, fractionDigits = 2) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function App() {
  const [ticker, setTicker] = useState(null);
  const [marketData, setMarketData] = useState({});
  const [marketConnection, setMarketConnection] = useState("connecting");
  const [connected, setConnected] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [chartConnected, setChartConnected] = useState(false);
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [candles, setCandles] = useState([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [marketSearch, setMarketSearch] = useState("");
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("limit");
  const [amount, setAmount] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
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
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [exchangeMessage, setExchangeMessage] = useState("");
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [balanceView, setBalanceView] = useState("available");
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem("tradelab-theme") || "system");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const applyTheme = () => {
      const resolved = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.theme = resolved;
      localStorage.setItem("tradelab-theme", theme);
    };

    applyTheme();

    if (theme === "system") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    const loadCandles = async () => {
      setMarketLoading(true);
      setMarketError("");

      const normalizedSymbol = symbol.replace("/", "").toUpperCase();
      const query = new URLSearchParams({
        symbol: normalizedSymbol,
        interval: timeframe,
        limit: "120",
      });

      let lastError = null;

      for (const base of [BINANCE_DATA_BASE, "https://api.binance.com"]) {
        try {
          const response = await fetch(`${base}/api/v3/klines?${query.toString()}`, {
            signal: controller.signal,
          });

          if (!response.ok) {
            lastError = new Error(`Market data returned HTTP ${response.status}`);
            continue;
          }

          const payload = await response.json();
          const normalized = payload.map((candle) => ({
            timestamp: Number(candle[0]),
            open: Number(candle[1]),
            high: Number(candle[2]),
            low: Number(candle[3]),
            close: Number(candle[4]),
            volume: Number(candle[5]),
          })).filter((candle) =>
            Number.isFinite(candle.timestamp) &&
            Number.isFinite(candle.open) &&
            Number.isFinite(candle.high) &&
            Number.isFinite(candle.low) &&
            Number.isFinite(candle.close)
          );

          if (normalized.length < 2) {
            lastError = new Error("No usable candles were returned.");
            continue;
          }

          setCandles(normalized.slice(-120));
          return;
        } catch (error) {
          if (error.name === "AbortError") return;
          lastError = error;
        }
      }

      throw lastError || new Error("Live market data is unavailable.");
    };

    loadCandles()
      .catch((error) => {
        if (error.name !== "AbortError") {
          setCandles([]);
          setMarketError("Live market data is unavailable.");
        }
      })
      .finally(() => setMarketLoading(false));

    return () => controller.abort();
  }, [symbol, timeframe]);

  useEffect(() => {
    const tickerStreams = MARKETS.map((item) => `${item.symbol.replace("/", "").toLowerCase()}@ticker`).join("/");
    const tickerUrl = `wss://data-stream.binance.vision/stream?streams=${tickerStreams}`;
    const normalizedSymbol = symbol.replace("/", "").toLowerCase();
    let tickerSocket;
    let klineSocket;
    let tickerRetry;
    let klineRetry;
    let tickerAttempt = 0;
    let klineAttempt = 0;
    let disposed = false;

    const scheduleReconnect = (kind, connectFn, attempt) => {
      const delay = Math.min(30000, 1000 * (2 ** Math.min(attempt, 5)));
      const jitter = Math.floor(Math.random() * 500);
      const timer = setTimeout(connectFn, delay + jitter);
      if (kind === "ticker") tickerRetry = timer;
      else klineRetry = timer;
    };

    const connectTicker = () => {
      if (disposed) return;

      setMarketConnection(tickerAttempt > 0 ? "reconnecting" : "connecting");

      try {
        tickerSocket = new WebSocket(tickerUrl);
        tickerSocket.onopen = () => {
          tickerAttempt = 0;
          setConnected(true);
          setMarketConnection("connected");
        };
        tickerSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            const data = message.data || message;
            if (data.e !== "24hrTicker" || !data.s) return;

            const next = {
              symbol: data.s,
              last: Number(data.c),
              bid: Number(data.b),
              ask: Number(data.a),
              high: Number(data.h),
              low: Number(data.l),
              volume: Number(data.v),
              changePercent: Number(data.P),
              timestamp: Number(data.E),
            };

            setMarketData((current) => ({ ...current, [data.s]: next }));
            if (data.s === normalizedSymbol.toUpperCase()) {
              setTicker(next);
            }
          } catch {}
        };
        tickerSocket.onerror = () => {
          setConnected(false);
          setMarketConnection("error");
        };
        tickerSocket.onclose = () => {
          setConnected(false);
          if (!disposed) {
            setMarketConnection("reconnecting");
            tickerAttempt += 1;
            scheduleReconnect("ticker", connectTicker, tickerAttempt);
          }
        };
      } catch {
        setConnected(false);
        setMarketConnection("error");
        if (!disposed) {
          tickerAttempt += 1;
          scheduleReconnect("ticker", connectTicker, tickerAttempt);
        }
      }
    };

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

      setTicker((current) => {
        const existing = current || marketData[normalizedSymbol.toUpperCase()] || {};
        return {
          ...existing,
          symbol: k.s || normalizedSymbol.toUpperCase(),
          last: nextCandle.close,
          high: existing.high ?? nextCandle.high,
          low: existing.low ?? nextCandle.low,
          volume: existing.volume ?? nextCandle.volume,
        };
      });
    };

    const connectKline = () => {
      if (disposed) return;

      try {
        klineSocket = new WebSocket(`${BINANCE_STREAM_BASE}/${normalizedSymbol}@kline_${timeframe}`);
        klineSocket.onopen = () => {
          klineAttempt = 0;
          setChartConnected(true);
        };
        klineSocket.onmessage = (event) => {
          try {
            upsertKline(JSON.parse(event.data));
          } catch {}
        };
        klineSocket.onerror = () => setChartConnected(false);
        klineSocket.onclose = () => {
          setChartConnected(false);
          if (!disposed) {
            klineAttempt += 1;
            scheduleReconnect("kline", connectKline, klineAttempt);
          }
        };
      } catch {
        setChartConnected(false);
        if (!disposed) {
          klineAttempt += 1;
          scheduleReconnect("kline", connectKline, klineAttempt);
        }
      }
    };

    connectTicker();
    connectKline();

    return () => {
      disposed = true;
      clearTimeout(tickerRetry);
      clearTimeout(klineRetry);
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
    if (!localStorage.getItem("access_token") || !exchangeId) return;
    try {
      const response = await authFetch(`${API_BASE}/api/v1/exchange/${exchangeId}/balance`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatApiError(response.status, data, "Unable to load exchange balance."));
      }
      const data = await response.json();
      setBalance(data.balances || []);
      setSelectedExchangeId(exchangeId);
    } catch (error) {
      setExchangeMessage(error.message);
      setSelectedExchangeId(null);
      setBalance(null);
    }
  };

  const loadTradingData = async (exchangeId) => {
    if (!localStorage.getItem("access_token") || !exchangeId) return;
    try {
      const [positionsResponse, openResponse, historyResponse] = await Promise.all([
        authFetch(`${API_BASE}/api/v1/exchange/${exchangeId}/positions`),
        authFetch(`${API_BASE}/api/v1/orders/${exchangeId}/open?symbol=${encodeURIComponent(symbol.replace("/", ""))}`),
        authFetch(`${API_BASE}/api/v1/orders/${exchangeId}/history?symbol=${encodeURIComponent(symbol.replace("/", ""))}`),
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
    if (!localStorage.getItem("access_token")) {
      setExchangeMessage("Sign in first to connect an exchange.");
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/api/v1/exchange`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(formatApiError(response.status, data, "Unable to load connected exchanges."));
      }
      setExchanges(await response.json());
    } catch (error) {
      setExchangeMessage(error.message);
      setExchanges([]);
    }
  };

  const connectExchange = async () => {
    if (!localStorage.getItem("access_token")) {
      setExchangeMessage("Sign in first.");
      setAuthMode("login");
      return;
    }

    if (!apiKey.trim() || !apiSecret.trim()) {
      setExchangeMessage("Enter the API key and API secret.");
      return;
    }

    setExchangeSubmitting(true);
    setExchangeMessage("Verifying exchange credentials…");

    try {
      const response = await authFetch(`${API_BASE}/api/v1/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange_name: exchangeName,
          market_type: marketType,
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatApiError(response.status, data, "Exchange connection failed."));

      setApiKey("");
      setApiSecret("");
      setExchangeMessage("Exchange credentials verified and connected.");
      await loadExchanges();
    } catch (error) {
      setExchangeMessage(error.message);
    } finally {
      setExchangeSubmitting(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      if (refreshToken) {
        await fetch(`${API_BASE}/api/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setSelectedExchangeId(null);
    setBalance(null);
    setExchanges([]);
    setAccountMenuOpen(false);
  };

  useEffect(() => {
    if (selectedExchangeId) {
      loadTradingData(selectedExchangeId);
    }
  }, [selectedExchangeId, symbol]);

  const activeMarket = marketData[symbol.replace("/", "").toUpperCase()] || ticker || null;
  const price = Number.isFinite(Number(activeMarket?.last)) ? Number(activeMarket.last) : null;
  const high = Number.isFinite(Number(activeMarket?.high)) ? Number(activeMarket.high) : null;
  const low = Number.isFinite(Number(activeMarket?.low)) ? Number(activeMarket.low) : null;
  const volume = Number.isFinite(Number(activeMarket?.volume)) ? Number(activeMarket.volume) : null;
  const changePercent = Number.isFinite(Number(activeMarket?.changePercent)) ? Number(activeMarket.changePercent) : null;

  const baseAsset = symbol.split("/")[0];
  const quoteAsset = symbol.split("/")[1] || "USDT";
  const quoteBalance = getBalanceAsset(balance, quoteAsset);
  const baseBalance = getBalanceAsset(balance, baseAsset);
  const effectivePrice = orderType === "limit" ? Number(priceInput || price || 0) : Number(price || 0);
  const estimatedCost = Number(amount || 0) * effectivePrice;
  const priceAvailable = Number.isFinite(price) && price > 0 && marketConnection === "connected";
  const selectedExchange = exchanges.find((item) => item.id === selectedExchangeId);
  const futuresSelected = marketType === "usdm";

  const filteredMarkets = MARKETS.filter((item) => {
    const query = marketSearch.trim().toLowerCase();
    return !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
  });

  const previewOrder = () => {
    setOrderMessage("");
    const quantity = Number(amount);
    const selectedPrice = orderType === "limit" ? Number(priceInput || price) : Number(price);

    if (!selectedExchangeId) {
      setOrderMessage("Connect an exchange before placing an order.");
      return;
    }
    if (!priceAvailable) {
      setOrderMessage("Live market price is unavailable. Order submission is disabled.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setOrderMessage("Enter a valid amount.");
      return;
    }
    if (orderType === "limit" && (!Number.isFinite(selectedPrice) || selectedPrice <= 0)) {
      setOrderMessage("Enter a valid limit price.");
      return;
    }
    if (!selectedMarketMatchesMode) {
      setOrderMessage(`Connect a ${marketType === "usdm" ? "Binance USDT-M Futures" : "Spot"} account for this order panel.`);
      return;
    }
    if (marketType === "coinm") {
      setOrderMessage("Coin-M Futures is not available in the current order adapter.");
      return;
    }
    setPreviewOpen(true);
  };

  const submitOrder = async () => {
    if (!selectedExchangeId || orderSubmitting) return;

    setOrderSubmitting(true);
    setOrderMessage("");

    try {
      if (!selectedMarketMatchesMode) {
        throw new Error(`Connect a ${marketType === "usdm" ? "Binance USDT-M Futures" : "Spot"} account for this order panel.`);
      }

      if (marketType === "usdm") {
        const leverageResponse = await authFetch(
          `${API_BASE}/api/v1/exchange/${selectedExchangeId}/leverage?symbol=${encodeURIComponent(symbol)}&leverage=${leverage}`,
          { method: "POST" }
        );
        const leverageData = await leverageResponse.json().catch(() => ({}));
        if (!leverageResponse.ok) {
          throw new Error(formatApiError(leverageResponse.status, leverageData, "Unable to set futures leverage."));
        }
      }

      const suffix = orderType === "market" ? `market-${side}` : `limit-${side}`;
      const payload = {
        symbol,
        amount: Number(amount),
        ...(orderType === "limit" ? { price: Number(priceInput || price) } : {}),
      };

      const response = await authFetch(`${API_BASE}/api/v1/orders/${selectedExchangeId}/${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatApiError(response.status, data, "Order submission failed."));

      setPreviewOpen(false);
      setOrderMessage(`Order submitted successfully. Exchange order ID: ${data.order?.external_order_id || "returned by exchange"}.`);
      setAmount("");
      setPriceInput("");
      await Promise.all([loadBalance(selectedExchangeId), loadTradingData(selectedExchangeId)]);
    } catch (error) {
      setOrderMessage(error.message);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const formattedPrice = price == null ? "—" : formatMarketNumber(price, 2);
  const formattedHigh = high == null ? "—" : formatMarketNumber(high, 2);
  const formattedLow = low == null ? "—" : formatMarketNumber(low, 2);
  const formattedVolume = volume == null ? "—" : `$${(volume / 1e9).toFixed(2)}B`;

  return (
    <main className="terminal">
            <header className="topbar">
        <div className="brand">TRADE<span>LAB</span></div>
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "/" && e.target === e.currentTarget) e.preventDefault();
            }}
            placeholder="Search markets"
            aria-label="Search markets"
          />
        </label>
        <nav className="topnav" aria-label="Primary navigation">
          <button className="nav-link active">Trade</button>
          <button className="nav-link">Markets</button>
          <button className="nav-link">Portfolio</button>
          <button className="nav-link">Orders</button>
        </nav>
        <div className="top-actions">
          <div className={`market-connection ${marketConnection}`}>
            <i />
            <span>{marketConnection === "connected" ? "Live" : marketConnection === "reconnecting" ? "Reconnecting" : marketConnection === "connecting" ? "Connecting" : marketConnection === "error" ? "Error" : "Disconnected"}</span>
            <small>Binance public feed</small>
          </div>
          <select className="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
          <button className="icon-button" type="button" disabled title="Notifications are not backed by a notification API yet">◌</button>
          <div className="account-wrap">
            <button className="profile" onClick={() => setAccountMenuOpen((value) => !value)} aria-expanded={accountMenuOpen}>RK</button>
            {accountMenuOpen && (
              <div className="account-menu">
                <div className="account-menu-head">
                  <strong>{accessToken ? "Signed in" : "Guest"}</strong>
                  <span>{accessToken ? "Session active" : "Sign in to trade"}</span>
                </div>
                {accessToken ? (
                  <>
                    <button onClick={() => { setExchangeOpen(true); setExchangeMessage(""); loadExchanges(); setAccountMenuOpen(false); }}>Connect exchange</button>
                    <button onClick={logout}>Sign out</button>
                  </>
                ) : (
                  <button onClick={() => { setAuthMode("login"); setAuthMessage(""); setAccountMenuOpen(false); }}>Sign in</button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="marketbar">
        <div className="pair">
          <strong>{symbol}</strong>
          <small>{MARKETS.find((item) => item.symbol === symbol)?.name || "Market asset"} / {quoteAsset}</small>
        </div>
        <div className="market-price">
          <b>{price == null ? "—" : `$${formattedPrice}`}</b>
          <small className={changePercent != null && changePercent >= 0 ? "up" : "down"}>
            {changePercent == null ? "Unavailable" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
          </small>
        </div>
        <div><small>24h High</small><b>{formattedHigh === "—" ? "—" : `$${formattedHigh}`}</b></div>
        <div><small>24h Low</small><b>{formattedLow === "—" ? "—" : `$${formattedLow}`}</b></div>
        <div><small>24h Volume</small><b>{formattedVolume}</b></div>
        <div className="market-mode">
          <button className={marketType === "spot" ? "active" : ""} onClick={() => setMarketType("spot")}>Spot</button>
          <button className={marketType === "usdm" ? "active" : ""} onClick={() => setMarketType("usdm")}>Futures</button>
        </div>
      </section>

      <section className="workspace">
        <aside className="markets panel">
          <div className="panel-title"><b>Markets</b><span>USDT</span></div>
          <input
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Search pair"
            aria-label="Filter markets"
          />
          <div className="market-filter-row">
            <button className="active">All</button>
            <button>Favorites</button>
          </div>
          {filteredMarkets.map((item) => {
            const data = marketData[item.symbol.replace("/", "")] || null;
            const change = Number.isFinite(Number(data?.changePercent)) ? Number(data.changePercent) : null;
            return (
              <button
                className={`market-row market-button ${item.symbol === symbol ? "selected" : ""}`}
                key={item.symbol}
                onClick={() => { setSymbol(item.symbol); setPriceInput(""); }}
              >
                <div className="market-main">
                  <span className="favorite" aria-hidden="true">☆</span>
                  <span>
                    <b>{item.symbol}</b>
                    <small>{item.name}</small>
                  </span>
                </div>
                <strong>{data?.last != null ? formatMarketNumber(data.last, 2) : "—"}</strong>
                <em className={change != null && change >= 0 ? "up" : "down"}>
                  {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                </em>
              </button>
            );
          })}
        </aside>

        <section className="chart panel">
          <div className="panel-title chart-heading">
            <div>
              <b>{symbol}</b>
              <small>{MARKETS.find((item) => item.symbol === symbol)?.name || "Market"}</small>
            </div>
            <div className="tabs chart-timeframes">
              {MARKET_TIMEFRAMES.map((value) => (
                <button key={value} className={timeframe === value ? "tab active" : "tab"} onClick={() => setTimeframe(value)}>
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
            theme={theme}
          />
        </section>

        <aside className="order panel">
          <div className="panel-title"><b>Order entry</b><span>{marketType === "usdm" ? "USDT-M" : "Spot"}</span></div>
          {marketType === "usdm" && (
            <div className="notice warning">
              Binance USDT-M is connected through the existing adapter. Leverage is exchange-configured here; margin-mode controls are not exposed until the backend adds a margin-mode endpoint.
            </div>
          )}
          <div className="segmented">
            <button className={side === "buy" ? "active buy" : ""} onClick={() => setSide("buy")}>Buy</button>
            <button className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell</button>
          </div>

          <div className="balance-card">
            <div className="balance-top">
              <span>Available {quoteAsset}</span>
              <b>{quoteBalance ? formatMarketNumber(quoteBalance.free, 2) : "—"}</b>
            </div>
            <small>{selectedExchange ? `${selectedExchange.exchange_name} · ${selectedExchange.market_type}` : "Connect an exchange to load account balance."}</small>
          </div>

          <label>Order type
            <select value={orderType} onChange={(e) => { setOrderType(e.target.value); setOrderMessage(""); }}>
              <option value="limit">Limit</option>
              <option value="market">Market</option>
            </select>
          </label>

          {orderType === "limit" && (
            <label>Limit price
              <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" placeholder={price != null ? formattedPrice : "Live price unavailable"} />
            </label>
          )}

          <label>Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`0.00 ${baseAsset}`} />
          </label>

          {orderType === "market" && <div className="estimate-row"><span>Estimated price</span><b>{price == null ? "—" : `$${formattedPrice}`}</b></div>}
          <div className="percentage-row">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!quoteBalance && side === "buy" || !baseBalance && side === "sell"}
                onClick={() => {
                  const source = side === "buy" ? quoteBalance?.free : baseBalance?.free;
                  if (!Number.isFinite(source) || !effectivePrice || effectivePrice <= 0) return;
                  const nextAmount = side === "buy" ? (source * (pct / 100)) / effectivePrice : source * (pct / 100);
                  setAmount(String(Number(nextAmount.toFixed(8))));
                }}
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="summary"><span>Estimated total</span><b>{estimatedCost > 0 ? `${formatMarketNumber(estimatedCost, 2)} ${quoteAsset}` : "—"}</b></div>
          <div className="summary"><span>Trading fee</span><b>—</b></div>
          <small className="hint">Fee data is not exposed by the current backend adapter, so it is not estimated here.</small>

          {orderMessage && <div className="order-message">{orderMessage}</div>}

          <button className="primary" disabled={orderSubmitting || !selectedExchangeId || !priceAvailable} onClick={previewOrder}>
            {orderSubmitting ? "Submitting…" : !selectedExchangeId ? "Connect exchange first" : !priceAvailable ? "Live price unavailable" : `Preview ${side === "buy" ? "Buy" : "Sell"} ${baseAsset}`}
          </button>

          <div className="availability-card">
            <strong>Supported order types</strong>
            <span>Market + Limit are implemented by the backend adapter.</span>
          </div>
        </aside>
      </section>

      <section className="market-data-panels">
        <section className="panel mini-panel">
          <div className="panel-title"><b>Order Book</b><span>Level-2</span></div>
          <div className="availability-card large">
            <strong>Order book unavailable</strong>
            <span>The current backend does not expose live bid/ask depth or a depth WebSocket for TradeLab.</span>
            <small>Backend change required: add an authenticated/public market-depth stream endpoint and normalize bids, asks, size, and spread for the supported exchange adapters.</small>
          </div>
        </section>
        <section className="panel mini-panel">
          <div className="panel-title"><b>Recent Trades</b><span>Live tape</span></div>
          <div className="availability-card large">
            <strong>Recent trades unavailable</strong>
            <span>The current backend does not expose a normalized live trade stream.</span>
            <small>Backend change required: add an aggTrade/trade stream endpoint and return price, amount, side/aggressor, and timestamp.</small>
          </div>
        </section>
      </section>

      <section className="bottom panel">
        <div className="panel-title">
          <b>Positions & Orders</b>
          <div className="tabs">
            <button className={activeTab === "positions" ? "tab active" : "tab"} onClick={() => setActiveTab("positions")}>Positions</button>
            <button className={activeTab === "open" ? "tab active" : "tab"} onClick={() => setActiveTab("open")}>Open Orders</button>
            <button className={activeTab === "history" ? "tab active" : "tab"} onClick={() => setActiveTab("history")}>Order History</button>
            <button className="tab disabled" type="button" title="Trade history is not exposed by the current backend adapter">Trade History</button>
          </div>
        </div>
        {!selectedExchangeId && (
          <div className="empty"><strong>Connect an exchange</strong><span>Select a connected exchange to load your trading data.</span></div>
        )}
        {selectedExchangeId && activeTab === "positions" && selectedExchange?.market_type === "spot" && (
          <div className="empty"><strong>Positions are not applicable to spot</strong><span>Connect a futures account to view leveraged positions.</span></div>
        )}
        {selectedExchangeId && activeTab === "positions" && selectedExchange?.market_type !== "spot" && (
          positions.length ? <div className="position-list">{positions.map((item, index) => {
            const positionSide = String(item.side || "—").toUpperCase();
            const contracts = Number(item.contracts ?? item.amount ?? item.quantity ?? 0);
            const entry = Number(item.entryPrice ?? item.entry_price ?? 0);
            const mark = Number(item.markPrice ?? item.mark_price ?? price ?? 0);
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
                <b>Review order</b>
                <small>{side === "buy" ? "Buy" : "Sell"} {symbol} · confirm before sending to the exchange.</small>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)}>×</button>
            </div>
            <div className="order-confirm">
              <div><span>Side</span><b className={side === "buy" ? "up" : "down"}>{side.toUpperCase()}</b></div>
              <div><span>Pair</span><b>{symbol}</b></div>
              <div><span>Type</span><b>{orderType.toUpperCase()}</b></div>
              <div><span>Amount</span><b>{amount} {baseAsset}</b></div>
              {orderType === "limit" && <div><span>Limit price</span><b>{formatMarketNumber(Number(priceInput || 0), 8)}</b></div>}
              {orderType === "market" && <div><span>Estimated market price</span><b>{price == null ? "—" : formatMarketNumber(price, 2)}</b></div>}
              <div><span>Estimated total</span><b>{estimatedCost > 0 ? `${formatMarketNumber(estimatedCost, 2)} ${quoteAsset}` : "—"}</b></div>
              <div><span>Execution</span><b>{selectedExchange?.exchange_name || "Connected exchange"}</b></div>
            </div>
            <div className="notice">
              Market price and total are estimates for market orders. The exchange determines the final execution price and fill.
            </div>
            {orderMessage && <div className="order-message">{orderMessage}</div>}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPreviewOpen(false)} disabled={orderSubmitting}>Cancel</button>
              <button className="primary" onClick={submitOrder} disabled={orderSubmitting}>
                {orderSubmitting ? "Submitting…" : `Confirm ${side === "buy" ? "Buy" : "Sell"}`}
              </button>
            </div>
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
            <select
              value={exchangeName}
              onChange={(e) => {
                const nextName = e.target.value;
                setExchangeName(nextName);
                const meta = SUPPORTED_EXCHANGES.find((item) => item.value === nextName);
                if (meta && !meta.marketTypes.includes(marketType)) setMarketType(meta.marketTypes[0]);
              }}
            >
              {SUPPORTED_EXCHANGES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select value={marketType} onChange={(e) => setMarketType(e.target.value)}>
              {(SUPPORTED_EXCHANGES.find((item) => item.value === exchangeName)?.marketTypes || ["spot"]).map((type) => (
                <option key={type} value={type}>{type === "usdm" ? "USDT-M Futures" : "Spot"}</option>
              ))}
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
                  onClick={() => {
                    setExchangeName(exchange.exchange_name);
                    setMarketType(exchange.market_type);
                    loadBalance(exchange.id);
                  }}
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

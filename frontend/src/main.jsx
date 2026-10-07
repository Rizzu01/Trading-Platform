import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import MarketChart from "./components/MarketChart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const BINANCE_DATA_BASE = "https://data-api.binance.vision";
const BINANCE_STREAM_BASE = "wss://data-stream.binance.vision/ws";
const BINANCE_FUTURES_DATA_BASE = "https://fapi.binance.com";
const BINANCE_FUTURES_STREAM_BASE = "wss://fstream.binance.com/market";

let refreshPromise = null;

async function refreshSession() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
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
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
  const [orderType, setOrderType] = useState("market");
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
  const [activeTab, setActiveTab] = useState("balances");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [dataState, setDataState] = useState({ positions: "", open: "", history: "" });
  const [theme, setTheme] = useState(() => localStorage.getItem("tradelab-theme") || "system");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

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
    const handleShortcut = (event) => {
      const tag = event.target?.tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const isFutures = marketType === "usdm";

    const loadCandles = async () => {
      setMarketLoading(true);
      setMarketError("");

      const normalizedSymbol = symbol.replace("/", "").toUpperCase();
      const query = new URLSearchParams({
        symbol: normalizedSymbol,
        interval: timeframe,
        limit: "120",
      });

      const endpoints = isFutures
        ? [`${BINANCE_FUTURES_DATA_BASE}/fapi/v1/klines?${query.toString()}`]
        : [
            `${BINANCE_DATA_BASE}/api/v3/klines?${query.toString()}`,
            `https://api.binance.com/api/v3/klines?${query.toString()}`,
          ];

      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { signal: controller.signal });

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

    setCandles([]);
    loadCandles()
      .catch((error) => {
        if (error.name !== "AbortError") {
          setCandles([]);
          setMarketError(
            isFutures
              ? "USDⓈ-M Futures market data is unavailable."
              : "Live market data is unavailable."
          );
        }
      })
      .finally(() => setMarketLoading(false));

    return () => controller.abort();
  }, [symbol, timeframe, marketType]);

  useEffect(() => {
    const isFutures = marketType === "usdm";
    const tickerStreams = MARKETS.map((item) => `${item.symbol.replace("/", "").toLowerCase()}@ticker`).join("/");
    const tickerUrl = isFutures
      ? `${BINANCE_FUTURES_STREAM_BASE}/stream?streams=${tickerStreams}`
      : `wss://data-stream.binance.vision/stream?streams=${tickerStreams}`;
    const normalizedSymbol = symbol.replace("/", "").toLowerCase();
    let tickerSocket;
    let klineSocket;
    let tickerRetry;
    let klineRetry;
    let tickerAttempt = 0;
    let klineAttempt = 0;
    let disposed = false;

    setMarketConnection("connecting");
    setConnected(false);
    setChartConnected(false);
    setMarketData({});
    setTicker(null);

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

      setTicker((current) => ({
        ...(current || {}),
        symbol: k.s || normalizedSymbol.toUpperCase(),
        last: nextCandle.close,
        high: current?.high ?? nextCandle.high,
        low: current?.low ?? nextCandle.low,
        volume: current?.volume ?? nextCandle.volume,
      }));
    };

    const connectKline = () => {
      if (disposed) return;

      try {
        const klineBase = isFutures
          ? BINANCE_FUTURES_STREAM_BASE
          : BINANCE_STREAM_BASE;
        const klineUrl = `${klineBase}/${normalizedSymbol}@kline_${timeframe}`;
        klineSocket = new WebSocket(klineUrl);
        klineSocket.onopen = () => {
          klineAttempt = 0;
          setChartConnected(true);
        };
        klineSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            upsertKline(message.data || message);
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
  }, [symbol, timeframe, marketType]);

  const submitAuth = async () => {
    setAuthMessage("Connecting...");
    const endpoint = authMode === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const payload = authMode === "register" ? { full_name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword };
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
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
    } catch (error) {
      setAuthMessage(error.name === "TypeError" ? "Backend unavailable or network error." : error.message);
    }
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

      const readResult = async (response, fallback) => {
        const payload = await response.json().catch(() => ({}));
        return response.ok
          ? { payload, error: "" }
          : { payload: null, error: formatApiError(response.status, payload, fallback) };
      };

      const [positionsResult, openResult, historyResult] = await Promise.all([
        readResult(positionsResponse, "Unable to load positions."),
        readResult(openResponse, "Unable to load open orders."),
        readResult(historyResponse, "Unable to load order history."),
      ]);

      if (positionsResult.payload) setPositions(positionsResult.payload.positions || []); else setPositions([]);
      if (openResult.payload) setOpenOrders(openResult.payload.orders || []); else setOpenOrders([]);
      if (historyResult.payload) setOrderHistory(historyResult.payload.orders || []); else setOrderHistory([]);
      setDataState({ positions: positionsResult.error, open: openResult.error, history: historyResult.error });
    } catch (error) {
      setPositions([]);
      setOpenOrders([]);
      setOrderHistory([]);
      setDataState({ positions: error.message || "Unable to load positions.", open: error.message || "Unable to load open orders.", history: error.message || "Unable to load order history." });
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
      if (data?.id) {
        setExchangeName(data.exchange_name || exchangeName);
        setMarketType(data.market_type || marketType);
        await loadBalance(data.id);
      }
    } catch (error) {
      setExchangeMessage(error.message);
    } finally {
      setExchangeSubmitting(false);
    }
  };

  const cancelOrder = async (order) => {
    if (!selectedExchangeId || !order?.external_order_id) return;
    setOrderMessage("");
    try {
      const response = await authFetch(
        `${API_BASE}/api/v1/orders/${selectedExchangeId}/${encodeURIComponent(order.external_order_id)}?symbol=${encodeURIComponent(order.symbol || symbol)}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(formatApiError(response.status, data, "Unable to cancel order."));
      setOrderMessage(`Order ${order.external_order_id} cancelled successfully.`);
      await loadTradingData(selectedExchangeId);
    } catch (error) {
      setOrderMessage(error.message);
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

  const normalizedCurrentSymbol = symbol.replace("/", "").toUpperCase();
  const selectedExchange = exchanges.find((item) => item.id === selectedExchangeId);
  const selectedMarketMatchesMode = Boolean(selectedExchange && selectedExchange.market_type === marketType);
  const marketFeedForMode = marketType === "spot" || marketType === "usdm";
  const displayedMarketConnection = marketConnection;
  const activeMarket = marketData[normalizedCurrentSymbol]
    || (ticker?.symbol === normalizedCurrentSymbol ? ticker : null);
  const price = marketFeedForMode && Number.isFinite(Number(activeMarket?.last)) ? Number(activeMarket.last) : null;
  const high = marketFeedForMode && Number.isFinite(Number(activeMarket?.high)) ? Number(activeMarket.high) : null;
  const low = marketFeedForMode && Number.isFinite(Number(activeMarket?.low)) ? Number(activeMarket.low) : null;
  const volume = marketFeedForMode && Number.isFinite(Number(activeMarket?.volume)) ? Number(activeMarket.volume) : null;
  const changePercent = marketFeedForMode && Number.isFinite(Number(activeMarket?.changePercent)) ? Number(activeMarket.changePercent) : null;

  const baseAsset = symbol.split("/")[0];
  const quoteAsset = symbol.split("/")[1] || "USDT";
  const activeBalance = selectedMarketMatchesMode ? balance : null;
  const quoteBalance = getBalanceAsset(activeBalance, quoteAsset);
  const baseBalance = getBalanceAsset(activeBalance, baseAsset);
  const effectivePrice = orderType === "limit" ? Number(priceInput || 0) : Number(price || 0);
  const estimatedCost = Number(amount || 0) * effectivePrice;
  const priceAvailable = marketFeedForMode && Number.isFinite(price) && price > 0 && marketConnection === "connected";
  const orderPriceAvailable = orderType === "market"
    ? priceAvailable
    : Number.isFinite(Number(priceInput)) && Number(priceInput) > 0;


  const filteredMarkets = MARKETS.filter((item) => {
    const query = marketSearch.trim().toLowerCase();
    return !query || item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
  });

  const previewOrder = () => {
    setOrderMessage("");
    const quantity = Number(amount);
    const selectedPrice = orderType === "limit" ? Number(priceInput) : Number(price);

    if (!selectedExchangeId) {
      setOrderMessage("Connect an exchange before placing an order.");
      return;
    }
    if (marketType === "usdm") {
      setOrderMessage("Futures market data is live, but futures order execution is not enabled yet.");
      return;
    }
    if (orderType === "market" && !priceAvailable) {
      setOrderMessage("Live market price is unavailable. Market order submission is disabled.");
      return;
    }
    if (orderType === "limit" && !orderPriceAvailable) {
      setOrderMessage("Enter a valid limit price.");
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
      if (marketType === "usdm") {
        throw new Error("Futures market data is live, but futures order execution is not enabled yet.");
      }
      if (!selectedMarketMatchesMode) {
        throw new Error(`Connect a ${marketType === "usdm" ? "Binance USDT-M Futures" : "Spot"} account for this order panel.`);
      }


      const suffix = orderType === "market" ? `market-${side}` : `limit-${side}`;
      const payload = {
        symbol,
        amount: Number(amount),
        ...(orderType === "limit" ? { price: Number(priceInput) } : {}),
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
            ref={searchInputRef}
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Search symbol, token or pair"
            aria-label="Search markets"
          />
          <kbd>⌘ K</kbd>
        </label>

        <nav className="topnav" aria-label="Primary navigation">
          <button className="nav-link active" type="button">Trade</button>
          <button className="nav-link" type="button" disabled title="Markets page is not implemented yet">Markets</button>
          <button className="nav-link" type="button" disabled title="Portfolio page is not implemented yet">Portfolio</button>
          <button className="nav-link" type="button" disabled title="Orders page is not implemented yet">Orders</button>
        </nav>

        <div className="top-actions">
          <div className={`market-connection ${displayedMarketConnection}`}>
            <i />
            <span>{displayedMarketConnection === "connected" ? "Live" : displayedMarketConnection === "reconnecting" ? "Reconnecting" : displayedMarketConnection === "connecting" ? "Connecting" : displayedMarketConnection === "error" ? "Error" : "Disconnected"}</span>
          </div>
          <button className="icon-button" type="button" disabled title="Notifications are not backed by a notification API yet">♧</button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title="Toggle dark/light theme"
            aria-label="Toggle dark/light theme"
          >
            {theme === "light" ? "☼" : "☾"}
          </button>
          <button className="icon-button" type="button" disabled title="Settings are not implemented yet">☷</button>
          <div className="account-wrap">
            <button className="profile" onClick={() => setAccountMenuOpen((value) => !value)} aria-expanded={accountMenuOpen}>
              Connect account
            </button>
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
        <button className="market-favorite" type="button" disabled title="Favorites are not backed by persisted market preferences yet">☆</button>
        <button className="pair-selector" type="button">
          <strong>{symbol}⌄</strong>
          <small>{MARKETS.find((item) => item.symbol === symbol)?.name || "Market asset"} / {quoteAsset}</small>
        </button>

        <div className="market-price">
          <b>{price == null ? "—" : `$${formattedPrice}`}</b>
          <small className={changePercent != null && changePercent >= 0 ? "up" : "down"}>
            {changePercent == null ? "Unavailable" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
          </small>
        </div>

        <div className="market-stat">
          <small>24h high</small>
          <b>{formattedHigh === "—" ? "—" : `$${formattedHigh}`}</b>
        </div>
        <div className="market-stat">
          <small>24h low</small>
          <b>{formattedLow === "—" ? "—" : `$${formattedLow}`}</b>
        </div>
        <div className="market-stat">
          <small>24h volume</small>
          <b>{formattedVolume}</b>
          <span>Reported live</span>
        </div>
        <div className="market-stat">
          <small>24h change</small>
          <b className={changePercent != null && changePercent >= 0 ? "up" : "down"}>
            {changePercent == null ? "—" : `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
          </b>
        </div>

        <div className="market-context">
          <div className="status-badge-inline">
            <i />
            <span>{displayedMarketConnection === "connected" ? "Live" : displayedMarketConnection === "reconnecting" ? "Reconnecting" : displayedMarketConnection === "connecting" ? "Connecting" : "Unavailable"}</span>
          </div>
          <small>{marketType === "usdm" ? "Binance USDⓈ-M Futures public market feed" : "Binance public spot feed"}</small>
        </div>

        <div className="market-mode">
          <button className={marketType === "spot" ? "active" : ""} type="button" onClick={() => setMarketType("spot")}>SPOT</button>
          <button className={marketType === "usdm" ? "active" : ""} type="button" onClick={() => setMarketType("usdm")}>FUTURES</button>
        </div>
      </section>

      <section className="workspace">
        <aside className="markets panel">
          <div className="panel-title">
            <b>Markets</b>
            <span>4 pairs · ⋯ · −</span>
          </div>

          <div className="market-search">
            <label>Search markets</label>
            <div className="market-search-field">
              <input
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                placeholder="Symbol or token"
                aria-label="Filter markets"
              />
              <span>⌕</span>
            </div>
          </div>

          <div className="market-filter-row">
            <button type="button" disabled title="Favorites are not backed by persisted market preferences yet">Favorites</button>
            <button className="active" type="button">USDT</button>
            <button type="button" disabled title="USDC pairs are not connected to this market list yet">USDC</button>
            <button type="button" disabled title="INR pairs are not connected to this market list yet">INR</button>
          </div>

          <div className="market-table-header">
            <span>Pair</span>
            <span>Price / 24h</span>
          </div>

          <div className="market-list">
            {filteredMarkets.map((item) => {
              const data = marketData[item.symbol.replace("/", "")] || null;
              const change = Number.isFinite(Number(data?.changePercent)) ? Number(data.changePercent) : null;
              return (
                <button
                  className={`market-row market-button ${item.symbol === symbol ? "selected" : ""}`}
                  key={item.symbol}
                  type="button"
                  onClick={() => { setSymbol(item.symbol); setPriceInput(""); }}
                >
                  <span className="market-main">
                    <span className="favorite" aria-hidden="true">☆</span>
                    <span>
                      <b>{item.symbol}</b>
                      <small>{item.name}</small>
                    </span>
                  </span>
                  <span className="market-snapshot">
                    <b>{data?.last != null ? formatMarketNumber(data.last, 2) : "—"}</b>
                    <em className={change != null && change >= 0 ? "up" : "down"}>
                      {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="evidence-note">
            <b>{marketType === "usdm" ? "USDⓈ-M Futures feed" : "Spot feed"}</b>
            <span>{marketType === "usdm" ? "Live Binance futures tickers and klines are connected." : "Live Binance spot tickers and klines are connected."}</span>
          </div>
        </aside>

        <section className="chart panel">
          <div className="panel-title">
            <b>{symbol} · {MARKETS.find((item) => item.symbol === symbol)?.name || "Market"}</b>
            <span>{displayedMarketConnection === "connected" ? "Live feed" : displayedMarketConnection === "reconnecting" ? "Reconnecting" : "Feed unavailable"} · ⋯ · −</span>
          </div>

          <div className="chart-toolbar">
            <div className="chart-timeframes">
              {MARKET_TIMEFRAMES.map((value) => (
                <button key={value} className={timeframe === value ? "active" : ""} type="button" onClick={() => setTimeframe(value)}>
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="chart-tools">
              <button type="button" disabled>⌖</button>
              <button type="button" disabled>◉</button>
              <button type="button" disabled>−</button>
              <button type="button" disabled>□</button>
              <button type="button" disabled>⌁</button>
              <button type="button" disabled>📏</button>
              <button type="button" disabled>◌</button>
              <button type="button" disabled>🔒</button>
              <button type="button" disabled>◒ Chart type</button>
              <button type="button" disabled>⚙</button>
              <button type="button" disabled>⛶</button>
            </div>
          </div>

          <div className="chart-area">
            <div className="chart-tools-rail">
              <button type="button" disabled>⌖</button>
              <button type="button" disabled>◉</button>
              <button type="button" disabled>−</button>
              <button type="button" disabled>□</button>
              <button type="button" disabled>⌁</button>
              <button type="button" disabled>📏</button>
              <button type="button" disabled>◌</button>
              <button type="button" disabled>🔒</button>
            </div>
            <div className="chart-stage">
              <MarketChart
                candles={candles}
                symbol={symbol}
                connected={chartConnected}
                loading={marketLoading}
                error={marketError}
                theme={theme}
              />
            </div>
          </div>

          <div className="chart-source-row">
            <span>{marketType === "usdm" ? "Binance USDⓈ-M Futures · klines + live kline stream" : "Binance Spot · klines + live kline stream"}</span>
            <span>Volume · Crosshair · UTC</span>
          </div>

          <div className="market-data-panels">
            <section className="mini-panel">
              <div className="panel-title">
                <b>Order book</b>
                <span>Depth / Trades · ⋯ · −</span>
              </div>
              <div className="mini-meta">
                <span>Depth · unavailable</span>
                <span>0.01 / 0.1 / 1 · disabled</span>
              </div>
              <div className="mini-table-header">
                <span>Price (USDT)</span>
                <span>Amount (BTC)</span>
                <span>Total (BTC)</span>
              </div>
              <div className="mini-empty">
                <strong>Order book unavailable</strong>
                <span>The connected market-data adapter does not currently provide live depth data.</span>
                <small>Requirement: authenticated/public depth WebSocket stream.</small>
              </div>
            </section>

            <section className="mini-panel">
              <div className="panel-title">
                <b>Recent trades</b>
                <span>Not supplied · ⋯ · −</span>
              </div>
              <div className="mini-table-header">
                <span>Price (USDT)</span>
                <span>Amount (BTC)</span>
                <span>Time</span>
              </div>
              <div className="mini-empty recent">
                <strong>Recent trades unavailable</strong>
                <span>The current backend does not expose a normalized live trade stream.</span>
              </div>
            </section>
          </div>
        </section>

        <aside className="order panel">
          <div className="panel-title">
            <b>Order entry</b>
            <span>{marketType === "usdm" ? "USDT-M" : "Spot"} · ⋯ · −</span>
          </div>

          {marketType === "usdm" && (
            <div className="notice warning">
              Futures market data is live. Order execution remains disabled until the futures order flow is separately verified.
            </div>
          )}

          <div className="segmented">
            <button className={side === "buy" ? "active buy" : ""} type="button" onClick={() => setSide("buy")}>Buy</button>
            <button className={side === "sell" ? "active sell" : ""} type="button" onClick={() => setSide("sell")}>Sell</button>
          </div>

          <div className="order-type-tabs">
            <button className={orderType === "market" ? "active" : ""} type="button" onClick={() => { setOrderType("market"); setOrderMessage(""); }}>Market</button>
            <button className={orderType === "limit" ? "active" : ""} type="button" onClick={() => { setOrderType("limit"); setOrderMessage(""); }}>Limit</button>
          </div>

          <div className="balance-display">
            <span>Available {quoteAsset} balance</span>
            <b>{quoteBalance ? formatMarketNumber(quoteBalance.free, 2) : "—"}</b>
            <small>{selectedExchange && selectedMarketMatchesMode ? `${selectedExchange.exchange_name} · ${selectedExchange.market_type}` : "Authentication required"}</small>
          </div>

          {orderType === "limit" && (
            <label className="order-field">Price
              <div className="field-with-unit">
                <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" placeholder={price != null ? formattedPrice : "Live price unavailable"} />
                <span>{quoteAsset}</span>
              </div>
            </label>
          )}

          <label className="order-field">Amount
            <div className="field-with-unit">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
              <span>{baseAsset}</span>
            </div>
          </label>

          <div className="percentage-row">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={(!quoteBalance && side === "buy") || (!baseBalance && side === "sell")}
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

          <div className="estimate">
            <div><span>Estimated total</span><b>{estimatedCost > 0 ? `${formatMarketNumber(estimatedCost, 2)} ${quoteAsset}` : "—"}</b></div>
            <div><span>Fee</span><b>Unavailable</b></div>
            <div><span>Reference price</span><b>{price == null ? "—" : `${formatMarketNumber(price, 2)} ${quoteAsset}`}</b></div>
            <small>Reference price only · not an executable quote</small>
          </div>

          {orderMessage && <div className="order-message">{orderMessage}</div>}

          <button
            className="primary"
            disabled={orderSubmitting || !selectedExchangeId || !selectedMarketMatchesMode || !orderPriceAvailable || marketType === "usdm"}
            onClick={previewOrder}
          >
            {marketType === "usdm"
              ? "Futures execution unavailable"
              : orderSubmitting
                ? "Submitting…"
                : !selectedExchangeId
                  ? "Connect account"
                  : !selectedMarketMatchesMode
                    ? `Connect ${marketType === "spot" ? "Spot" : "Futures"} account`
                    : !orderPriceAvailable
                      ? (orderType === "market" ? "Live price unavailable" : "Enter limit price")
                      : `Preview ${side === "buy" ? "Buy" : "Sell"} ${baseAsset}`}
          </button>

          <small className="order-footnote">Connect an account and obtain a validated quote to preview an order.</small>
        </aside>
      </section>

      <section className="bottom panel">
        <div className="account-resize-handle"><span /></div>
        <div className="account-head">
          <div className="account-tabs">
            <button className={activeTab === "balances" ? "tab active" : "tab"} type="button" onClick={() => setActiveTab("balances")}>Balances</button>
            <button className={activeTab === "open" ? "tab active" : "tab"} type="button" onClick={() => setActiveTab("open")}>Open Orders</button>
            <button className={activeTab === "history" ? "tab active" : "tab"} type="button" onClick={() => setActiveTab("history")}>Order History</button>
            <button className="tab" type="button" disabled title="Trade history is not exposed by the current backend adapter">Trade History</button>
            {marketType === "usdm" && <button className={activeTab === "positions" ? "tab active" : "tab"} type="button" onClick={() => setActiveTab("positions")}>Positions</button>}
          </div>
          <span className="account-state">{selectedExchangeId ? `${selectedExchange?.exchange_name || "Connected"} · ${selectedExchange?.market_type || "account"}⌄` : "Authentication required  ˅"}</span>
        </div>
        {!selectedExchangeId && (
          <div className="empty"><strong>Connect an exchange</strong><span>Select a connected exchange to load your trading data.</span></div>
        )}
        {selectedExchangeId && !selectedMarketMatchesMode && (
          <div className="empty"><strong>Account mode mismatch</strong><span>Selected account is {selectedExchange?.market_type || "unknown"}; switch the terminal to the matching mode.</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "balances" && (
          <div className="account-balance-table">
            <div className="balance-row balance-heading">
              <span>Asset</span>
              <span>Available</span>
              <span>In orders</span>
              <span>Total</span>
              <span>Value (USDT)</span>
              <span>Actions</span>
            </div>
            {Array.isArray(balance) && balance.length ? balance.slice(0, 12).map((item, index) => {
              const free = Number(item.free || 0);
              const used = Number(item.used || 0);
              const total = Number(item.total ?? free + used);
              const tickerKey = String(item.asset || "").toUpperCase() + "USDT";
              const conversion = item.asset === "USDT" ? 1 : Number(marketData[tickerKey]?.last || 0);
              const value = conversion > 0 ? total * conversion : null;
              return (
                <div className="balance-row" key={item.asset || index}>
                  <span><b>{item.asset || "—"}</b></span>
                  <span>{formatMarketNumber(free, 6)}</span>
                  <span>{formatMarketNumber(used, 6)}</span>
                  <span>{formatMarketNumber(total, 6)}</span>
                  <span>{value == null ? "—" : formatMarketNumber(value, 2)}</span>
                  <span><button className="row-action" type="button" disabled title="Asset action controls are not implemented yet">—</button></span>
                </div>
              );
            }) : (
              <div className="empty small"><strong>No balance rows returned</strong><span>The connected exchange returned no balances for this account.</span></div>
            )}
          </div>
        )}

        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "positions" && dataState.positions && (
          <div className="availability-card large"><strong>Positions unavailable</strong><span>{dataState.positions}</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "positions" && selectedExchange?.market_type === "spot" && (
          <div className="empty"><strong>Positions are not applicable to spot</strong><span>Connect a futures account to view leveraged positions.</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && !dataState.positions && activeTab === "positions" && selectedExchange?.market_type !== "spot" && (
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
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "open" && dataState.open && (
          <div className="availability-card large"><strong>Open orders unavailable</strong><span>{dataState.open}</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "open" && !dataState.open && (
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
                <span>
                  <em className="status-badge">{item.status || "open"}</em>
                  <button className="cancel-order-button" type="button" onClick={() => cancelOrder(item)}>Cancel</button>
                </span>
              </div>;
            })}
          </div></div> : <div className="empty"><strong>No open orders</strong><span>Open orders for {symbol} will appear here.</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "history" && dataState.history && (
          <div className="availability-card large"><strong>Order history unavailable</strong><span>{dataState.history}</span></div>
        )}
        {selectedExchangeId && selectedMarketMatchesMode && activeTab === "history" && !dataState.history && (
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

      <footer className="terminal-footer">
        <span>TRADING LAB / Evidence-safe workspace</span>
        <span>{displayedMarketConnection === "connected" ? "Live market feed" : "Reference snapshot · not live"} · Account {selectedExchangeId ? "connected" : "not connected"} · Market + Limit only</span>
      </footer>

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

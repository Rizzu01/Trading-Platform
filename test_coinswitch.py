from exchanges.coinswitch import CoinSwitchExchange

exchange = CoinSwitchExchange(
    api_key="57b96e6f209d09d7acf6c1a01da6299bfa471da4a8a4cb122c174764b4c11cac",
    api_secret="37352b4a5c5ec239797067ef658909dfeea8ee71f650d2e846bff62da3b89646",
)



ticker = exchange.get_ticker("BTC/INR")

price = float(ticker["lastPrice"])

print("Current Price:", price)

result = exchange.limit_buy(
    symbol="BTC/INR",
    quantity=0.00003,
    price=price,
)

print(result)
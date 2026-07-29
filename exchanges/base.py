from abc import ABC, abstractmethod


class ExchangeBase(ABC):

    @abstractmethod
    def validate_credentials(self):
        pass

    @abstractmethod
    def get_balance(self):
        pass

    @abstractmethod
    def get_positions(self):
        pass

    @abstractmethod
    def get_open_orders(self):
        pass

    @abstractmethod
    def fetch_ticker(self, symbol: str):
        pass

    @abstractmethod
    def place_market_order(
        self,
        symbol: str,
        side: str,
        amount: float,
    ):
        pass

    @abstractmethod
    def cancel_order(
        self,
        order_id: str,
        symbol: str,
    ):
        pass
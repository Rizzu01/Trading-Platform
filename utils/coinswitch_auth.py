import time
import urllib.parse

from cryptography.hazmat.primitives.asymmetric import ed25519


class CoinSwitchSigner:

    def __init__(self, api_key: str, secret_key: str):
        self.api_key = api_key
        self.secret_key = secret_key

    def sign_request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
    ):
        method = method.upper()

        if params:
            separator = "&" if "?" in path else "?"
            path = path + separator + urllib.parse.urlencode(params)

        decoded_path = urllib.parse.unquote_plus(path)

        epoch = str(int(time.time() * 1000))

        message = method + decoded_path + epoch

        private_key = ed25519.Ed25519PrivateKey.from_private_bytes(
            bytes.fromhex(self.secret_key)
        )

        signature = private_key.sign(
            message.encode("utf-8")
        ).hex()

        headers = {
            "Content-Type": "application/json",
            "X-AUTH-APIKEY": self.api_key,
            "X-AUTH-SIGNATURE": signature,
            "X-AUTH-EPOCH": epoch,
        }

        return headers, decoded_path
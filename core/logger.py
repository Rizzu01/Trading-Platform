import logging
import os
from logging.handlers import TimedRotatingFileHandler


LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)


LOG_FORMAT = (
    "%(asctime)s | %(levelname)s | %(name)s | "
    "%(filename)s:%(lineno)d | %(message)s"
)


formatter = logging.Formatter(LOG_FORMAT)


logger = logging.getLogger("TradingPlatform")
logger.setLevel(logging.INFO)

# Prevent duplicate logs
logger.propagate = False

# Avoid adding handlers multiple times during reload
if not logger.handlers:

    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Info Log
    info_handler = TimedRotatingFileHandler(
        filename=os.path.join(LOG_DIR, "info.log"),
        when="midnight",
        backupCount=30,
        encoding="utf-8",
    )
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(formatter)
    logger.addHandler(info_handler)

    # Error Log
    error_handler = TimedRotatingFileHandler(
        filename=os.path.join(LOG_DIR, "error.log"),
        when="midnight",
        backupCount=30,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    logger.addHandler(error_handler)
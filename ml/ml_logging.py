"""
ML Console Logging & Diagnostics Subsystem for Scribe & Spire.
Provides structured terminal logging with timestamps, visual headers,
configurable verbosity, and standard metric formatting across all ML modules.
"""

import os
import sys
import logging
from datetime import datetime
from typing import Optional


def is_ml_verbose() -> bool:
    """Check if detailed diagnostics logging is enabled (defaults to True)."""
    return os.getenv("ML_VERBOSE_LOGS", "true").lower() in ("true", "1", "yes")


def get_ml_logger(name: str) -> logging.Logger:
    """
    Returns a configured structured logger with StreamHandler and standard timestamp formatting.
    """
    logger_name = f"scribe_spire.ml.{name}"
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.INFO)

    # Attach handler if not already attached to this logger
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.propagate = False

    return logger


def format_header(title: str, width: int = 80) -> str:
    """Produces a clean visual heading banner."""
    return f"\n{'=' * width}\n[ML ENGINE] {title}\n{'-' * width}"


def format_footer(width: int = 80) -> str:
    """Produces a clean visual footer border."""
    return f"{'=' * width}\n"

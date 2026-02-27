from __future__ import annotations

import argparse
import logging
import os
import time
from pathlib import Path


def configure_logging(log_file: str) -> None:
    path = Path(log_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Hyperion terminal monitor")
    parser.add_argument("--log-file", required=False, default=os.environ.get("MONITOR_LOG_FILE", ""))
    args = parser.parse_args()

    if not args.log_file:
        raise SystemExit("MONITOR_LOG_FILE or --log-file must be set")

    configure_logging(args.log_file)
    logging.info("Ops monitor process started")

    while True:
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())

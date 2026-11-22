"""Settings from environment variables (systemd EnvironmentFile on the Pi)."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    data_dir: Path
    watch_iface: str | None = None       # e.g. eth0 / wlan0 / br0; unset = watcher off
    scanner_device: str | None = None    # /dev/input/by-id/...-event-kbd; unset = off
    arp_path: str = "/proc/net/arp"
    start_threads: bool = True

    @property
    def db_path(self):
        return self.data_dir / "bench.db"

    @property
    def media_dir(self):
        return self.data_dir / "media"

    @classmethod
    def from_env(cls):
        return cls(
            data_dir=Path(os.environ.get("BENCH_DATA_DIR", "./var")).resolve(),
            watch_iface=os.environ.get("BENCH_WATCH_IFACE") or None,
            scanner_device=os.environ.get("BENCH_SCANNER_DEVICE") or None,
            arp_path=os.environ.get("BENCH_ARP_PATH", "/proc/net/arp"),
        )

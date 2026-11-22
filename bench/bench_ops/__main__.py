"""python -m bench_ops serve | migrate"""

import argparse
import logging
import os


def main():
    parser = argparse.ArgumentParser(prog="bench_ops")
    sub = parser.add_subparsers(dest="cmd", required=True)
    serve = sub.add_parser("serve", help="run the appliance")
    serve.add_argument("--host", default=os.environ.get("BENCH_HOST", "0.0.0.0"))
    serve.add_argument("--port", type=int, default=int(os.environ.get("BENCH_PORT", "80")))
    sub.add_parser("migrate", help="create/upgrade the database and seed QC templates, then exit")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    from . import db, qc
    from .config import Settings

    settings = Settings.from_env()
    if args.cmd == "migrate":
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        conn = db.connect(settings.db_path)
        print("applied:", db.migrate(conn) or "nothing new")
        print("seeded templates:", qc.seed_templates(conn) or "none new")
        return

    import uvicorn

    from .web import create_app

    # One process, one worker: the watcher/scanner threads live in it.
    uvicorn.run(create_app(settings), host=args.host, port=args.port, workers=1, proxy_headers=False,
                server_header=False, log_level="info")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Register we-adk on the shared Mac mini nginx edge.

    python3 deploy/patch-edge.py

Adds an upstream and a /adk/ route to the edge's nginx.conf, next to the four
routes already there. Idempotent — running it twice does nothing. Writes a
timestamped .bak beside the file first.

It deliberately does not touch macmini-tunnel. That container is a free Quick
Tunnel: its public URL is shared by every project on this machine and is
re-minted on every recreate, so the config change is applied with
`nginx -s reload` instead. See deploy/EDGE.md.

After running it:

    docker exec macmini-edge nginx -t && docker exec macmini-edge nginx -s reload
"""

from __future__ import annotations

import shutil
import sys
import time
from pathlib import Path

DEFAULT_CONF = "/Users/kosign/Projects/we-testcase-ms/deploy/edge/nginx.conf"
PORT = 3003
PREFIX = "adk"


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CONF)
    if not path.is_file():
        print(f"no nginx.conf at {path}", file=sys.stderr)
        return 1

    s = path.read_text()
    if "upstream weadk" in s:
        print("already registered — nothing to do")
        return 0

    # 1. Upstream, after ohmycmo's.
    up = (
        "  upstream ohmycmo {\n"
        "    server host.docker.internal:8889;\n"
        "    keepalive 8;\n"
        "  }\n"
    )
    if s.count(up) != 1:
        print("could not find the ohmycmo upstream — patch by hand", file=sys.stderr)
        return 1
    s = s.replace(
        up,
        up + f"\n  upstream weadk {{\n    server host.docker.internal:{PORT};\n"
             "    keepalive 8;\n  }\n",
        1,
    )

    # 2. Path prefix on the default server, after the /ohmycmo pair. This is the
    #    part that makes the public tunnel URL work.
    loc = (
        "    location = /ohmycmo {\n"
        "      proxy_pass http://ohmycmo$uri$is_args$args;\n"
        "    }\n"
    )
    if s.count(loc) != 1:
        print("could not find the /ohmycmo location — patch by hand", file=sys.stderr)
        return 1
    s = s.replace(
        loc,
        loc
        + f"\n    location /{PREFIX}/ {{\n      proxy_pass http://weadk$uri$is_args$args;\n    }}\n"
        + f"\n    location = /{PREFIX} {{\n      proxy_pass http://weadk$uri$is_args$args;\n    }}\n",
        1,
    )

    # 3. Header comment, so the edge keeps documenting itself.
    hdr = "#   /ohmycmo/     → OhMyCMO      :8889"
    line = next((l for l in s.splitlines() if l.startswith(hdr)), None)
    if line:
        s = s.replace(
            line + "\n",
            line + f"\n#   /{PREFIX}/         → WE-ADK       :{PORT}  (Next basePath=/{PREFIX})\n",
            1,
        )

    backup = path.with_suffix(path.suffix + f".bak.{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)
    path.write_text(s)
    print(f"backed up → {backup}")
    print(f"patched   → {path}")
    print("\nnow run:")
    print("  docker exec macmini-edge nginx -t && docker exec macmini-edge nginx -s reload")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

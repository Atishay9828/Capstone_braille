#!/usr/bin/env python
"""Dev server for sim/3d — like `python -m http.server`, but it does not lie.

`http.server` sends Last-Modified and no Cache-Control, so browsers apply
HEURISTIC freshness and serve app.js and the .glb files from cache without
asking. Every file here is a build artefact: the GLBs are regenerated whenever
the CAD moves and braillix_params.json whenever a constant changes. A cached
copy means old geometry drawn against new numbers, silently.

That cost real debugging time twice - once showing 400-triangle linkages after
a 3228-triangle rebuild, once showing 1.125 degree ramps after the per-track
ramps landed. Both looked like code bugs and were not.

`no-cache` still lets the browser STORE the file. It only has to ask whether it
changed, which is a 304 and costs nothing on localhost.

    python sim/serve.py [port]

GitHub Pages sets its own sane headers, so this only affects local work.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "3d")


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "304" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", 8777))
    srv = ThreadingHTTPServer(("127.0.0.1", port),
                              partial(NoCacheHandler, directory=ROOT))
    print(f"braillix sim on http://127.0.0.1:{port}  (no-cache, serving {ROOT})")
    srv.serve_forever()


main()

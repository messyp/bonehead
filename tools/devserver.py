# Static dev server for dist/ that never lets the browser cache modules.
import http.server, functools, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
http.server.ThreadingHTTPServer(('', port), functools.partial(NoCache, directory='dist')).serve_forever()

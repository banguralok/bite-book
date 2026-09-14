"""Local dev server for Bite Book.

    python3 scripts/dev-server.py            # the real app, talking to Supabase
    python3 scripts/dev-server.py 5173 --demo  # seeded demo data, no network

--demo injects dev/seed.js and dev/fake-supabase.js into every page, right
after the Supabase CDN script, so the whole app runs against ~1,200 invented
meals across three years, four countries and five households. It is the only
way to develop features that need a history the real beta cannot have yet.

The injection happens HERE, in the server, on the way out. No page in the
repo mentions the demo harness, so there is no flag in the shipped app that
could be flipped by accident and nothing to strip before deploying.
"""

import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

args = [a for a in sys.argv[1:]]
DEMO = '--demo' in args
args = [a for a in args if not a.startswith('--')]
PORT = int(args[0]) if args else 5173

CDN_TAG = b'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
DEMO_TAGS = (
    b'\n<!-- injected by scripts/dev-server.py --demo -->\n'
    b'<script src="/dev/seed.js"></script>\n'
    b'<script src="/dev/fake-supabase.js"></script>'
)


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def send_head(self):
        if not DEMO:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, 'index.html')
            if os.path.exists(index):
                path = index
        if not path.endswith('.html') or not os.path.exists(path):
            return super().send_head()

        with open(path, 'rb') as fh:
            body = fh.read()

        if CDN_TAG in body:
            body = body.replace(CDN_TAG, CDN_TAG + DEMO_TAGS, 1)

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()

        import io
        return io.BytesIO(body)


os.chdir(ROOT)
if DEMO:
    print('*** DEMO MODE — seeded data, nothing reaches Supabase ***')
print(f'Bite Book on http://localhost:{PORT}')
http.server.test(HandlerClass=DevHandler, port=PORT)

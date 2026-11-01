#!/usr/bin/env python3
"""Serve project files over loopback for the optional fullscreen UI. No storage, AI API, or authentication."""
import http.server
import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
print('Meeting page: http://127.0.0.1:8766/meeting.html', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()

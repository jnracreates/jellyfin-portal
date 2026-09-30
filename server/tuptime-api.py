#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import re
import json

class TuptimeHandler(BaseHTTPRequestHandler):
    def _send(self, code, body, content_type="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        if self.path not in ("/uptime", "/"):
            self._send(404, json.dumps({"status": "error", "message": "not found"}))
            return

        try:
            import time as _time
            seven_days_ago = int(_time.time()) - (7 * 86400)
            result = subprocess.run(
                ["tuptime", "--csv", "--tsince", str(seven_days_ago)],
                capture_output=True, text=True, check=True, timeout=10
            )
            csv = result.stdout
        except Exception as e:
            self._send(500, json.dumps({"status": "error", "message": str(e)}))
            return

        pct = None
        for line in csv.splitlines():
            if "System uptime" in line:
                m = re.search(r'"([\d.]+)%"', line)
                if m:
                    pct = float(m.group(1))
                break

        if pct is None:
            self._send(500, json.dumps({"status": "error", "message": "uptime percentage not found"}))
            return

        self._send(200, json.dumps({
            "uptime_percentage": round(pct, 2),
            "status": "ok"
        }))

    def log_message(self, format, *args):
        return

if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 5056), TuptimeHandler)
    print("Tuptime API server running on port 5056...")
    server.serve_forever()

# Jellyfin Portal

A clean, custom homepage for a Jellyfin media server. Built with [Homepage](https://github.com/gethomepage/homepage), custom CSS, and a small custom JS widget that shows recently added movies and TV series.

## Features

- Dark Jellyfin-themed landing page
- Custom Jellyfin background logo
- Status tiles for Jellyfin server stats and uptime
- "Recently Added" row pulling from Jellyfin
- Accurate 7-day uptime percentage that survives reboots and power loss
- Request service links (Seerr, music, YouTube, etc.)
- Mobile-friendly layout

## Repository Layout

```
.
├── docker-compose.yaml
├── README.md
├── LICENSE
├── .gitignore
├── config/
│   ├── settings.yaml
│   ├── services.yaml
│   ├── custom.css
│   ├── custom.js
│   └── public/
│       └── icons/              # local icons referenced as /icons/<file>
├── server/
│   └── tuptime-api.py          # local HTTP wrapper around tuptime
└── worker/
    ├── jellyfin-proxy.js       # Cloudflare Worker for the Jellyfin API
    └── uptime-proxy.js         # Cloudflare Worker for the uptime API
```

## Requirements

- Docker + Docker Compose
- A running Jellyfin server
- [`tuptime`](https://github.com/rfmoz/tuptime) on the Jellyfin host (for the uptime badge)
- Optional: Cloudflare Tunnel for exposing local services
- Optional: Cloudflare Workers for API proxies

## Quick Start

1. Clone the repo:

   ```bash
   git clone https://github.com/YOUR_USERNAME/jellyfin-portal.git
   cd jellyfin-portal
   ```

2. Edit `docker-compose.yaml` and set your host/IP in `HOMEPAGE_ALLOWED_HOSTS`.

3. Edit `config/services.yaml` and replace all placeholders:

   | Placeholder | Description |
   |---|---|
   | `YOUR_JELLYFIN_LAN_IP` | LAN IP of your Jellyfin server |
   | `YOUR_JELLYFIN_API_KEY` | Jellyfin API key |
   | `example.com` | Your public domain |

4. Edit `config/custom.js` and replace:

   | Placeholder | Description |
   |---|---|
   | `YOUR_JELLYFIN_USER_ID` | Jellyfin user ID |
   | `YOUR_MOVIES_LIBRARY_ID` | Jellyfin Movies library ID |
   | `YOUR_TV_LIBRARY_ID` | Jellyfin TV library ID |
   | `API_PROXY` | URL of your Jellyfin API proxy |
   | `UPTIME_API` | URL of your uptime API proxy |

5. Start it:

   ```bash
   docker compose up -d
   ```

6. Open `http://YOUR_SERVER_IP:3000`.

## Custom Icons

Local icons live in `config/public/icons/`. The `docker-compose.yaml` mounts that folder read-only into the container at `/app/public/icons`.

To reference a local icon in `services.yaml`, use the path `/icons/<filename>`:

```yaml
- ytfinall:
    icon: /icons/logo2.png
    href: https://youtube.example.com
```

The file `config/public/icons/logo2.png` in this repo is a placeholder. Replace it with your own, or change the `icon:` line in `services.yaml` to point at a remote URL (for example, a GitHub raw link or a CDN-hosted SVG from [dashboard-icons](https://github.com/walkxcode/dashboard-icons)).

Icons not placed in `config/public/icons/` should use either a URL (`https://...`) or one of Homepage's built-in icon names (`jellyfin.png`, `overseerr.png`, etc.).

## Uptime Badge

The portal displays a 7-day uptime percentage on the "Jellyfin Uptime" tile. Getting an accurate number is harder than it looks, because most monitoring tools cannot measure downtime that happens to the machine they're running on.

This setup solves that with [`tuptime`](https://github.com/rfmoz/tuptime), which records boot and shutdown events in a persistent SQLite database. It correctly reports downtime even after power loss or a hard crash.

### Why not Uptime Kuma

Uptime Kuma is a live polling service. If it runs on the same host it's monitoring, it stops writing heartbeats during an outage and treats the missing time as "no data" rather than "down." That inflates the uptime percentage. `tuptime` avoids this by recording kernel boot events to disk, so it can calculate downtime accurately across reboots.

### 1. Install `tuptime`

On the Jellyfin host:

```bash
sudo apt update
sudo apt install tuptime
sudo systemctl enable --now tuptime.service tuptime-sync.timer
```

Verify with `tuptime -t`. You should see a session table with a `Downtime` column.

### 2. Run the local API

Copy `server/tuptime-api.py` to `/usr/local/bin/`:

```bash
sudo cp server/tuptime-api.py /usr/local/bin/tuptime-api.py
sudo chmod +x /usr/local/bin/tuptime-api.py
```

Create `/etc/systemd/system/tuptime-api.service`:

```ini
[Unit]
Description=Tuptime API Server
After=network.target tuptime.service
Requires=tuptime.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/tuptime-api.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tuptime-api.service
```

Verify locally:

```bash
curl -s http://localhost:5056/uptime
```

Should return `{"uptime_percentage": 100.0, "status": "ok"}`. The number will be `100.0` on a fresh install — it becomes meaningful after a few reboots.

### 3. Expose it via Cloudflare Tunnel

Add a public hostname in the Cloudflare Zero Trust dashboard:

| Field | Value |
|---|---|
| Subdomain | `tuptime-api` |
| Domain | `example.com` |
| Service Type | `HTTP` |
| URL | `localhost:5056` |

Verify:

```bash
curl -s https://tuptime-api.example.com/uptime
```

### 4. Deploy the uptime Worker

The Worker is optional but recommended. It gives the portal one clean public URL, hides the raw CSV/JSON behind a stable contract, and lets you swap data sources later without touching `custom.js`.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `uptime-api-proxy` and click **Deploy**.
3. Click **Edit code** and paste the contents of `worker/uptime-proxy.js`. Click **Deploy**.
4. Go to **Settings** → **Variables and Secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `TUPTIME_UPSTREAM` | Plaintext | `https://tuptime-api.example.com` |

5. Redeploy so the variable takes effect.
6. Under **Settings** → **Domains & Routes**, add a custom domain like `api-uptime.example.com`.

Verify:

```bash
curl -s https://api-uptime.example.com
```

Should return JSON with `uptime_percentage`.

### 5. Point the portal at the Worker

In `config/custom.js`:

```js
const UPTIME_API = "https://api-uptime.example.com";
```

The `buildUptimeBadge()` function fetches this URL, reads `uptime_percentage`, and renders it as `.custom-uptime-badge`.

### What the number means

The percentage reflects how much of the last 7 days the host has been up, based on `tuptime`'s recorded boot and shutdown events. On a fresh install it will read `100.00%` until the machine experiences a real outage. `tuptime` does not distinguish between clean shutdowns and power loss; both count as downtime.

## The API Proxy

`custom.js` runs in the browser. Any API key placed in it is visible to every visitor via DevTools. This repo uses a small Cloudflare Worker proxy to keep the Jellyfin API key server-side.

The Worker:

- Accepts requests only on `/Items` (and subpaths)
- Injects the `Authorization` header from an encrypted secret
- Returns CORS headers so the browser can call it

The code lives in `worker/jellyfin-proxy.js`.

### Deploying the Worker

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create** → **Create Worker**.
2. Give it a name (e.g. `jellyfin-api-proxy`) and click **Deploy**.
3. Click **Edit code** and paste the contents of `worker/jellyfin-proxy.js`. Click **Deploy**.
4. Go to **Settings** → **Variables and Secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `JELLYFIN_URL` | Plaintext | your public Jellyfin URL (e.g. `https://stream.example.com`) |
   | `JELLYFIN_API_KEY` | Secret | your Jellyfin API key |

5. Redeploy so the variables take effect.
6. Under **Settings** → **Domains & Routes**, add a custom domain like `api.example.com`.
7. Optionally disable the `*.workers.dev` route so the only way in is through your own domain.

Then set `API_PROXY` in `custom.js` to that domain.

### Testing the proxy

```bash
# Should return JSON item counts
curl -s https://api.example.com/Items/Counts

# Should return 404 (path blocked by allowlist)
curl -s -o /dev/null -w "%{http_code}\n" https://api.example.com/System/Info
```

## Security Warning

Never commit a real Jellyfin API key to a public repo. Anything in `custom.js` is delivered to the browser and readable by anyone who visits the page. Use a proxy, or omit the Recently Added section entirely.

The API key in `services.yaml` is used server-side by Homepage and is less exposed, but if you plan to share the file publicly, use an environment variable reference instead:

```yaml
headers:
  Authorization: 'MediaBrowser Token="{{HOMEPAGE_VAR_JELLYFIN_API_KEY}}"'
```

Then set `HOMEPAGE_VAR_JELLYFIN_API_KEY` in your `docker-compose.yaml` environment or a `.env` file that is gitignored.

## License

MIT

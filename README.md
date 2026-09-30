<img width="1197" height="1256" alt="homepage3" src="https://github.com/user-attachments/assets/f6b31cf0-69ce-4bc9-bc79-24a7f446b346" />

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
   | `YOUR_JELLYFIN_USER_ID` | Jellyfin user ID ([how to find it](#finding-jellyfin-ids)) |
   | `YOUR_MOVIES_LIBRARY_ID` | Jellyfin Movies library ID ([how to find it](#finding-jellyfin-ids)) |
   | `YOUR_TV_LIBRARY_ID` | Jellyfin TV library ID ([how to find it](#finding-jellyfin-ids)) |
   | `API_PROXY` | URL of your Jellyfin API proxy (set up in [The API Proxy](#the-api-proxy)) |
   | `UPTIME_API` | URL of your uptime API proxy (set up in [Uptime Badge](#uptime-badge)) |

5. Start it:

   ```bash
   docker compose up -d
   ```

6. Open `http://YOUR_SERVER_IP:3000`.

## Finding Jellyfin IDs

`custom.js` needs three Jellyfin IDs: your user ID, the Movies library ID, and the TV library ID. All three can be pulled from the Jellyfin API with your API key.

Set these two shell variables first, replacing the placeholders:

```bash
JF_URL="http://YOUR_JELLYFIN_LAN_IP:8096"
JF_KEY="YOUR_JELLYFIN_API_KEY"
```
User ID
List all users and find the one you log in with:
```bash
curl -s "$JF_URL/Users" -H "Authorization: MediaBrowser Token=\"$JF_KEY\"" | jq '.[] | {Name, Id}'
```
Example output:

```json
{ "Name": "jnra", "Id": "bfc078bc32084364a2466f2bf9a787b3" }
```
Copy the Id into YOUR_JELLYFIN_USER_ID.

If you don't have jq installed, drop the | jq ... part — the raw JSON is still readable, just uglier.

Library IDs

List all top-level libraries:
```bash
curl -s "$JF_URL/Library/MediaFolders" -H "Authorization: MediaBrowser Token=\"$JF_KEY\"" | jq '.Items[] | {Name, Id}'
```
Example output:

```json
{ "Name": "Movies",  "Id": "f137a2dd21bbc1b99aa5c0f6bf02a805" }
{ "Name": "TV Shows", "Id": "767bffe4f11c93ef34b805451a696a4e" }
{ "Name": "Music",   "Id": "..." }
```
Copy the Id for Movies into YOUR_MOVIES_LIBRARY_ID, and the Id for TV Shows into YOUR_TV_LIBRARY_ID.

If you only see library names but no IDs, or the list is empty, the API key you're using probably isn't an admin key. Generate a new one from Jellyfin Dashboard → API Keys → +.

Alternative: find IDs in the Jellyfin UI

If you'd rather not use curl, both IDs are visible in the web interface.

User ID: log in as the user, open the browser DevTools (F12) → Network tab, and look at any request to /Users/.... The UUID in the URL is your user ID. Or go to Dashboard → Users, click the user, and look at the URL — it ends in the user's ID.

Library IDs: click into a library in the sidebar, then look at the browser URL. It'll contain something like #/movies.html?topParentId=f137a2dd21bbc1b99aa5c0f6bf02a805. That UUID after topParentId= is the library ID.
The other two values

API_PROXY and UPTIME_API are the public URLs of the two Cloudflare Workers you deploy. You set them yourself:

    API_PROXY — whatever custom domain you attach to the Jellyfin Worker (e.g. https://api.example.com). See The API Proxy.

    UPTIME_API — whatever custom domain you attach to the uptime Worker (e.g. https://api-uptime.example.com). See Uptime Badge.

Both are set up in the Cloudflare dashboard, not on your server, so there's no command to run to "find" them — you choose them when you configure the Worker.


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

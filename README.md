# Jellyfin Portal

A clean, custom homepage for a Jellyfin media server. Built with [Homepage](https://github.com/gethomepage/homepage), custom CSS, and a small custom JS widget that shows recently added movies and TV series.

## Features

- Dark Jellyfin-themed landing page
- Custom Jellyfin background logo
- Status tiles for Jellyfin server stats and uptime
- "Recently Added" row pulling from Jellyfin
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
│       └── icons/         # local icons referenced as /icons/<file>
└── worker/
    └── index.js           # Cloudflare Worker API proxy
```

## Requirements

- Docker + Docker Compose
- A running Jellyfin server
- Optional: Uptime Kuma instance for the uptime badge
- Optional: Cloudflare Worker for the API proxy (see below)

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
   | `YOUR_UPTIME_LAN_IP` | LAN IP of your Uptime Kuma instance |
   | `YOUR_JELLYFIN_API_KEY` | Jellyfin API key |
   | `YOUR_MONITOR_SLUG` | Uptime Kuma monitor slug |
   | `example.com` | Your public domain |

4. Edit `config/custom.js` and replace:

   | Placeholder | Description |
   |---|---|
   | `YOUR_JELLYFIN_USER_ID` | Jellyfin user ID |
   | `YOUR_MOVIES_LIBRARY_ID` | Jellyfin Movies library ID |
   | `YOUR_TV_LIBRARY_ID` | Jellyfin TV library ID |
   | `YOUR_UPTIME_MONITOR_ID` | Uptime Kuma monitor ID |
   | `API_PROXY` | URL of your API proxy |

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

## The API Proxy

`custom.js` runs in the browser. Any API key placed in it is visible to every visitor via DevTools. This repo uses a small Cloudflare Worker proxy to keep the Jellyfin API key server-side.

The Worker:

- Accepts requests only on `/Items` (and subpaths)
- Injects the `Authorization` header from an encrypted secret
- Returns CORS headers so the browser can call it

The code lives in `worker/index.js`.

### Deploying the Worker

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Create** → **Create Worker**.
2. Give it a name (e.g. `jellyfin-api-proxy`) and click **Deploy**.
3. Click **Edit code** and paste the contents of `worker/index.js`. Click **Deploy**.
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

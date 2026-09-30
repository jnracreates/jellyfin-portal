(function () {
    const UPTIME_API = "https://api-uptime.example.com";
    const USER_ID  = "YOUR_JELLYFIN_USER_ID";
    const JELLYFIN = "https://stream.example.com";
    const API_PROXY = "https://api.example.com";

    async function buildRow(attempt = 0) {
        if (attempt > 60) {
            console.warn("[jf-latest] gave up finding anchor after 60 attempts");
            return;
        }

        if (document.getElementById("jf-latest-row")) return;

        const jellyfinHost = new URL(JELLYFIN).hostname;
        const jellyfinLink = document.querySelector(`a[href*="${jellyfinHost}"]`);
        if (!jellyfinLink) {
            setTimeout(() => buildRow(attempt + 1), 1000);
            return;
        }

        const group = jellyfinLink.closest("ul")?.parentElement?.parentElement;
        if (!group) {
            setTimeout(() => buildRow(attempt + 1), 1000);
            return;
        }

        const MOVIES_LIB   = "YOUR_MOVIES_LIBRARY_ID";
        const TVSHOWS_LIB  = "YOUR_TV_LIBRARY_ID";

        let items = [];
        try {
            const [moviesRes, tvRes] = await Promise.all([
                fetch(`${API_PROXY}/Items?userId=${USER_ID}&parentId=${MOVIES_LIB}&Recursive=true&IncludeItemTypes=Movie&SortBy=DateCreated&SortOrder=Descending&Limit=20&Fields=ProductionYear`),
                fetch(`${API_PROXY}/Items?userId=${USER_ID}&parentId=${TVSHOWS_LIB}&Recursive=true&IncludeItemTypes=Episode&SortBy=DateCreated&SortOrder=Descending&Limit=60&Fields=SeriesId,SeriesName,ProductionYear`)
            ]);

            if (!moviesRes.ok) throw new Error("Movies HTTP " + moviesRes.status);
            if (!tvRes.ok) throw new Error("TV HTTP " + tvRes.status);

            const moviesData = await moviesRes.json();
            const tvData = await tvRes.json();

            const movies = moviesData.Items || [];
            const episodes = tvData.Items || [];

            const seenSeries = new Set();
            const tv = [];
            for (const ep of episodes) {
                if (!ep.SeriesId || seenSeries.has(ep.SeriesId)) continue;
                seenSeries.add(ep.SeriesId);
                tv.push({
                    Id: ep.SeriesId,
                    Name: ep.SeriesName,
                    Type: "Series",
                    DateCreated: ep.DateCreated
                });
                if (tv.length >= 20) break;
            }

            const moviesTop = movies.slice(0, 10);
            const tvTop = tv.slice(0, 10);

            items = [];
            for (let i = 0; i < Math.max(moviesTop.length, tvTop.length); i++) {
                if (moviesTop[i]) items.push(moviesTop[i]);
                if (tvTop[i]) items.push(tvTop[i]);
            }
        } catch (e) {
            console.warn("[jf-latest] fetch failed:", e);
            return;
        }

        if (!Array.isArray(items) || items.length === 0) return;

        const wrap = document.createElement("div");
        wrap.id = "jf-latest-row";

        const heading = document.createElement("div");
        heading.className = "jf-latest-heading";
        heading.textContent = "Recently Added";

        const scroll = document.createElement("div");
        scroll.className = "jf-latest-scroll";

        for (const it of items) {
            const link = document.createElement("a");
            link.className = "jf-latest-item";
            link.target = "_blank";
            link.rel = "noopener";
            link.href = `${JELLYFIN}/web/index.html#!/details?id=${encodeURIComponent(it.Id)}`;

            const img = document.createElement("img");
            img.loading = "lazy";
            img.src = `${JELLYFIN}/Items/${encodeURIComponent(it.Id)}/Images/Primary?maxHeight=300&quality=90`;
            img.alt = "";

            const title = document.createElement("div");
            title.className = "jf-latest-title";
            title.textContent = it.Name || "";

            link.appendChild(img);
            link.appendChild(title);
            scroll.appendChild(link);
        }

        wrap.appendChild(heading);
        wrap.appendChild(scroll);
        group.insertAdjacentElement("afterend", wrap);
    }

    buildRow();

    async function buildUptimeBadge(attempt = 0) {
        if (attempt > 60) {
            console.warn("[jf-latest] uptime: gave up after 60 attempts");
            return;
        }
        if (document.querySelector(".custom-uptime-badge")) return;

        const uptimeTile = document.querySelector('li[data-name="Jellyfin Uptime"]');
        if (!uptimeTile) {
            setTimeout(() => buildUptimeBadge(attempt + 1), 500);
            return;
        }

        const card = uptimeTile.querySelector(".service-card") || uptimeTile;

        try {
            const res = await fetch(UPTIME_API);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();

            const pct = data.uptime_percentage != null
                ? Number(data.uptime_percentage).toFixed(2) + "%"
                : "—";

            const badge = document.createElement("div");
            badge.className = "custom-uptime-badge";

            const pctEl = document.createElement("span");
            pctEl.className = "uptime-pct";
            pctEl.textContent = pct;

            const label = document.createElement("span");
            label.className = "uptime-label";
            label.textContent = "Uptime over the last week";

            badge.appendChild(pctEl);
            badge.appendChild(label);
            card.appendChild(badge);
        } catch (e) {
            console.warn("[jf-latest] uptime fetch failed:", e);

            const badge = document.createElement("div");
            badge.className = "custom-uptime-badge";

            const pctEl = document.createElement("span");
            pctEl.className = "uptime-pct";
            pctEl.textContent = "—";

            const label = document.createElement("span");
            label.className = "uptime-label";
            label.textContent = "Uptime over the last week";

            badge.appendChild(pctEl);
            badge.appendChild(label);
            card.appendChild(badge);
        }
    }

    buildUptimeBadge();
})();

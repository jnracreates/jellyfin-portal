(function () {
    console.log("[jf-latest] script loaded");

    const USER_ID  = "YOUR_JELLYFIN_USER_ID";
    const JELLYFIN = "https://stream.example.com";
    const API_PROXY = "https://api.example.com";

    const UPTIME_URL = "https://uptime.example.com";
    const UPTIME_MONITOR_ID = "YOUR_UPTIME_MONITOR_ID";

    async function buildRow() {
        console.log("[jf-latest] buildRow started");

        if (document.getElementById("jf-latest-row")) {
            console.log("[jf-latest] row already exists");
            return;
        }

        const jellyfinHost = new URL(JELLYFIN).hostname;
        const jellyfinLink = document.querySelector(`a[href*="${jellyfinHost}"]`);
        console.log("[jf-latest] jellyfinLink:", jellyfinLink);
        if (!jellyfinLink) {
            console.log("[jf-latest] jellyfin link not found, retrying...");
            setTimeout(buildRow, 1000);
            return;
        }

        const group = jellyfinLink.closest("ul")?.parentElement?.parentElement;
        console.log("[jf-latest] group:", group);
        if (!group) {
            console.log("[jf-latest] group not found, retrying...");
            setTimeout(buildRow, 1000);
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

            // Dedupe episodes down to unique series, keeping the newest episode's date
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

            console.log("[jf-latest] movies:", movies.length, "tv (unique series):", tv.length);
            console.log("[jf-latest] first 3 movies:", movies.slice(0,3).map(x => x.Name + " / " + x.Type));
            console.log("[jf-latest] first 3 tv:", tv.slice(0,3).map(x => x.Name + " / " + x.Type));

            // Take top 10 from each, then interleave: movie, tv, movie, tv, ...
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

        console.log("[jf-latest] merged items:", items.length);
        if (!Array.isArray(items) || items.length === 0) return;

        const wrap = document.createElement("div");
        wrap.id = "jf-latest-row";
        wrap.innerHTML = `
        <div class="jf-latest-heading">Recently Added</div>
        <div class="jf-latest-scroll">
        ${items
            .map(
                (it) => `
                <a class="jf-latest-item" target="_blank" rel="noopener"
                href="${JELLYFIN}/web/index.html#!/details?id=${it.Id}">
                <img loading="lazy"
                src="${JELLYFIN}/Items/${it.Id}/Images/Primary?maxHeight=300&quality=90"
                alt="${(it.Name || "").replace(/"/g, "&quot;")}">
                <div class="jf-latest-title">${it.Name || ""}</div>
                </a>`
            )
            .join("")}
            </div>
            `;

        group.insertAdjacentElement("afterend", wrap);
        console.log("[jf-latest] row inserted");
    }

    // Retry until Homepage has rendered its cards
    buildRow();

    // ---- 30-day uptime percentage (plain text) ----
    async function buildUptimeBadge() {
        if (document.querySelector(".custom-uptime-badge")) return;

        const uptimeTile = document.querySelector('li[data-name="Jellyfin Uptime"]');
        if (!uptimeTile) {
            setTimeout(buildUptimeBadge, 500);
            return;
        }

        const card = uptimeTile.querySelector(".service-card") || uptimeTile;

        try {
            const res = await fetch(`${UPTIME_URL}/api/badge/${UPTIME_MONITOR_ID}/uptime/168`);
            const svg = await res.text();
            const match = svg.match(/(\d+(?:\.\d+)?)\s*%/);
            const raw = match ? parseFloat(match[1]) : null;
            const pct = raw === null ? "—" : raw + "%";

            card.insertAdjacentHTML("beforeend", `
                <div class="custom-uptime-badge">
                    <span class="uptime-pct">${pct}</span>
                    <span class="uptime-label">Uptime over the last week</span>
                </div>
            `);

            console.log("[jf-latest] uptime pct:", pct);
        } catch (e) {
            console.warn("[jf-latest] uptime fetch failed:", e);
        }
    }

    buildUptimeBadge();
})();


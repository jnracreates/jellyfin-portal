export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Exact paths only. No startsWith, no wildcards.
    const allowedPaths = new Set([
      "/Items",
      "/Items/Counts",
    ]);

    // Image endpoints: single 32-char hex ID segment only.
    const imagePath = /^\/Items\/[a-f0-9]{32}\/Images\/Primary$/;
    const isImage = imagePath.test(path);

    if (!allowedPaths.has(path) && !isImage) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    // Only forward query params the portal actually uses.
    const allowedParams = new Set([
      "userId", "parentId", "Recursive", "IncludeItemTypes",
      "SortBy", "SortOrder", "Limit", "Fields",
    ]);
    const filtered = new URLSearchParams();
    for (const [k, v] of url.searchParams) {
      if (allowedParams.has(k)) filtered.set(k, v);
    }

    const jellyfinUrl = new URL(path + "?" + filtered.toString(), env.JELLYFIN_URL);

    const response = await fetch(jellyfinUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": `MediaBrowser Token="${env.JELLYFIN_API_KEY}"`,
        "Accept": "application/json"
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
                        ...corsHeaders
      }
    });
  }
};

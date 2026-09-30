export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only allow the endpoints custom.js needs
    const allowedPaths = ["/Items", "/Items/Counts"];
    if (!allowedPaths.some(p => url.pathname.startsWith(p))) {
      return new Response("Not found", { status: 404 });
    }

    const jellyfinUrl = new URL(url.pathname + url.search, env.JELLYFIN_URL);

    const response = await fetch(jellyfinUrl.toString(), {
      method: request.method,
      headers: {
        "Authorization": `MediaBrowser Token="${env.JELLYFIN_API_KEY}"`,
        "Accept": "application/json"
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

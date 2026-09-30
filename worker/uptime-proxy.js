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

    try {
      const res = await fetch(`${env.TUPTIME_UPSTREAM}/uptime`, {
        headers: { "Accept": "application/json" }
      });

      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status}`);
      }

      const data = await res.json();

      return new Response(JSON.stringify({
        uptime_percentage: data.uptime_percentage,
        status: "ok",
        fetched_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({
        status: "error",
        message: e.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

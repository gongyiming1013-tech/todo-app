const SUPABASE_TARGET = 'https://bsnyzpisrsywktjuzygf.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = SUPABASE_TARGET + url.pathname + url.search;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Forward the request to Supabase
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set('Host', new URL(SUPABASE_TARGET).host);

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: modifiedHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    // Return response with CORS headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Add CORS headers
    const cors = corsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      modifiedResponse.headers.set(key, value);
    }

    return modifiedResponse;
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type, range, x-supabase-api-version',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

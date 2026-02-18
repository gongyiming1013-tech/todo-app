const SUPABASE_TARGET = 'https://bsnyzpisrsywktjuzygf.supabase.co';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = SUPABASE_TARGET + url.pathname + url.search;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  // Forward only relevant headers to Supabase (avoid forwarding Host/CF headers
  // which cause Error 1016 when fetching another Cloudflare-proxied domain)
  const headers = new Headers();
  const forwardHeaders = [
    'authorization', 'apikey', 'content-type', 'accept', 'range',
    'x-client-info', 'x-supabase-api-version', 'prefer',
  ];
  for (const name of forwardHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });

  // Return response with CORS headers
  const modifiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  const cors = corsHeaders(request);
  for (const [key, value] of Object.entries(cors)) {
    modifiedResponse.headers.set(key, value);
  }

  return modifiedResponse;
}

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

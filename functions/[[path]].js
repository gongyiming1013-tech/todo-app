const SUPABASE_TARGET = 'https://bsnyzpisrsywktjuzygf.supabase.co';

export async function onRequest(context) {
  const { request } = context;
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const targetUrl = SUPABASE_TARGET + url.pathname + url.search;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return withCors(request, requestId, new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    }));
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

  let response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });
  } catch (error) {
    return jsonError(request, requestId, 502, 'PROXY_UPSTREAM_FETCH_FAILED', 'Supabase upstream fetch failed', {
      target: targetUrl,
      detail: error?.message || String(error),
    });
  }

  const upstreamError = await normalizeUpstreamError(response);
  if (upstreamError) {
    return jsonError(request, requestId, 502, upstreamError.code, upstreamError.message, {
      target: targetUrl,
      upstreamStatus: response.status,
      upstreamBody: upstreamError.body,
    });
  }

  // Return response with CORS headers
  const modifiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  return withCors(request, requestId, modifiedResponse);
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

function withCors(request, requestId, response) {
  const cors = corsHeaders(request);
  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value);
  }
  response.headers.set('x-proxy-request-id', requestId);
  return response;
}

async function normalizeUpstreamError(response) {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 530) {
    const raw = await safeReadText(response);
    return {
      code: raw.includes('1016') ? 'UPSTREAM_DNS_1016' : 'UPSTREAM_530',
      message: raw.includes('1016') ? 'Cloudflare 1016 when reaching Supabase origin' : 'Supabase upstream returned 530',
      body: truncate(raw),
    };
  }
  if (response.status >= 500 && !contentType.includes('application/json')) {
    const raw = await safeReadText(response);
    return {
      code: 'UPSTREAM_NON_JSON_5XX',
      message: 'Supabase upstream returned non-JSON server error',
      body: truncate(raw),
    };
  }
  return null;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function truncate(value, max = 180) {
  if (!value) return '';
  return value.length > max ? value.slice(0, max) : value;
}

function jsonError(request, requestId, status, code, message, details = {}) {
  const body = JSON.stringify({
    code,
    message,
    requestId,
    ...details,
    error: {
      code,
      message,
      requestId,
      ...details,
    },
  });
  const response = new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
  return withCors(request, requestId, response);
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_DIRECT_URL,
    SUPABASE_PROXY_URL,
    SUPABASE_ENDPOINT_POLICY,
    SUPABASE_FAILOVER_TTL_MS,
} from './config.js';

let supabase = null;
const PROXY_PATH_PREFIXES = ['/auth/', '/rest/', '/storage/', '/realtime/'];
const failoverState = {
    temporaryPolicy: null,
    expiresAt: 0,
};

function normalizePolicy(policy) {
    if (policy === 'proxy-first' || policy === 'direct-first' || policy === 'proxy-only' || policy === 'direct-only') {
        return policy;
    }
    return 'proxy-first';
}

function activePolicy() {
    if (failoverState.temporaryPolicy && Date.now() < failoverState.expiresAt) {
        return failoverState.temporaryPolicy;
    }
    failoverState.temporaryPolicy = null;
    return normalizePolicy(SUPABASE_ENDPOINT_POLICY);
}

function rememberPolicy(policy) {
    failoverState.temporaryPolicy = policy;
    failoverState.expiresAt = Date.now() + SUPABASE_FAILOVER_TTL_MS;
}

function isProxyRoute(url) {
    try {
        const parsed = new URL(url, SUPABASE_PROXY_URL);
        const proxyOrigin = new URL(SUPABASE_PROXY_URL).origin;
        return parsed.origin === proxyOrigin && PROXY_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
    } catch {
        return false;
    }
}

function rewriteOrigin(url, targetOrigin) {
    const parsed = new URL(url);
    const target = new URL(targetOrigin);
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString();
}

function shouldRetryResponse(endpoint, response, bodyText) {
    if (endpoint === 'proxy' && response.status === 530) return true;
    if (response.status >= 500) return true;
    if (endpoint === 'proxy' && typeof bodyText === 'string' && bodyText.includes('error code: 1016')) return true;
    return false;
}

function endpointOrder(policy) {
    switch (policy) {
        case 'direct-only':
            return ['direct'];
        case 'proxy-only':
            return ['proxy'];
        case 'direct-first':
            return ['direct', 'proxy'];
        default:
            return ['proxy', 'direct'];
    }
}

async function supabaseFetch(input, init) {
    if (!isProxyRoute(input instanceof Request ? input.url : String(input))) {
        return fetch(input, init);
    }

    const request = input instanceof Request ? input : new Request(input, init);
    const policy = activePolicy();
    const order = endpointOrder(policy);
    let lastError = null;

    for (let i = 0; i < order.length; i++) {
        const endpoint = order[i];
        const targetUrl = endpoint === 'direct'
            ? rewriteOrigin(request.url, SUPABASE_DIRECT_URL)
            : rewriteOrigin(request.url, SUPABASE_PROXY_URL);

        try {
            const attemptRequest = new Request(targetUrl, request.clone());
            const response = await fetch(attemptRequest);

            let bodyText = '';
            if (response.status === 530 || response.status >= 500) {
                try {
                    bodyText = await response.clone().text();
                } catch {
                    bodyText = '';
                }
            }

            if (i < order.length - 1 && shouldRetryResponse(endpoint, response, bodyText)) {
                continue;
            }

            if (policy === 'proxy-first' && endpoint === 'direct') {
                rememberPolicy('direct-first');
            } else if (policy === 'direct-first' && endpoint === 'proxy') {
                rememberPolicy('proxy-first');
            } else if (endpoint === order[0]) {
                failoverState.temporaryPolicy = null;
            }

            return response;
        } catch (err) {
            lastError = err;
            if (i < order.length - 1) continue;
        }
    }

    throw lastError || new Error('Supabase request failed');
}

try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            fetch: supabaseFetch,
        },
    });
    console.log('Supabase initialized with policy:', normalizePolicy(SUPABASE_ENDPOINT_POLICY));
} catch (e) {
    console.error('Supabase init failed:', e);
}

export { supabase };

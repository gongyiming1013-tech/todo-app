// Supabase configuration
export const SUPABASE_DIRECT_URL = 'https://bsnyzpisrsywktjuzygf.supabase.co';
export const SUPABASE_PROXY_URL = window.location.origin;
// Keep SUPABASE_URL for compatibility with existing modules/tests.
export const SUPABASE_URL = SUPABASE_PROXY_URL;
// proxy-first keeps China accessibility; localhost uses direct-first by default.
export const SUPABASE_ENDPOINT_POLICY = window.location.hostname === 'localhost' ? 'direct-first' : 'proxy-first';
export const SUPABASE_FAILOVER_TTL_MS = 2 * 60 * 1000;
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbnl6cGlzcnN5d2t0anV6eWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMjMwMDMsImV4cCI6MjA4NDg5OTAwM30.WGIbauKKzX0RBw43LP_c7qxNUqDYTEYGB5XZBXbe4Y4';

// Supabase configuration
// Use direct Supabase in localhost; use same-origin proxy in deployed environments.
export const SUPABASE_URL = window.location.hostname === 'localhost'
    ? 'https://bsnyzpisrsywktjuzygf.supabase.co'
    : window.location.origin;
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbnl6cGlzcnN5d2t0anV6eWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMjMwMDMsImV4cCI6MjA4NDg5OTAwM30.WGIbauKKzX0RBw43LP_c7qxNUqDYTEYGB5XZBXbe4Y4';

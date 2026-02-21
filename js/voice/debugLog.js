const LOG_KEY = 'meboard_voice_debug_logs';
const MAX_LOGS = 200;

export function logVoiceEvent(event, data = {}) {
    const entry = {
        ts: new Date().toISOString(),
        event,
        data,
    };

    try {
        const existing = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
        existing.push(entry);
        const trimmed = existing.slice(-MAX_LOGS);
        localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
    } catch (error) {
        // Keep logging non-blocking.
    }

    console.log('[voice]', entry.ts, event, data);
}

export function getVoiceDebugLogs() {
    try {
        return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    } catch (error) {
        return [];
    }
}

export function clearVoiceDebugLogs() {
    try {
        localStorage.removeItem(LOG_KEY);
    } catch (error) {
        // Keep cleanup non-blocking.
    }
}

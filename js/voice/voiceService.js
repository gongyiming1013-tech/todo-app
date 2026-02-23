// Voice Service - singleton manager that delegates to the active adapter
import { getSettings } from '../settings.js';
import { logVoiceEvent } from './debugLog.js';

// Voice states
export const VoiceState = {
    IDLE: 'idle',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    ERROR: 'error',
};

let currentAdapter = null;
let state = VoiceState.IDLE;
let onStateChange = null;
let onResult = null;
let onError = null;
let isToggling = false;

export function getVoiceState() {
    return state;
}

function setState(newState) {
    state = newState;
    if (onStateChange) onStateChange(state);
}

export function setOnStateChange(callback) {
    onStateChange = callback;
}

export function setOnResult(callback) {
    onResult = callback;
}

export function setOnError(callback) {
    onError = callback;
}

async function loadAdapter(provider, settings) {
    switch (provider) {
        case 'external': {
            const { ExternalAdapter } = await import('./externalAdapter.js');
            return new ExternalAdapter();
        }
        case 'openai':
        default: {
            if (!settings.openaiApiKey) {
                logVoiceEvent('voice.adapter.fallback.webspeech', { reason: 'missing_openai_key' });
                const { WebSpeechAdapter } = await import('./webSpeechAdapter.js');
                return new WebSpeechAdapter();
            }
            const { OpenAIAdapter } = await import('./openAIAdapter.js');
            return new OpenAIAdapter();
        }
    }
}

export async function startListening() {
    if (isToggling) return;
    isToggling = true;
    logVoiceEvent('voice.toggle.click', { state });

    if (state === VoiceState.LISTENING || state === VoiceState.PROCESSING) {
        try {
            await stopListening();
            return;
        } finally {
            isToggling = false;
        }
    }

    const settings = getSettings();
    logVoiceEvent('voice.start', { provider: settings.voiceProvider });
    try {
        currentAdapter = await loadAdapter(settings.voiceProvider, settings);

        currentAdapter.onResult = async (text) => {
            logVoiceEvent('voice.result.received', { chars: text?.length || 0 });
            setState(VoiceState.PROCESSING);
            try {
                if (onResult) await onResult(text);
            } catch (error) {
                if (onError) onError(error.message || 'Failed to process voice result');
            } finally {
                setState(VoiceState.IDLE);
            }
        };

        currentAdapter.onError = (error) => {
            logVoiceEvent('voice.error', { error });
            setState(VoiceState.ERROR);
            if (onError) onError(error);
            setTimeout(() => {
                if (state === VoiceState.ERROR) setState(VoiceState.IDLE);
            }, 3000);
        };

        setState(VoiceState.LISTENING);
        await currentAdapter.start(settings);
    } catch (e) {
        logVoiceEvent('voice.start.error', { message: e.message });
        setState(VoiceState.ERROR);
        if (onError) onError(e.message || 'Failed to start voice input');
        setTimeout(() => {
            if (state === VoiceState.ERROR) setState(VoiceState.IDLE);
        }, 3000);
    } finally {
        isToggling = false;
    }
}

export async function stopListening() {
    logVoiceEvent('voice.stop');
    if (currentAdapter) {
        try {
            await currentAdapter.stop();
        } catch (e) {
            console.error('Error stopping adapter:', e);
        }
        currentAdapter = null;
    }
    // Only reset to IDLE if not already transitioned by adapter callback
    if (state === VoiceState.LISTENING) {
        setState(VoiceState.IDLE);
    }
}

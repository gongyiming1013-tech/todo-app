// Voice Service - singleton manager that delegates to the active adapter
import { getSettings } from '../settings.js';

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

async function loadAdapter(provider) {
    switch (provider) {
        case 'external': {
            const { ExternalAdapter } = await import('./externalAdapter.js');
            return new ExternalAdapter();
        }
        case 'openai':
        default: {
            const { OpenAIAdapter } = await import('./openAIAdapter.js');
            return new OpenAIAdapter();
        }
    }
}

export async function startListening() {
    if (state === VoiceState.LISTENING || state === VoiceState.PROCESSING) {
        await stopListening();
        return;
    }

    const settings = getSettings();
    try {
        currentAdapter = await loadAdapter(settings.voiceProvider);

        currentAdapter.onResult = async (text) => {
            setState(VoiceState.PROCESSING);
            if (onResult) await onResult(text);
            setState(VoiceState.IDLE);
        };

        currentAdapter.onError = (error) => {
            setState(VoiceState.ERROR);
            if (onError) onError(error);
            setTimeout(() => {
                if (state === VoiceState.ERROR) setState(VoiceState.IDLE);
            }, 3000);
        };

        setState(VoiceState.LISTENING);
        await currentAdapter.start(settings);
    } catch (e) {
        setState(VoiceState.ERROR);
        if (onError) onError(e.message || 'Failed to start voice input');
        setTimeout(() => {
            if (state === VoiceState.ERROR) setState(VoiceState.IDLE);
        }, 3000);
    }
}

export async function stopListening() {
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

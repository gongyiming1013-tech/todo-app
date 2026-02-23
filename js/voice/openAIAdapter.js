import { logVoiceEvent } from './debugLog.js';

// OpenAI adapter - uses MediaRecorder + Whisper API for transcription + GPT for NLU
export class OpenAIAdapter {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.onResult = null;
        this.onError = null;
        this._stopped = false;
        this._startedAt = 0;
    }

    async start(settings) {
        logVoiceEvent('openai.start.requested', { hasApiKey: Boolean(settings.openaiApiKey) });
        if (!settings.openaiApiKey) {
            throw new Error('OpenAI API Key is required. Please configure it in Settings.');
        }

        this._stopped = false;
        this.audioChunks = [];
        this._startedAt = Date.now();

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            logVoiceEvent('openai.mic.granted');
        } catch (e) {
            logVoiceEvent('openai.mic.denied', { message: e.message });
            throw new Error('Microphone access denied. Please allow microphone permission.');
        }

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onerror = () => {
            this._releaseStream();
            logVoiceEvent('openai.recorder.error');
            if (this.onError) this.onError('Recording failed. Please try again.');
        };

        this.mediaRecorder.onstop = async () => {
            logVoiceEvent('openai.recorder.stopped', { chunks: this.audioChunks.length });
            this._releaseStream();
            if (!this._stopped) return;

            if (Date.now() - this._startedAt < 300) {
                if (this.onError) this.onError('Recording is too short. Please speak for at least 1 second.');
                return;
            }

            if (this.audioChunks.length === 0) {
                if (this.onError) this.onError('No audio captured. Please allow microphone and try again.');
                return;
            }

            await this._processAudio(settings);
        };

        this.mediaRecorder.start(250);
        logVoiceEvent('openai.recorder.started');
    }

    async stop() {
        this._stopped = true;
        logVoiceEvent('openai.stop.requested', { state: this.mediaRecorder?.state || 'none' });
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            try {
                this.mediaRecorder.stop();
            } catch (error) {
                logVoiceEvent('openai.stop.error', { message: error.message });
                if (this.onError) this.onError('Failed to stop recording. Please try again.');
            }
        } else {
            this._releaseStream();
        }
    }

    _releaseStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    async _fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(timeoutMessage);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    async _processAudio(settings) {
        try {
            const ext = this.mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
            const file = new File([audioBlob], `recording.${ext}`, { type: this.mediaRecorder.mimeType });
            logVoiceEvent('openai.transcription.start', { bytes: audioBlob.size, mime: this.mediaRecorder.mimeType });

            // Step 1: Whisper transcription
            const formData = new FormData();
            formData.append('file', file);
            formData.append('model', settings.whisperModel || 'whisper-1');
            if (settings.language && settings.language !== 'auto') {
                formData.append('language', settings.language);
            }

            const transcriptionRes = await this._fetchWithTimeout(
                'https://api.openai.com/v1/audio/transcriptions',
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${settings.openaiApiKey}` },
                    body: formData,
                },
                25000,
                'Transcription request timed out. Please check your network and try again.'
            );

            if (!transcriptionRes.ok) {
                const rawBody = await transcriptionRes.text().catch(() => '');
                let parsed = null;
                try {
                    parsed = rawBody ? JSON.parse(rawBody) : null;
                } catch (e) {
                    parsed = null;
                }
                logVoiceEvent('openai.transcription.http_error', {
                    status: transcriptionRes.status,
                    bodyPreview: rawBody?.slice(0, 200) || '',
                });
                if (transcriptionRes.status === 401) {
                    throw new Error('OpenAI API Key 无效或无权限（401）。请在设置中重新粘贴有效的 Key。');
                }
                throw new Error(parsed?.error?.message || `Whisper API error: ${transcriptionRes.status}`);
            }

            const { text } = await transcriptionRes.json();
            logVoiceEvent('openai.transcription.done', { textLength: text?.length || 0 });
            if (!text || !text.trim()) {
                if (this.onError) this.onError('No speech detected. Please try again.');
                return;
            }
            if (this.onResult) await this.onResult(text);
        } catch (e) {
            logVoiceEvent('openai.transcription.error', { message: e.message });
            const rawMessage = e?.message || 'Failed to process audio';
            let friendlyMessage = rawMessage;
            if (rawMessage === 'Failed to fetch' || rawMessage.toLowerCase().includes('failed to fetch')) {
                friendlyMessage = '无法连接 OpenAI（Fail to fetch）。请检查网络、代理/VPN，或稍后重试。';
            }
            if (this.onError) this.onError(friendlyMessage);
        }
    }
}

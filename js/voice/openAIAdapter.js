// OpenAI adapter - uses MediaRecorder + Whisper API for transcription + GPT for NLU
export class OpenAIAdapter {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.onResult = null;
        this.onError = null;
        this._stopped = false;
    }

    async start(settings) {
        if (!settings.openaiApiKey) {
            throw new Error('OpenAI API Key is required. Please configure it in Settings.');
        }

        this._stopped = false;
        this.audioChunks = [];

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
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

        this.mediaRecorder.onstop = async () => {
            this._releaseStream();
            if (this._stopped && this.audioChunks.length > 0) {
                await this._processAudio(settings);
            }
        };

        this.mediaRecorder.start();
    }

    async stop() {
        this._stopped = true;
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    _releaseStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    async _processAudio(settings) {
        try {
            const ext = this.mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
            const file = new File([audioBlob], `recording.${ext}`, { type: this.mediaRecorder.mimeType });

            // Step 1: Whisper transcription
            const formData = new FormData();
            formData.append('file', file);
            formData.append('model', settings.whisperModel || 'whisper-1');
            if (settings.language && settings.language !== 'auto') {
                formData.append('language', settings.language);
            }

            const transcriptionRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.openaiApiKey}` },
                body: formData,
            });

            if (!transcriptionRes.ok) {
                const err = await transcriptionRes.json().catch(() => ({}));
                throw new Error(err.error?.message || `Whisper API error: ${transcriptionRes.status}`);
            }

            const { text } = await transcriptionRes.json();
            if (this.onResult) this.onResult(text);
        } catch (e) {
            if (this.onError) this.onError(e.message || 'Failed to process audio');
        }
    }
}

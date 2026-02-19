// Web Speech API adapter - uses browser built-in speech recognition
export class WebSpeechAdapter {
    constructor() {
        this.recognition = null;
        this.onResult = null;
        this.onError = null;
        this._transcript = '';
        this._silenceTimer = null;
    }

    async start(settings) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Your browser does not support speech recognition. Please use Chrome or Edge.');
        }

        this._transcript = '';
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        // Language mapping
        const langMap = { 'auto': '', 'zh': 'zh-CN', 'en': 'en-US' };
        const lang = langMap[settings.language] || settings.language || '';
        if (lang) this.recognition.lang = lang;

        return new Promise((resolve, reject) => {
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                this._transcript = finalTranscript;

                // Reset silence timer — auto-stop after 2s of no new results
                clearTimeout(this._silenceTimer);
                if (finalTranscript) {
                    this._silenceTimer = setTimeout(() => {
                        this._finish();
                    }, 2000);
                }
            };

            this.recognition.onerror = (event) => {
                let msg = 'Speech recognition error';
                if (event.error === 'not-allowed') {
                    msg = 'Microphone access denied. Please allow microphone permission.';
                } else if (event.error === 'no-speech') {
                    msg = 'No speech detected. Please try again.';
                } else if (event.error === 'network') {
                    msg = 'Network error — Chrome speech recognition requires Google servers. Try switching to OpenAI mode in Settings, or use Edge browser.';
                } else if (event.error === 'aborted') {
                    return; // User stopped, not an error
                }
                if (this.onError) this.onError(msg);
            };

            this.recognition.onend = () => {
                // If we have accumulated transcript, deliver it
                if (this._transcript && this.onResult) {
                    this.onResult(this._transcript);
                    this._transcript = '';
                }
            };

            this.recognition.onstart = () => {
                resolve();
            };

            this.recognition.start();
        });
    }

    _finish() {
        clearTimeout(this._silenceTimer);
        if (this.recognition) {
            this.recognition.stop(); // triggers onend which delivers result
        }
    }

    async stop() {
        clearTimeout(this._silenceTimer);
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        // Deliver any accumulated transcript
        if (this._transcript && this.onResult) {
            this.onResult(this._transcript);
            this._transcript = '';
        }
    }
}

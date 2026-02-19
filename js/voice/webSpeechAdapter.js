// Web Speech API adapter - uses browser built-in speech recognition
export class WebSpeechAdapter {
    constructor() {
        this.recognition = null;
        this.onResult = null;
        this.onError = null;
    }

    async start(settings) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Your browser does not support speech recognition. Please use Chrome or Edge.');
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        // Language mapping
        const langMap = { 'auto': '', 'zh': 'zh-CN', 'en': 'en-US' };
        const lang = langMap[settings.language] || settings.language || '';
        if (lang) this.recognition.lang = lang;

        return new Promise((resolve, reject) => {
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (this.onResult) this.onResult(transcript);
            };

            this.recognition.onerror = (event) => {
                let msg = 'Speech recognition error';
                if (event.error === 'not-allowed') msg = 'Microphone access denied. Please allow microphone permission.';
                else if (event.error === 'no-speech') msg = 'No speech detected. Please try again.';
                else if (event.error === 'network') msg = 'Network error. Please check your connection.';
                if (this.onError) this.onError(msg);
            };

            this.recognition.onend = () => {
                // Recognition ended naturally
            };

            this.recognition.onstart = () => {
                resolve();
            };

            this.recognition.start();
        });
    }

    async stop() {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
    }
}

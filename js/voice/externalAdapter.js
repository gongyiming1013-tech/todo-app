// External App adapter - for Typeless and other external voice input tools
export class ExternalAdapter {
    constructor() {
        this.onResult = null;
        this.onError = null;
        this._focusHandler = null;
    }

    async start(settings) {
        const url = settings.externalAppUrl;

        if (url) {
            // Try to launch external app via URL scheme
            try {
                window.open(url, '_blank');
            } catch (e) {
                // URL scheme may not be handled
            }
        }

        // Focus the todo input so external apps (like Typeless) can type into it
        const todoInput = document.getElementById('todoInput');
        if (todoInput) {
            todoInput.focus();
            todoInput.placeholder = 'Speak now using your external app...';

            // Watch for input changes (external app will "type" into the field)
            this._focusHandler = () => {
                const text = todoInput.value.trim();
                if (text && this.onResult) {
                    this.onResult(text);
                }
                todoInput.placeholder = 'Add a new task...';
            };

            // Give user time to use external app, then check on blur
            todoInput.addEventListener('blur', this._focusHandler, { once: true });
        }
    }

    async stop() {
        const todoInput = document.getElementById('todoInput');
        if (todoInput && this._focusHandler) {
            todoInput.removeEventListener('blur', this._focusHandler);
            todoInput.placeholder = 'Add a new task...';
        }
        this._focusHandler = null;
    }
}

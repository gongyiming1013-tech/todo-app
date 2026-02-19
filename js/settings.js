// Settings management - stores user preferences in localStorage
const SETTINGS_KEY = 'meboard_settings';

const DEFAULT_SETTINGS = {
    voiceProvider: 'browser',  // 'browser' | 'openai' | 'external'
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    whisperModel: 'whisper-1',
    language: 'auto',          // 'auto' | 'zh' | 'en' | etc.
    externalAppUrl: '',        // URL scheme for external app (e.g. typeless://)
};

export function getSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
    try {
        const merged = { ...DEFAULT_SETTINGS, ...settings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
    } catch (e) {
        console.error('Failed to save settings:', e);
        return settings;
    }
}

export function getSetting(key) {
    return getSettings()[key];
}

export function setSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    return saveSettings(settings);
}

// Populate settings modal from stored values
export function populateSettingsModal() {
    const settings = getSettings();
    const providerSelect = document.getElementById('voiceProviderSelect');
    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const languageSelect = document.getElementById('voiceLanguageSelect');
    const externalUrlInput = document.getElementById('externalAppUrlInput');

    if (providerSelect) providerSelect.value = settings.voiceProvider;
    if (apiKeyInput) apiKeyInput.value = settings.openaiApiKey;
    if (languageSelect) languageSelect.value = settings.language;
    if (externalUrlInput) externalUrlInput.value = settings.externalAppUrl;

    updateSettingsVisibility(settings.voiceProvider);
}

// Show/hide provider-specific fields
export function updateSettingsVisibility(provider) {
    const openaiSection = document.getElementById('openaiSettingsSection');
    const externalSection = document.getElementById('externalSettingsSection');

    if (openaiSection) openaiSection.style.display = provider === 'openai' ? 'block' : 'none';
    if (externalSection) externalSection.style.display = provider === 'external' ? 'block' : 'none';
}

// Save settings from modal inputs
export function saveSettingsFromModal() {
    const providerSelect = document.getElementById('voiceProviderSelect');
    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const languageSelect = document.getElementById('voiceLanguageSelect');
    const externalUrlInput = document.getElementById('externalAppUrlInput');

    const settings = {
        voiceProvider: providerSelect?.value || 'browser',
        openaiApiKey: apiKeyInput?.value?.trim() || '',
        language: languageSelect?.value || 'auto',
        externalAppUrl: externalUrlInput?.value?.trim() || '',
    };

    return saveSettings(settings);
}

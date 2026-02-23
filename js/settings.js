// Settings management - stores user preferences in localStorage + Supabase
const SETTINGS_KEY = 'meboard_settings';
let supabaseClient = null;

const DEFAULT_SETTINGS = {
    voiceProvider: 'openai',   // 'openai' | 'external'
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    whisperModel: 'whisper-1',
    language: 'auto',          // 'auto' | 'zh' | 'en' | etc.
    externalAppUrl: '',        // URL scheme for external app (e.g. typeless://)
    settingsUpdatedAt: null,
};

function normalizeSettings(settings) {
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export function setSettingsSupabaseClient(client) {
    supabaseClient = client;
}

function hasCustomSettings(settings) {
    const normalized = normalizeSettings(settings);
    return (
        Boolean(normalized.openaiApiKey) ||
        Boolean(normalized.externalAppUrl) ||
        normalized.voiceProvider !== DEFAULT_SETTINGS.voiceProvider ||
        normalized.language !== DEFAULT_SETTINGS.language
    );
}

function toCloudRow(userId, settings) {
    const normalized = normalizeSettings(settings);
    return {
        user_id: userId,
        voice_provider: normalized.voiceProvider,
        openai_api_key: normalized.openaiApiKey,
        language: normalized.language,
        external_app_url: normalized.externalAppUrl,
        updated_at: normalized.settingsUpdatedAt || new Date().toISOString(),
    };
}

function fromCloudRow(row) {
    if (!row) return null;
    return normalizeSettings({
        voiceProvider: row.voice_provider,
        openaiApiKey: row.openai_api_key,
        language: row.language,
        externalAppUrl: row.external_app_url,
        settingsUpdatedAt: row.updated_at,
    });
}

export function getSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) return normalizeSettings(JSON.parse(stored));
    } catch (error) {
        console.error('Failed to load local settings:', error);
    }
    return normalizeSettings();
}

export function saveSettings(settings) {
    try {
        const merged = normalizeSettings({
            ...settings,
            settingsUpdatedAt: new Date().toISOString(),
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
    } catch (error) {
        console.error('Failed to save local settings:', error);
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

export async function loadCloudSettings(userId) {
    if (!supabaseClient || !userId) return null;
    const { data, error } = await supabaseClient
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return fromCloudRow(data);
}

export async function saveCloudSettings(userId, settings) {
    if (!supabaseClient || !userId) return null;
    const payload = toCloudRow(userId, settings);
    const { error } = await supabaseClient
        .from('user_settings')
        .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
    return payload;
}

export async function syncSettingsForUser(userId) {
    const localSettings = getSettings();
    if (!userId || !supabaseClient) return localSettings;

    try {
        const cloudSettings = await loadCloudSettings(userId);

        if (cloudSettings) {
            const cloudTs = Date.parse(cloudSettings.settingsUpdatedAt || 0) || 0;
            const localTs = Date.parse(localSettings.settingsUpdatedAt || 0) || 0;

            if (localTs > cloudTs && hasCustomSettings(localSettings)) {
                await saveCloudSettings(userId, localSettings);
                return localSettings;
            }

            return saveSettings(cloudSettings);
        }

        if (hasCustomSettings(localSettings)) {
            await saveCloudSettings(userId, localSettings);
        }
    } catch (error) {
        console.error('Cloud settings sync failed:', error);
    }

    return localSettings;
}

// Show/hide provider-specific fields
export function updateSettingsVisibility(provider) {
    const openaiSection = document.getElementById('openaiSettingsSection');
    const externalSection = document.getElementById('externalSettingsSection');

    if (openaiSection) openaiSection.style.display = provider === 'openai' ? 'block' : 'none';
    if (externalSection) externalSection.style.display = provider === 'external' ? 'block' : 'none';
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

// Save settings from modal inputs
export async function saveSettingsFromModal(userId) {
    const providerSelect = document.getElementById('voiceProviderSelect');
    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const languageSelect = document.getElementById('voiceLanguageSelect');
    const externalUrlInput = document.getElementById('externalAppUrlInput');

    const settings = {
        voiceProvider: providerSelect?.value || 'openai',
        openaiApiKey: apiKeyInput?.value?.trim() || '',
        language: languageSelect?.value || 'auto',
        externalAppUrl: externalUrlInput?.value?.trim() || '',
    };

    const savedSettings = saveSettings(settings);
    let cloudError = null;

    if (userId) {
        try {
            await saveCloudSettings(userId, savedSettings);
        } catch (error) {
            cloudError = error;
            console.error('Failed to save cloud settings:', error);
        }
    }

    return { settings: savedSettings, cloudError };
}

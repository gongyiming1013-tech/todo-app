// Settings management - stores user preferences in localStorage + Supabase
const SETTINGS_KEY = 'meboard_settings';
let supabaseClient = null;

const DEFAULT_SETTINGS = {
    region: 'global',           // 'global' | 'china_mainland'
    voiceProvider: 'openai',   // 'openai' | 'external'
    openaiApiKey: '',
    cnSttApiKey: '',
    cnRewriteApiKey: '',
    cnBaseUrl: '',              // legacy fallback
    cnSttBaseUrl: '',
    cnRewriteBaseUrl: '',
    cnSttModel: 'whisper-1',
    cnRewriteModel: 'gpt-4o-mini',
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
        Boolean(normalized.cnSttApiKey) ||
        Boolean(normalized.cnRewriteApiKey) ||
        Boolean(normalized.cnBaseUrl) ||
        Boolean(normalized.cnSttBaseUrl) ||
        Boolean(normalized.cnRewriteBaseUrl) ||
        Boolean(normalized.externalAppUrl) ||
        normalized.region !== DEFAULT_SETTINGS.region ||
        normalized.voiceProvider !== DEFAULT_SETTINGS.voiceProvider ||
        normalized.language !== DEFAULT_SETTINGS.language
    );
}

function toCloudRow(userId, settings) {
    const normalized = normalizeSettings(settings);
    return {
        user_id: userId,
        region: normalized.region,
        voice_provider: normalized.voiceProvider,
        openai_api_key: normalized.openaiApiKey,
        cn_stt_api_key: normalized.cnSttApiKey,
        cn_rewrite_api_key: normalized.cnRewriteApiKey,
        cn_base_url: normalized.cnBaseUrl, // legacy
        cn_stt_base_url: normalized.cnSttBaseUrl,
        cn_rewrite_base_url: normalized.cnRewriteBaseUrl,
        cn_stt_model: normalized.cnSttModel,
        cn_rewrite_model: normalized.cnRewriteModel,
        language: normalized.language,
        external_app_url: normalized.externalAppUrl,
        updated_at: normalized.settingsUpdatedAt || new Date().toISOString(),
    };
}

function fromCloudRow(row) {
    if (!row) return null;
    return normalizeSettings({
        // fall back to legacy shared base url if split urls do not exist
        region: row.region,
        voiceProvider: row.voice_provider,
        openaiApiKey: row.openai_api_key,
        cnSttApiKey: row.cn_stt_api_key,
        cnRewriteApiKey: row.cn_rewrite_api_key,
        cnBaseUrl: row.cn_base_url,
        cnSttBaseUrl: row.cn_stt_base_url || row.cn_base_url,
        cnRewriteBaseUrl: row.cn_rewrite_base_url || row.cn_base_url,
        cnSttModel: row.cn_stt_model,
        cnRewriteModel: row.cn_rewrite_model,
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
    const regionSelect = document.getElementById('regionSelect');
    const cnSection = document.getElementById('cnApiKeysSection');
    const providerOpenAiOption = document.querySelector('#voiceProviderSelect option[value="openai"]');
    const isCn = regionSelect?.value === 'china_mainland';

    if (providerOpenAiOption) {
        providerOpenAiOption.textContent = isCn
            ? 'Customized Models and API'
            : 'OpenAI Whisper + GPT (High Quality)';
    }

    if (openaiSection) openaiSection.style.display = (provider === 'openai' && !isCn) ? 'block' : 'none';
    if (externalSection) externalSection.style.display = provider === 'external' ? 'block' : 'none';
    if (cnSection) {
        const showCn = provider === 'openai' && isCn;
        cnSection.style.display = showCn ? 'block' : 'none';
    }
}

// Populate settings modal from stored values
export function populateSettingsModal() {
    const settings = getSettings();
    const providerSelect = document.getElementById('voiceProviderSelect');
    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const regionSelect = document.getElementById('regionSelect');
    const cnSttInput = document.getElementById('cnSttApiKeyInput');
    const cnRewriteInput = document.getElementById('cnRewriteApiKeyInput');
    const cnSttBaseUrlInput = document.getElementById('cnSttBaseUrlInput');
    const cnRewriteBaseUrlInput = document.getElementById('cnRewriteBaseUrlInput');
    const cnSttModelInput = document.getElementById('cnSttModelInput');
    const cnRewriteModelInput = document.getElementById('cnRewriteModelInput');
    const languageSelect = document.getElementById('voiceLanguageSelect');
    const externalUrlInput = document.getElementById('externalAppUrlInput');

    if (providerSelect) providerSelect.value = settings.voiceProvider;
    if (apiKeyInput) apiKeyInput.value = settings.openaiApiKey;
    if (regionSelect) regionSelect.value = settings.region || 'global';
    if (cnSttInput) cnSttInput.value = settings.cnSttApiKey || '';
    if (cnRewriteInput) cnRewriteInput.value = settings.cnRewriteApiKey || '';
    if (cnSttBaseUrlInput) cnSttBaseUrlInput.value = settings.cnSttBaseUrl || settings.cnBaseUrl || '';
    if (cnRewriteBaseUrlInput) cnRewriteBaseUrlInput.value = settings.cnRewriteBaseUrl || settings.cnBaseUrl || '';
    if (cnSttModelInput) cnSttModelInput.value = settings.cnSttModel || 'whisper-1';
    if (cnRewriteModelInput) cnRewriteModelInput.value = settings.cnRewriteModel || 'gpt-4o-mini';
    if (languageSelect) languageSelect.value = settings.language;
    if (externalUrlInput) externalUrlInput.value = settings.externalAppUrl;

    updateSettingsVisibility(settings.voiceProvider);
}

function createCloudSyncTask(userId, settings, timeoutMs = 5000) {
    if (!userId) return null;
    const syncPromise = saveCloudSettings(userId, settings);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('云端同步超时，请稍后重试。')), timeoutMs);
    });
    return Promise.race([syncPromise, timeoutPromise]);
}

// Save settings from modal inputs
export function saveSettingsFromModal(userId) {
    const providerSelect = document.getElementById('voiceProviderSelect');
    const apiKeyInput = document.getElementById('openaiApiKeyInput');
    const regionSelect = document.getElementById('regionSelect');
    const cnSttInput = document.getElementById('cnSttApiKeyInput');
    const cnRewriteInput = document.getElementById('cnRewriteApiKeyInput');
    const cnSttBaseUrlInput = document.getElementById('cnSttBaseUrlInput');
    const cnRewriteBaseUrlInput = document.getElementById('cnRewriteBaseUrlInput');
    const cnSttModelInput = document.getElementById('cnSttModelInput');
    const cnRewriteModelInput = document.getElementById('cnRewriteModelInput');
    const languageSelect = document.getElementById('voiceLanguageSelect');
    const externalUrlInput = document.getElementById('externalAppUrlInput');

    const settings = {
        region: regionSelect?.value || 'global',
        voiceProvider: providerSelect?.value || 'openai',
        openaiApiKey: apiKeyInput?.value?.trim() || '',
        cnSttApiKey: cnSttInput?.value?.trim() || '',
        cnRewriteApiKey: cnRewriteInput?.value?.trim() || '',
        cnBaseUrl: '',
        cnSttBaseUrl: cnSttBaseUrlInput?.value?.trim() || '',
        cnRewriteBaseUrl: cnRewriteBaseUrlInput?.value?.trim() || '',
        cnSttModel: cnSttModelInput?.value?.trim() || 'whisper-1',
        cnRewriteModel: cnRewriteModelInput?.value?.trim() || 'gpt-4o-mini',
        language: languageSelect?.value || 'auto',
        externalAppUrl: externalUrlInput?.value?.trim() || '',
    };

    const savedSettings = saveSettings(settings);
    const cloudSyncPromise = createCloudSyncTask(userId, savedSettings);
    return { settings: savedSettings, cloudSyncPromise };
}

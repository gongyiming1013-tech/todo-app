import { supabase } from './supabase.js';
import {
    getCurrentUser, setCurrentUser,
    showLogin, showRegister, showForgotPassword, showResetPassword,
    showMessage, showAuth, showApp,
    handleLogin, handleRegister, handleResetPassword, handleSetNewPassword, handleLogout
} from './auth.js';
import { loadTodos, subscribeToChanges, addTodo, updateTodoStatus, updateTodoPriority, deleteTodo, setTodos, updateTodoEta, updateTodoCategory, updateTodoText, addTodoImage, replaceTodoImage, deleteTodoImage, DEFAULT_CATEGORIES } from './todos.js';
import { setupImageUploadEvents, showImageModal, showImageOverlay } from './imageUpload.js';
import { populateSettingsModal, updateSettingsVisibility, saveSettingsFromModal, syncSettingsForUser, setSettingsSupabaseClient } from './settings.js';
import { startListening, stopListening, setOnStateChange, setOnResult, setOnError, VoiceState } from './voice/voiceService.js';
import { getVoiceDebugLogs, clearVoiceDebugLogs, logVoiceEvent } from './voice/debugLog.js';
import { parseVoiceInput } from './nlu.js';

setSettingsSupabaseClient(supabase);
window.getVoiceDebugLogs = getVoiceDebugLogs;
window.clearVoiceDebugLogs = clearVoiceDebugLogs;
window.get_voice_debug_logs = getVoiceDebugLogs;
window.clear_voice_debug_logs = clearVoiceDebugLogs;

async function init() {
    if (!supabase) {
        showMessage('Connection failed. Please refresh the page.', 'error');
        return;
    }

    try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'recovery') {
            showResetPassword();
            showMessage('Please set your new password', 'success');
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setCurrentUser(session.user);
            document.getElementById('userEmail').textContent = session.user.email;
            await syncSettingsForUser(session.user.id);

            if (type !== 'recovery') {
                showApp();
                loadTodos();
                subscribeToChanges();
            }
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            try {
                if (event === 'PASSWORD_RECOVERY') {
                    showResetPassword();
                    showMessage('Please set your new password', 'success');
                    return;
                }

                if (session) {
                    setCurrentUser(session.user);
                    document.getElementById('userEmail').textContent = session.user.email;
                    await syncSettingsForUser(session.user.id);

                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    if (hashParams.get('type') !== 'recovery') {
                        showApp();
                        loadTodos();
                        subscribeToChanges();
                    }
                } else {
                    setCurrentUser(null);
                    setTodos([]);
                    showAuth();
                }
            } catch (error) {
                console.error('Auth state handling failed:', error);
            }
        });
    } catch (error) {
        console.error('Init failed:', error);
    }
}

// Bind events
document.getElementById('registerLink').addEventListener('click', showRegister);
document.getElementById('loginLink').addEventListener('click', showLogin);
document.getElementById('forgotLink').addEventListener('click', showForgotPassword);
document.getElementById('backToLoginLink').addEventListener('click', showLogin);
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('registerBtn').addEventListener('click', handleRegister);
document.getElementById('resetBtn').addEventListener('click', handleResetPassword);
document.getElementById('setPasswordBtn').addEventListener('click', handleSetNewPassword);
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('addBtn').addEventListener('click', addTodo);

document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});

document.getElementById('passwordInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
});

document.getElementById('todoList').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        deleteTodo(deleteBtn.dataset.id);
    }
});

function pickImageFile(onFile) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) await onFile(file);
    }, { once: true });
    fileInput.click();
}

document.getElementById('todoList').addEventListener('click', async (e) => {
    const thumb = e.target.closest('.todo-image-thumb');
    if (thumb?.dataset.todoId) {
        showImageOverlay(thumb.dataset.todoId);
        return;
    }
    if (thumb?.dataset.imageUrl) {
        showImageModal(thumb.dataset.imageUrl);
        return;
    }

    const editBtn = e.target.closest('.edit-text-btn');
    if (editBtn) {
        const item = editBtn.closest('.todo-item');
        item.classList.add('editing-text');
        const input = item.querySelector('.todo-text-input');
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    const saveBtn = e.target.closest('.todo-text-save-btn');
    if (saveBtn) {
        const item = saveBtn.closest('.todo-item');
        const input = item?.querySelector('.todo-text-input');
        const value = input?.value.trim() || '';
        if (!value) return;
        await updateTodoText(saveBtn.dataset.id, value);
        return;
    }

    const cancelBtn = e.target.closest('.todo-text-cancel-btn');
    if (cancelBtn) {
        const item = cancelBtn.closest('.todo-item');
        item?.classList.remove('editing-text');
        return;
    }

    const addImageBtn = e.target.closest('.todo-image-add-btn');
    if (addImageBtn && !addImageBtn.disabled) {
        pickImageFile(async (file) => {
            await addTodoImage(addImageBtn.dataset.id, file);
        });
        return;
    }

    const replaceImageBtn = e.target.closest('.todo-image-replace-btn');
    if (replaceImageBtn) {
        pickImageFile(async (file) => {
            await replaceTodoImage(replaceImageBtn.dataset.id, replaceImageBtn.dataset.imageId, file);
        });
        return;
    }

    const deleteImageBtn = e.target.closest('.todo-image-delete-btn');
    if (deleteImageBtn) {
        await deleteTodoImage(deleteImageBtn.dataset.id, deleteImageBtn.dataset.imageId);
    }
});

document.getElementById('todoList').addEventListener('keydown', async (e) => {
    if (!e.target.classList.contains('todo-text-input')) return;
    const id = e.target.dataset.id;
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = e.target.value.trim();
        if (!value) return;
        await updateTodoText(id, value);
    }
    if (e.key === 'Escape') {
        const item = e.target.closest('.todo-item');
        item?.classList.remove('editing-text');
    }
});

document.getElementById('todoList').addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
        updateTodoStatus(e.target.dataset.id, e.target.value);
    }
    if (e.target.classList.contains('priority-select-small')) {
        updateTodoPriority(e.target.dataset.id, e.target.value);
    }
    if (e.target.classList.contains('eta-input-hidden')) {
        updateTodoEta(e.target.dataset.id, e.target.value);
    }
});

document.getElementById('todoList').addEventListener('click', (e) => {
    const badge = e.target.closest('.eta-badge');
    if (badge) {
        const id = badge.dataset.id;
        const hiddenInput = badge.parentElement.querySelector(`.eta-input-hidden[data-id="${id}"]`);
        if (hiddenInput) {
            hiddenInput.showPicker();
        }
    }

    const catBadge = e.target.closest('.category-badge');
    if (catBadge) {
        const id = catBadge.dataset.id;
        // Replace badge with a select dropdown
        const select = document.createElement('select');
        select.className = 'category-select';
        select.dataset.id = id;
        const currentCat = catBadge.textContent.trim();
        // Collect all categories (defaults + custom from existing todos)
        const allCats = [...DEFAULT_CATEGORIES];
        document.querySelectorAll('.category-badge').forEach(b => {
            const val = b.textContent.trim();
            if (val && !allCats.includes(val)) allCats.push(val);
        });
        allCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === currentCat) opt.selected = true;
            select.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = 'Custom...';
        select.appendChild(customOpt);

        catBadge.replaceWith(select);
        select.focus();

        select.addEventListener('change', () => {
            if (select.value === '__custom__') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'category-custom-input';
                input.dataset.id = id;
                input.placeholder = 'Category name';
                select.replaceWith(input);
                input.focus();

                const confirmCustom = () => {
                    const val = input.value.trim();
                    if (val) {
                        updateTodoCategory(id, val);
                    } else {
                        loadTodos();
                    }
                };
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') confirmCustom();
                    if (ev.key === 'Escape') loadTodos();
                });
                input.addEventListener('blur', confirmCustom);
            } else {
                updateTodoCategory(id, select.value);
            }
        });
        select.addEventListener('blur', () => {
            // If still a select (not replaced by input), revert on blur without change
            setTimeout(() => {
                if (document.contains(select)) loadTodos();
            }, 150);
        });
    }
});

setupImageUploadEvents();

// Voice input setup
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');

setOnStateChange((state) => {
    voiceBtn.className = 'voice-btn';
    voiceStatus.textContent = '';
    if (state === VoiceState.LISTENING) {
        voiceBtn.classList.add('listening');
        voiceStatus.textContent = 'Listening...';
    } else if (state === VoiceState.PROCESSING) {
        voiceBtn.classList.add('processing');
        voiceStatus.textContent = 'Processing...';
    } else if (state === VoiceState.ERROR) {
        voiceBtn.classList.add('error');
    }
});

setOnResult(async (text) => {
    const todoInput = document.getElementById('todoInput');
    const priorityInput = document.getElementById('priorityInput');
    const etaInput = document.getElementById('etaInput');

    // Pass current form state so NLU can intelligently merge/correct
    const existingContext = todoInput.value.trim() ? {
        text: todoInput.value.trim(),
        priority: priorityInput?.value || 'P2',
        eta: etaInput?.value || null,
    } : null;

    const parsed = await parseVoiceInput(text, existingContext);

    // Update text: GPT decides whether to replace, merge, or keep
    if (parsed.textChanged && parsed.text) {
        todoInput.value = parsed.text;
    } else if (!existingContext && parsed.text) {
        todoInput.value = parsed.text;
    }
    // Update priority only if explicitly mentioned
    if (priorityInput && parsed.priority && parsed.priorityExplicit) {
        priorityInput.value = parsed.priority;
    }
    // Update ETA only if a date was detected
    if (etaInput && parsed.eta) {
        etaInput.value = parsed.eta;
    }
});

setOnError((error) => {
    logVoiceEvent('ui.voice.error.shown', { error });
    voiceStatus.textContent = error;
    if (window.matchMedia('(max-width: 600px)').matches) {
        alert(error);
    }
    setTimeout(() => { voiceStatus.textContent = ''; }, 3000);
});

voiceBtn.addEventListener('click', () => {
    startListening();
    voiceBtn.blur();
});

// Settings modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsSaveStatus = document.getElementById('settingsSaveStatus');
const voiceProviderSelect = document.getElementById('voiceProviderSelect');

function setSettingsSaveStatus(message = '', type = '') {
    settingsSaveStatus.textContent = message;
    settingsSaveStatus.classList.remove('success', 'error');
    if (type) settingsSaveStatus.classList.add(type);
}

settingsBtn.addEventListener('click', () => {
    populateSettingsModal();
    setSettingsSaveStatus('');
    settingsModal.classList.add('show');
});

settingsCloseBtn.addEventListener('click', () => {
    settingsModal.classList.remove('show');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('show');
});

voiceProviderSelect.addEventListener('change', (e) => {
    updateSettingsVisibility(e.target.value);
});

saveSettingsBtn.addEventListener('click', async () => {
    const originalText = saveSettingsBtn.textContent;
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = '保存中...';
    setSettingsSaveStatus('保存中...');
    try {
        const currentUser = getCurrentUser();
        const { cloudError } = await saveSettingsFromModal(currentUser?.id);
        if (cloudError) {
            setSettingsSaveStatus(`本地保存成功，但云端同步失败：${cloudError.message}`, 'error');
            return;
        }
        if (currentUser) {
            setSettingsSaveStatus('保存成功，云端同步成功。', 'success');
        } else {
            setSettingsSaveStatus('保存成功（仅本地）。登录后可自动同步到云端。', 'success');
        }
        setTimeout(() => {
            settingsModal.classList.remove('show');
        }, 1000);
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = originalText;
    }
});

// Start app
init();

import { supabase } from './supabase.js';
import {
    getCurrentUser, setCurrentUser,
    showLogin, showRegister, showForgotPassword, showResetPassword,
    showMessage, showAuth, showApp,
    handleLogin, handleRegister, handleResetPassword, handleSetNewPassword, handleLogout
} from './auth.js';
import { loadTodos, subscribeToChanges, addTodo, updateTodoStatus, updateTodoPriority, deleteTodo, setTodos, updateTodoEta } from './todos.js';
import { setupImageUploadEvents } from './imageUpload.js';
import { populateSettingsModal, updateSettingsVisibility, saveSettingsFromModal } from './settings.js';
import { startListening, stopListening, setOnStateChange, setOnResult, setOnError, VoiceState } from './voice/voiceService.js';
import { parseVoiceInput } from './nlu.js';

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

            if (type !== 'recovery') {
                showApp();
                loadTodos();
                subscribeToChanges();
            }
        }

        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                showResetPassword();
                showMessage('Please set your new password', 'success');
                return;
            }

            if (session) {
                setCurrentUser(session.user);
                document.getElementById('userEmail').textContent = session.user.email;

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
    const parsed = await parseVoiceInput(text);
    const todoInput = document.getElementById('todoInput');
    const priorityInput = document.getElementById('priorityInput');
    const etaInput = document.getElementById('etaInput');

    // Incremental merge: only update fields that the new voice input provides.
    // If the input field already has text, append rather than replace.
    if (todoInput && parsed.text) {
        if (todoInput.value.trim()) {
            todoInput.value = todoInput.value.trim() + '，' + parsed.text;
        } else {
            todoInput.value = parsed.text;
        }
    }
    // Only update priority if explicitly mentioned (not the default P2)
    if (priorityInput && parsed.priority && parsed.priorityExplicit) {
        priorityInput.value = parsed.priority;
    } else if (priorityInput && parsed.priority && !todoInput.value.trim()) {
        // First input: always set priority
        priorityInput.value = parsed.priority;
    }
    // Only update ETA if a date was actually detected
    if (etaInput && parsed.eta) {
        etaInput.value = parsed.eta;
    }
});

setOnError((error) => {
    voiceStatus.textContent = error;
    setTimeout(() => { voiceStatus.textContent = ''; }, 3000);
});

voiceBtn.addEventListener('click', () => startListening());

// Settings modal
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const voiceProviderSelect = document.getElementById('voiceProviderSelect');

settingsBtn.addEventListener('click', () => {
    populateSettingsModal();
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

saveSettingsBtn.addEventListener('click', () => {
    saveSettingsFromModal();
    settingsModal.classList.remove('show');
});

// Start app
init();

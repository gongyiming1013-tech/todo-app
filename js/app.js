import { supabase } from './supabase.js';
import {
    getCurrentUser, setCurrentUser,
    showLogin, showRegister, showForgotPassword, showResetPassword,
    showMessage, showAuth, showApp,
    handleLogin, handleRegister, handleResetPassword, handleSetNewPassword, handleLogout
} from './auth.js';
import { loadTodos, subscribeToChanges, addTodo, updateTodoStatus, updateTodoPriority, deleteTodo, setTodos, updateTodoEta } from './todos.js';
import { setupImageUploadEvents } from './imageUpload.js';

async function init() {
    if (!supabase) {
        showMessage('网络连接失败，请刷新页面重试', 'error');
        return;
    }

    try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'recovery') {
            showResetPassword();
            showMessage('请设置您的新密码', 'success');
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
                showMessage('请设置您的新密码', 'success');
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
        console.error('初始化失败:', error);
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
    if (e.target.classList.contains('eta-input')) {
        updateTodoEta(e.target.dataset.id, e.target.value);
    }
});

setupImageUploadEvents();

// Start app
init();

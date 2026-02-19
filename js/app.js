import { supabase } from './supabase.js';
import {
    getCurrentUser, setCurrentUser,
    showLogin, showRegister, showForgotPassword, showResetPassword,
    showMessage, showAuth, showApp,
    handleLogin, handleRegister, handleResetPassword, handleSetNewPassword, handleLogout
} from './auth.js';
import { loadTodos, subscribeToChanges, addTodo, updateTodoStatus, updateTodoPriority, deleteTodo, setTodos, updateTodoEta, updateTodoCategory, DEFAULT_CATEGORIES } from './todos.js';
import { setupImageUploadEvents } from './imageUpload.js';

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

// Start app
init();

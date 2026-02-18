import { supabase } from './supabase.js';

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

// UI helpers
export function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('resetPasswordForm').style.display = 'none';
    clearMessage();
}

export function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('resetPasswordForm').style.display = 'none';
    clearMessage();
}

export function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'block';
    document.getElementById('resetPasswordForm').style.display = 'none';
    clearMessage();
}

export function showResetPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    document.getElementById('resetPasswordForm').style.display = 'block';
    clearMessage();
}

export function showMessage(text, type) {
    const msgEl = document.getElementById('authMessage');
    msgEl.className = 'message ' + type;
    msgEl.textContent = text;
    msgEl.style.display = 'block';
}

export function clearMessage() {
    document.getElementById('authMessage').style.display = 'none';
}

export function showAuth() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

export function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
}

export async function handleLogin() {
    if (!supabase) {
        showMessage('Connection failed. Please refresh the page.', 'error');
        return;
    }

    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!email || !password) {
        showMessage('Please enter your email and password', 'error');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        btn.textContent = 'Sign In';

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                showMessage('Email not verified. Please check your inbox and click the verification link.', 'error');
            } else if (error.message.includes('Invalid login credentials')) {
                showMessage('Invalid email or password. Please sign up or try a different password.', 'error');
            } else {
                showMessage('Sign in failed: ' + error.message, 'error');
            }
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
        showMessage('Sign in failed: ' + e.message, 'error');
    }
}

export async function handleRegister() {
    if (!supabase) {
        showMessage('Connection failed. Please refresh the page.', 'error');
        return;
    }

    const email = document.getElementById('regEmailInput').value.trim();
    const password = document.getElementById('regPasswordInput').value;

    if (!email || !password) {
        showMessage('Please enter your email and password', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    try {
        const { error } = await supabase.auth.signUp({ email, password });
        btn.disabled = false;
        btn.textContent = 'Sign Up';

        if (error) {
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                showMessage('This email is already registered. Please sign in or reset your password.', 'error');
                showLogin();
            } else {
                showMessage('Sign up failed: ' + error.message, 'error');
            }
        } else {
            showMessage('Sign up successful! Please check your email and click the verification link, then come back to sign in.', 'success');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Sign Up';
        showMessage('Sign up failed: ' + e.message, 'error');
    }
}

export async function handleResetPassword() {
    if (!supabase) {
        showMessage('Connection failed. Please refresh the page.', 'error');
        return;
    }

    const email = document.getElementById('resetEmailInput').value.trim();

    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }

    const btn = document.getElementById('resetBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';

        if (error) {
            if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
                showMessage('Too many requests. Please try again later.', 'error');
            } else {
                showMessage('Failed to send: ' + error.message, 'error');
            }
        } else {
            showMessage('Reset link sent to your email. Please check your inbox.', 'success');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
        showMessage('Failed to send: ' + e.message, 'error');
    }
}

export async function handleSetNewPassword() {
    if (!supabase) {
        showMessage('Connection failed. Please refresh the page.', 'error');
        return;
    }

    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!newPassword || !confirmPassword) {
        showMessage('Please enter your new password', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    const btn = document.getElementById('setPasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Setting...';

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        btn.disabled = false;
        btn.textContent = 'Set New Password';

        if (error) {
            showMessage('Failed: ' + error.message, 'error');
        } else {
            showMessage('Password updated successfully!', 'success');
            window.history.replaceState(null, '', window.location.pathname);
            showLogin();
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Set New Password';
        showMessage('Failed: ' + e.message, 'error');
    }
}

export async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

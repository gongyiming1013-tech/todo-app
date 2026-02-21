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
        showMessage('请输入邮箱和密码', 'error');
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
                showMessage('邮箱或密码错误；如果你刚注册，可能是 Supabase 仍开启了邮箱验证。', 'error');
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
    const confirmPassword = document.getElementById('regConfirmPasswordInput').value;

    if (!email || !password || !confirmPassword) {
        showMessage('请输入邮箱和密码', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('密码至少需要6位', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
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
            if (data?.session) {
                showMessage('注册并登录成功。', 'success');
                return;
            }
            if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
                showMessage('该邮箱可能已注册，请直接登录或重置密码。', 'error');
                showLogin();
                return;
            }
            showMessage('注册成功，正在登录...', 'success');
            let signInError = null;
            for (let i = 0; i < 3; i++) {
                const { error: tryError } = await supabase.auth.signInWithPassword({ email, password });
                if (!tryError) {
                    signInError = null;
                    break;
                }
                signInError = tryError;
                if (i < 2 && tryError.message.includes('Invalid login credentials')) {
                    await new Promise((resolve) => setTimeout(resolve, 700));
                    continue;
                }
                break;
            }
            if (signInError) {
                if (signInError.message.includes('Email not confirmed') || signInError.message.includes('Invalid login credentials')) {
                    showMessage('注册成功，但当前 Supabase 仍开启邮箱验证；请先关闭 Confirm email 或完成邮箱验证。', 'error');
                } else {
                    showMessage('注册成功，请直接登录。', 'success');
                }
                showLogin();
            }
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
        showMessage('密码至少需要6位', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
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
            showMessage('密码设置成功', 'success');
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

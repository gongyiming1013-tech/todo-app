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
        showMessage('网络连接失败，请刷新页面重试', 'error');
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
    btn.textContent = '登录中...';

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        btn.textContent = '登录';

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                showMessage('邮箱尚未验证，请先到邮箱点击验证链接', 'error');
            } else if (error.message.includes('Invalid login credentials')) {
                showMessage('用户不存在或密码错误，请先注册账号或者尝试其他密码', 'error');
            } else {
                showMessage('登录失败：' + error.message, 'error');
            }
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '登录';
        showMessage('登录失败：' + e.message, 'error');
    }
}

export async function handleRegister() {
    if (!supabase) {
        showMessage('网络连接失败，请刷新页面重试', 'error');
        return;
    }

    const email = document.getElementById('regEmailInput').value.trim();
    const password = document.getElementById('regPasswordInput').value;

    if (!email || !password) {
        showMessage('请输入邮箱和密码', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('密码至少需要6位', 'error');
        return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = '注册中...';

    try {
        const { error } = await supabase.auth.signUp({ email, password });
        btn.disabled = false;
        btn.textContent = '注册';

        if (error) {
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                showMessage('该邮箱已注册，请直接登录。如果忘记密码，可点击"忘记密码"重置', 'error');
                showLogin();
            } else {
                showMessage('注册失败：' + error.message, 'error');
            }
        } else {
            showMessage('注册成功！请先到邮箱点击验证链接，然后再回来登录', 'success');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '注册';
        showMessage('注册失败：' + e.message, 'error');
    }
}

export async function handleResetPassword() {
    if (!supabase) {
        showMessage('网络连接失败，请刷新页面重试', 'error');
        return;
    }

    const email = document.getElementById('resetEmailInput').value.trim();

    if (!email) {
        showMessage('请输入邮箱地址', 'error');
        return;
    }

    const btn = document.getElementById('resetBtn');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        btn.disabled = false;
        btn.textContent = '发送重置链接';

        if (error) {
            if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
                showMessage('发送过于频繁，请稍后再试（约1小时后）', 'error');
            } else {
                showMessage('发送失败：' + error.message, 'error');
            }
        } else {
            showMessage('重置链接已发送到您的邮箱，请查收', 'success');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '发送重置链接';
        showMessage('发送失败：' + e.message, 'error');
    }
}

export async function handleSetNewPassword() {
    if (!supabase) {
        showMessage('网络连接失败，请刷新页面重试', 'error');
        return;
    }

    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!newPassword || !confirmPassword) {
        showMessage('请输入新密码', 'error');
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
    btn.textContent = '设置中...';

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        btn.disabled = false;
        btn.textContent = '设置新密码';

        if (error) {
            showMessage('设置失败：' + error.message, 'error');
        } else {
            showMessage('密码设置成功！', 'success');
            window.history.replaceState(null, '', window.location.pathname);
            showLogin();
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '设置新密码';
        showMessage('设置失败：' + e.message, 'error');
    }
}

export async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

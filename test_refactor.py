"""
Tests for the todo-app refactoring.
Validates file structure, HTML integrity, JS module exports/imports, CSS extraction, and worker proxy.
"""

import os
import re
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class TestFileStructure(unittest.TestCase):
    """Verify all expected files exist after refactoring."""

    EXPECTED_FILES = [
        'index.html',
        'css/style.css',
        'js/config.js',
        'js/supabase.js',
        'js/auth.js',
        'js/todos.js',
        'js/dragdrop.js',
        'js/imageUpload.js',
        'js/app.js',
        'worker/worker.js',
        'worker/wrangler.toml',
        'README.md',
    ]

    def test_all_files_exist(self):
        for f in self.EXPECTED_FILES:
            path = os.path.join(BASE_DIR, f)
            self.assertTrue(os.path.isfile(path), f"Missing file: {f}")

    def test_directories_exist(self):
        for d in ['css', 'js', 'worker']:
            path = os.path.join(BASE_DIR, d)
            self.assertTrue(os.path.isdir(path), f"Missing directory: {d}")

    def test_no_empty_files(self):
        for f in self.EXPECTED_FILES:
            path = os.path.join(BASE_DIR, f)
            size = os.path.getsize(path)
            self.assertGreater(size, 0, f"File is empty: {f}")


class TestIndexHtml(unittest.TestCase):
    """Verify index.html is clean after refactoring."""

    def setUp(self):
        with open(os.path.join(BASE_DIR, 'index.html'), 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_no_inline_style_tag(self):
        self.assertNotIn('<style>', self.content, "index.html should not contain inline <style>")

    def test_no_inline_script_content(self):
        # Should only have <script type="module" src="js/app.js"></script>, no inline JS
        script_matches = re.findall(r'<script[^>]*>(.+?)</script>', self.content, re.DOTALL)
        for match in script_matches:
            self.assertEqual(match.strip(), '', "index.html should not contain inline script content")

    def test_links_external_css(self):
        self.assertIn('href="css/style.css"', self.content, "Should link to external CSS")

    def test_links_external_js(self):
        self.assertIn('src="js/app.js"', self.content, "Should link to external JS module")

    def test_has_doctype(self):
        self.assertTrue(self.content.strip().startswith('<!DOCTYPE html>'), "Should start with DOCTYPE")

    def test_has_all_essential_ids(self):
        essential_ids = [
            'authContainer', 'appContainer', 'loginForm', 'registerForm',
            'forgotPasswordForm', 'resetPasswordForm', 'authMessage',
            'emailInput', 'passwordInput', 'loginBtn', 'registerBtn',
            'resetBtn', 'setPasswordBtn', 'logoutBtn', 'todoInput',
            'priorityInput', 'addBtn', 'todoList', 'stats',
            'imageInput', 'imagePreviewBar', 'uploadPreview', 'removeImageBtn',
            'imageModal', 'imageModalClose', 'imageModalImg',
            'syncIndicator', 'userEmail',
            'registerLink', 'loginLink', 'forgotLink', 'backToLoginLink',
            'uploadLabel',
        ]
        for id_name in essential_ids:
            self.assertIn(f'id="{id_name}"', self.content, f"Missing element id: {id_name}")

    def test_html_is_much_smaller(self):
        # Original was ~1483 lines, refactored should be ~100 lines
        lines = self.content.strip().split('\n')
        self.assertLess(len(lines), 150, f"index.html should be compact after refactoring, got {len(lines)} lines")


class TestCSSFile(unittest.TestCase):
    """Verify CSS was correctly extracted."""

    def setUp(self):
        with open(os.path.join(BASE_DIR, 'css', 'style.css'), 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_has_base_styles(self):
        self.assertIn('box-sizing: border-box', self.content)

    def test_has_auth_styles(self):
        self.assertIn('.auth-container', self.content)
        self.assertIn('.auth-btn', self.content)
        self.assertIn('.auth-input', self.content)

    def test_has_todo_styles(self):
        self.assertIn('.todo-item', self.content)
        self.assertIn('.todo-list', self.content)
        self.assertIn('.priority-badge', self.content)

    def test_has_responsive_styles(self):
        self.assertIn('@media (max-width: 600px)', self.content)

    def test_has_animation_keyframes(self):
        self.assertIn('@keyframes spin', self.content)
        self.assertIn('@keyframes pulse', self.content)

    def test_has_image_modal_styles(self):
        self.assertIn('.image-modal', self.content)
        self.assertIn('.upload-btn', self.content)

    def test_has_drag_styles(self):
        self.assertIn('.drag-handle', self.content)
        self.assertIn('.todo-item.dragging', self.content)
        self.assertIn('.touch-dragging', self.content)

    def test_no_html_tags(self):
        self.assertNotIn('<style>', self.content)
        self.assertNotIn('</style>', self.content)


class TestJSModules(unittest.TestCase):
    """Verify JS modules have correct exports and imports."""

    def _read(self, filename):
        with open(os.path.join(BASE_DIR, 'js', filename), 'r', encoding='utf-8') as f:
            return f.read()

    def test_config_exports(self):
        content = self._read('config.js')
        self.assertIn('export const SUPABASE_URL', content)
        self.assertIn('export const SUPABASE_ANON_KEY', content)

    def test_supabase_imports_config(self):
        content = self._read('supabase.js')
        self.assertIn("from './config.js'", content)
        self.assertIn('SUPABASE_URL', content)
        self.assertIn('SUPABASE_ANON_KEY', content)

    def test_supabase_exports_client(self):
        content = self._read('supabase.js')
        self.assertIn('export', content)
        self.assertIn('supabase', content)

    def test_auth_imports_supabase(self):
        content = self._read('auth.js')
        self.assertIn("from './supabase.js'", content)

    def test_auth_exports_functions(self):
        content = self._read('auth.js')
        expected_exports = [
            'handleLogin', 'handleRegister', 'handleResetPassword',
            'handleSetNewPassword', 'handleLogout',
            'showLogin', 'showRegister', 'showForgotPassword', 'showResetPassword',
            'showMessage', 'clearMessage', 'showAuth', 'showApp',
            'getCurrentUser', 'setCurrentUser',
        ]
        for fn in expected_exports:
            self.assertIn(f'export', content, f"auth.js should export {fn}")
            self.assertIn(fn, content, f"auth.js should contain {fn}")

    def test_todos_imports_supabase(self):
        content = self._read('todos.js')
        self.assertIn("from './supabase.js'", content)

    def test_todos_exports_functions(self):
        content = self._read('todos.js')
        expected = ['loadTodos', 'addTodo', 'updateTodoStatus', 'updateTodoPriority', 'deleteTodo', 'renderTodos']
        for fn in expected:
            self.assertIn(fn, content, f"todos.js should contain {fn}")

    def test_dragdrop_imports(self):
        content = self._read('dragdrop.js')
        self.assertIn("from './supabase.js'", content)
        self.assertIn("from './todos.js'", content)

    def test_dragdrop_exports_setup(self):
        content = self._read('dragdrop.js')
        self.assertIn('export function setupDragAndDrop', content)

    def test_image_upload_exports(self):
        content = self._read('imageUpload.js')
        expected = ['getPendingImageFile', 'clearPendingImage', 'showImageModal', 'closeImageModal', 'setupImageUploadEvents']
        for fn in expected:
            self.assertIn(fn, content, f"imageUpload.js should contain {fn}")

    def test_app_imports_all_modules(self):
        content = self._read('app.js')
        self.assertIn("from './supabase.js'", content)
        self.assertIn("from './auth.js'", content)
        self.assertIn("from './todos.js'", content)
        self.assertIn("from './imageUpload.js'", content)

    def test_app_calls_init(self):
        content = self._read('app.js')
        self.assertIn('init()', content)

    def test_app_binds_events(self):
        content = self._read('app.js')
        self.assertIn("addEventListener('click'", content)
        self.assertIn("addEventListener('keypress'", content)
        self.assertIn("addEventListener('change'", content)


class TestWorkerProxy(unittest.TestCase):
    """Verify Cloudflare Worker proxy script."""

    def setUp(self):
        with open(os.path.join(BASE_DIR, 'worker', 'worker.js'), 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_targets_correct_supabase_url(self):
        self.assertIn('bsnyzpisrsywktjuzygf.supabase.co', self.content)

    def test_handles_cors_preflight(self):
        self.assertIn('OPTIONS', self.content)
        self.assertIn('Access-Control-Allow-Origin', self.content)
        self.assertIn('Access-Control-Allow-Methods', self.content)
        self.assertIn('Access-Control-Allow-Headers', self.content)

    def test_exports_fetch_handler(self):
        self.assertIn('export default', self.content)
        self.assertIn('async fetch', self.content)

    def test_forwards_request(self):
        self.assertIn('method: request.method', self.content)
        self.assertIn('headers:', self.content)


class TestWranglerConfig(unittest.TestCase):
    """Verify wrangler.toml configuration."""

    def setUp(self):
        with open(os.path.join(BASE_DIR, 'worker', 'wrangler.toml'), 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_has_worker_name(self):
        self.assertIn('name = "supabase-proxy"', self.content)

    def test_has_main_entry(self):
        self.assertIn('main = "worker.js"', self.content)

    def test_has_compatibility_date(self):
        self.assertIn('compatibility_date', self.content)


class TestReadme(unittest.TestCase):
    """Verify README.md has essential documentation."""

    def setUp(self):
        with open(os.path.join(BASE_DIR, 'README.md'), 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_has_project_title(self):
        self.assertIn('待办清单', self.content)

    def test_has_deploy_instructions(self):
        self.assertIn('wrangler', self.content.lower())
        self.assertIn('deploy', self.content.lower())

    def test_has_project_structure(self):
        self.assertIn('js/', self.content)
        self.assertIn('css/', self.content)
        self.assertIn('worker/', self.content)

    def test_has_cloudflare_mention(self):
        self.assertIn('Cloudflare', self.content)


class TestNoDataLoss(unittest.TestCase):
    """Verify no functionality was lost during refactoring."""

    def _read_all_js(self):
        content = ''
        for f in ['config.js', 'supabase.js', 'auth.js', 'todos.js', 'dragdrop.js', 'imageUpload.js', 'app.js']:
            with open(os.path.join(BASE_DIR, 'js', f), 'r', encoding='utf-8') as fh:
                content += fh.read() + '\n'
        return content

    def test_supabase_url_preserved(self):
        content = self._read_all_js()
        self.assertIn('bsnyzpisrsywktjuzygf.supabase.co', content)

    def test_supabase_key_preserved(self):
        content = self._read_all_js()
        self.assertIn('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', content)

    def test_all_auth_functions_preserved(self):
        content = self._read_all_js()
        functions = [
            'signInWithPassword', 'signUp', 'resetPasswordForEmail',
            'updateUser', 'signOut', 'getSession', 'onAuthStateChange',
        ]
        for fn in functions:
            self.assertIn(fn, content, f"Missing Supabase auth call: {fn}")

    def test_all_crud_operations_preserved(self):
        content = self._read_all_js()
        self.assertIn(".from('todos')", content)
        self.assertIn('.insert(', content)
        self.assertIn('.update(', content)
        self.assertIn('.delete()', content)
        self.assertIn('.select(', content)

    def test_realtime_subscription_preserved(self):
        content = self._read_all_js()
        self.assertIn('.channel(', content)
        self.assertIn('postgres_changes', content)
        self.assertIn('.subscribe()', content)

    def test_image_upload_preserved(self):
        content = self._read_all_js()
        self.assertIn('todo-images', content)
        self.assertIn('.upload(', content)
        self.assertIn('getPublicUrl', content)

    def test_drag_and_drop_preserved(self):
        content = self._read_all_js()
        self.assertIn('dragstart', content)
        self.assertIn('dragend', content)
        self.assertIn('touchstart', content)
        self.assertIn('touchmove', content)
        self.assertIn('touchend', content)

    def test_password_recovery_flow_preserved(self):
        content = self._read_all_js()
        self.assertIn('PASSWORD_RECOVERY', content)
        self.assertIn('recovery', content)

    def test_error_messages_preserved(self):
        content = self._read_all_js()
        messages = [
            '请输入邮箱和密码',
            '密码至少需要6位',
            '两次输入的密码不一致',
            '密码设置成功',
        ]
        for msg in messages:
            self.assertIn(msg, content, f"Missing error message: {msg}")


if __name__ == '__main__':
    unittest.main(verbosity=2)

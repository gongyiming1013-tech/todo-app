import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { setupDragAndDrop } from './dragdrop.js';

let todos = [];
let todoImagesByTodoId = {};
let todoImagesEnabled = true;
const MAX_TODO_IMAGES = 10;

export function getTodos() {
    return todos;
}

export function setTodos(newTodos) {
    todos = newTodos;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isMissingRelationError(error) {
    const msg = (error?.message || '').toLowerCase();
    const details = (error?.details || '').toLowerCase();
    const hint = (error?.hint || '').toLowerCase();
    return (
        error?.code === '42P01' ||
        error?.code === 'PGRST205' ||
        ((msg.includes('relation') || msg.includes('schema cache') || msg.includes('could not find the table')) && msg.includes('todo_images')) ||
        (details.includes('todo_images')) ||
        (hint.includes('todo_images'))
    );
}

function getTodoById(id) {
    return todos.find(t => t.id === id);
}

function getTodoImages(todo) {
    const images = [...(todoImagesByTodoId[todo.id] || [])];
    if (todo.image_url && !images.some(image => image.image_url === todo.image_url)) {
        images.unshift({
            id: `legacy-${todo.id}`,
            todo_id: todo.id,
            image_url: todo.image_url,
            sort_order: -1,
            is_legacy: true
        });
    }
    return images.slice(0, MAX_TODO_IMAGES);
}

async function uploadImageForTodo(file, userId) {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: uploadError } = await supabase.storage
        .from('todo-images')
        .upload(fileName, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('todo-images').getPublicUrl(fileName);
    return publicUrl;
}

async function syncLegacyImageFromTable(todoId) {
    if (!todoImagesEnabled) return;
    const todo = getTodoById(todoId);
    if (!todo) return;
    const rows = todoImagesByTodoId[todoId] || [];
    const nextLegacy = rows[0]?.image_url || null;
    if ((todo.image_url || null) === nextLegacy) return;
    await supabase.from('todos').update({ image_url: nextLegacy }).eq('id', todoId);
}

const STATUS_LABELS = {
    '未开始': 'Not Started',
    '进行中': 'In Progress',
    '已完成': 'Done',
    '暂停': 'Paused'
};

export const DEFAULT_CATEGORIES = ['Work', 'Life', 'Learning', 'Wish List', 'Others'];

function getCategoryOptions() {
    const custom = todos
        .map(t => t.category)
        .filter(c => c && !DEFAULT_CATEGORIES.includes(c));
    return [...DEFAULT_CATEGORIES, ...new Set(custom)];
}

function formatStartDate(createdAt) {
    if (!createdAt) return { date: '', duration: '' };
    const created = new Date(createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const createdDay = new Date(created);
    createdDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - createdDay) / 86400000);
    const mm = String(created.getMonth() + 1).padStart(2, '0');
    const dd = String(created.getDate()).padStart(2, '0');
    return {
        date: `${mm}-${dd}`,
        duration: diffDays === 0 ? 'Today' : `${diffDays}d`
    };
}

function formatEta(eta) {
    if (!eta) return { text: 'ETA', cssClass: 'eta-tba', isOverdue: false };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const etaDate = new Date(eta + 'T00:00:00');
    const isOverdue = etaDate < today;
    const mm = String(etaDate.getMonth() + 1).padStart(2, '0');
    const dd = String(etaDate.getDate()).padStart(2, '0');
    return {
        text: `${mm}-${dd}`,
        cssClass: isOverdue ? 'eta-overdue' : '',
        isOverdue
    };
}

export function showSyncIndicator() {
    const el = document.getElementById('syncIndicator');
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}

export async function loadTodos() {
    const currentUser = getCurrentUser();
    if (!supabase || !currentUser) return;

    try {
        const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Load failed:', error);
            return;
        }

        todos = data || [];
        todoImagesByTodoId = {};

        try {
            const { data: imageRows, error: imageError } = await supabase
                .from('todo_images')
                .select('id,todo_id,image_url,sort_order,created_at')
                .eq('user_id', currentUser.id)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true });
            if (imageError) {
                if (isMissingRelationError(imageError)) {
                    todoImagesEnabled = false;
                } else {
                    console.error('Image load failed:', imageError);
                }
            } else {
                todoImagesEnabled = true;
                for (const row of imageRows || []) {
                    if (!todoImagesByTodoId[row.todo_id]) todoImagesByTodoId[row.todo_id] = [];
                    todoImagesByTodoId[row.todo_id].push(row);
                }
            }
        } catch (imageErr) {
            if (!isMissingRelationError(imageErr)) {
                console.error('Image load failed:', imageErr);
            } else {
                todoImagesEnabled = false;
            }
        }

        renderTodos();
    } catch (e) {
        console.error('Load failed:', e);
    }
}

export function subscribeToChanges() {
    const currentUser = getCurrentUser();
    if (!supabase || !currentUser) return;

    supabase
        .channel('todos')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${currentUser.id}` },
            () => {
                showSyncIndicator();
                loadTodos();
            }
        )
        .subscribe();
}

export function renderTodos() {
    const todoList = document.getElementById('todoList');
    const stats = document.getElementById('stats');

    if (todos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                <p>No tasks yet</p>
                <p style="font-size: 14px; margin-top: 8px;">Add a task to get started</p>
            </div>`;
        stats.innerHTML = '';
        return;
    }

    todoList.innerHTML = todos.map(todo => {
        const eta = formatEta(todo.eta);
        const etaCompleted = todo.status === '已完成';
        const cat = todo.category || 'Others';
        const catOptions = getCategoryOptions();
        const startInfo = formatStartDate(todo.created_at);
        const images = getTodoImages(todo);
        const imageCount = images.length;
        const galleryHtml = images.length > 0
            ? `<div class="todo-image-gallery">
                ${images.map(image => `
                    <div class="todo-image-item">
                        <img src="${escapeHtml(image.image_url)}" class="todo-image-thumb" data-image-url="${escapeHtml(image.image_url)}" alt="附件">
                        <div class="todo-image-actions">
                            <button class="todo-image-replace-btn" data-id="${todo.id}" data-image-id="${image.id}" title="Replace image">↻</button>
                            <button class="todo-image-delete-btn" data-id="${todo.id}" data-image-id="${image.id}" title="Delete image">×</button>
                        </div>
                    </div>`).join('')}
               </div>`
            : '';
        return `
        <div class="todo-item ${todo.status === '已完成' ? 'completed' : ''}"
             data-id="${todo.id}"
             draggable="true">
            <div class="todo-row-top">
                <span class="drag-handle">☰</span>
                <span class="todo-text">
                    <span class="todo-text-display">${escapeHtml(todo.text)}${todo.source_text ? `<span class="source-text-indicator" title="${escapeHtml(todo.source_text.substring(0, 200))}">Text</span>` : ''}</span>
                    <div class="todo-text-editor">
                        <input type="text" class="todo-text-input" value="${escapeHtml(todo.text)}" data-id="${todo.id}">
                        <button class="todo-text-save-btn" data-id="${todo.id}">Save</button>
                        <button class="todo-text-cancel-btn" data-id="${todo.id}">Cancel</button>
                    </div>
                </span>
                <button class="delete-btn" data-id="${todo.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="todo-row-bottom">
                <span class="startdate-badge" title="Created">${startInfo.date}</span>
                <span class="duration-badge" title="Duration">${startInfo.duration}</span>
                <span class="badge-separator"></span>
                <span class="priority-badge priority-${todo.priority || 'P2'}">${todo.priority || 'P2'}</span>
                <span class="category-badge" data-id="${todo.id}" title="Category">${escapeHtml(cat)}</span>
                ${galleryHtml}
                <button class="todo-image-add-btn" data-id="${todo.id}" ${imageCount >= MAX_TODO_IMAGES ? 'disabled' : ''}>+ Image</button>
                <span class="todo-image-count-hint">${imageCount}/${MAX_TODO_IMAGES}</span>
                <div class="todo-controls">
                    <button class="edit-text-btn" data-id="${todo.id}" title="Edit text">Edit</button>
                    <select class="status-select" data-id="${todo.id}">
                        <option value="未开始" ${todo.status === '未开始' ? 'selected' : ''}>Not Started</option>
                        <option value="进行中" ${todo.status === '进行中' ? 'selected' : ''}>In Progress</option>
                        <option value="已完成" ${todo.status === '已完成' ? 'selected' : ''}>Done</option>
                        <option value="暂停" ${todo.status === '暂停' ? 'selected' : ''}>Paused</option>
                    </select>
                    <select class="priority-select-small" data-id="${todo.id}">
                        <option value="P0" ${todo.priority === 'P0' ? 'selected' : ''}>P0</option>
                        <option value="P1" ${todo.priority === 'P1' ? 'selected' : ''}>P1</option>
                        <option value="P2" ${todo.priority === 'P2' || !todo.priority ? 'selected' : ''}>P2</option>
                        <option value="P3" ${todo.priority === 'P3' ? 'selected' : ''}>P3</option>
                    </select>
                    <span class="eta-badge ${etaCompleted ? 'eta-tba' : eta.cssClass}" data-id="${todo.id}" title="Click to set date">${etaCompleted ? eta.text : eta.text}</span>
                    <input type="date" class="eta-input-hidden" data-id="${todo.id}" value="${todo.eta || ''}">
                </div>
            </div>
        </div>`;
    }).join('');

    // 统计
    const total = todos.length;
    const completed = todos.filter(t => t.status === '已完成').length;
    const inProgress = todos.filter(t => t.status === '进行中').length;
    const p0Count = todos.filter(t => t.priority === 'P0' && t.status !== '已完成').length;

    stats.innerHTML = `
        <span>Total: ${total}</span>
        <span>In Progress: ${inProgress}</span>
        <span>Done: ${completed}</span>
        ${p0Count > 0 ? `<span style="background:rgba(255,68,68,0.8)">Urgent: ${p0Count}</span>` : ''}
    `;

    setupDragAndDrop();
}

export async function addTodo() {
    const currentUser = getCurrentUser();
    if (!supabase || !currentUser) return;

    const { getPendingImageFile, clearPendingImage } = await import('./imageUpload.js');

    const input = document.getElementById('todoInput');
    const prioritySelect = document.getElementById('priorityInput');
    const etaInput = document.getElementById('etaInput');
    const text = input.value.trim();
    const priority = prioritySelect.value;
    const eta = etaInput.value || null;
    const btn = document.getElementById('addBtn');
    const pendingImageFile = getPendingImageFile();

    if (!text && !pendingImageFile) return;

    btn.disabled = true;

    const minOrder = todos.length > 0 ? Math.min(...todos.map(t => t.sort_order || 0)) - 1 : 0;

    try {
        let imageUrl = null;

        if (pendingImageFile) {
            const fileName = `${currentUser.id}/${Date.now()}.${pendingImageFile.name.split('.').pop() || 'png'}`;
            const { error: uploadError } = await supabase.storage
                .from('todo-images')
                .upload(fileName, pendingImageFile, { contentType: pendingImageFile.type, upsert: false });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
                .from('todo-images')
                .getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        const { error } = await supabase
            .from('todos')
            .insert([{
                text: text || 'Screenshot task',
                user_id: currentUser.id,
                priority,
                status: '未开始',
                sort_order: minOrder,
                image_url: imageUrl,
                eta,
                category: 'Others'
            }]);

        btn.disabled = false;

        if (error) {
            alert('Add failed: ' + error.message);
            return;
        }

        input.value = '';
        etaInput.value = '';
        clearPendingImage();
        loadTodos();
    } catch (e) {
        btn.disabled = false;
        alert('Add failed: ' + e.message);
    }
}

export async function updateTodoStatus(id, status) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('todos')
            .update({ status })
            .eq('id', id);

        if (error) {
            alert('Update failed: ' + error.message);
            return;
        }

        loadTodos();
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

export async function updateTodoPriority(id, priority) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('todos')
            .update({ priority })
            .eq('id', id);

        if (error) {
            alert('Update failed: ' + error.message);
            return;
        }

        loadTodos();
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

export async function deleteTodo(id) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Delete failed: ' + error.message);
            return;
        }

        loadTodos();
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

export async function updateTodoEta(id, eta) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('todos')
            .update({ eta: eta || null })
            .eq('id', id);

        if (error) {
            alert('Update failed: ' + error.message);
            return;
        }

        loadTodos();
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

export async function updateTodoCategory(id, category) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('todos')
            .update({ category })
            .eq('id', id);

        if (error) {
            alert('Update failed: ' + error.message);
            return;
        }

        loadTodos();
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

export async function updateTodoText(id, text) {
    if (!supabase) return;
    const nextText = (text || '').trim();
    if (!nextText) return;
    try {
        const { error } = await supabase
            .from('todos')
            .update({ text: nextText })
            .eq('id', id);
        if (error) {
            alert('Update failed: ' + error.message);
            return;
        }
        loadTodos();
    } catch (e) {
        alert('Update failed: ' + e.message);
    }
}

export async function addTodoImage(todoId, file) {
    const currentUser = getCurrentUser();
    if (!supabase || !currentUser || !file) return;
    const todo = getTodoById(todoId);
    if (!todo) return;
    const currentImages = getTodoImages(todo);
    if (currentImages.length >= MAX_TODO_IMAGES) {
        alert(`Max ${MAX_TODO_IMAGES} images per todo.`);
        return;
    }
    if (!todoImagesEnabled && todo.image_url) {
        alert('当前未启用多图表（todo_images），无法追加第2张及以上图片。请先在 Supabase 执行 todo_images.sql。');
        return;
    }
    try {
        const imageUrl = await uploadImageForTodo(file, currentUser.id);
        if (todoImagesEnabled) {
            const nextOrder = (todoImagesByTodoId[todoId] || []).length;
            const { error: insertError } = await supabase.from('todo_images').insert([{
                todo_id: todoId,
                user_id: currentUser.id,
                image_url: imageUrl,
                sort_order: nextOrder
            }]);
            if (insertError && isMissingRelationError(insertError)) {
                todoImagesEnabled = false;
            } else if (insertError) {
                throw insertError;
            }
        }
        if (!todoImagesEnabled && todo.image_url) {
            alert('检测到 todo_images 不可用，已保留现有图片。执行 todo_images.sql 后可继续追加到最多 10 张。');
            return;
        }
        if (!todoImagesEnabled || !todo.image_url) {
            const { error: legacyError } = await supabase.from('todos').update({ image_url: imageUrl }).eq('id', todoId);
            if (legacyError) throw legacyError;
        }
        loadTodos();
    } catch (e) {
        alert('Image add failed: ' + e.message);
    }
}

export async function replaceTodoImage(todoId, imageId, file) {
    const currentUser = getCurrentUser();
    if (!supabase || !currentUser || !file) return;
    const todo = getTodoById(todoId);
    if (!todo) return;
    const currentImages = getTodoImages(todo);
    if (currentImages.length > MAX_TODO_IMAGES) {
        alert(`Max ${MAX_TODO_IMAGES} images per todo.`);
        return;
    }
    try {
        const imageUrl = await uploadImageForTodo(file, currentUser.id);
        if (!todoImagesEnabled || (imageId || '').startsWith('legacy-')) {
            const { error } = await supabase.from('todos').update({ image_url: imageUrl }).eq('id', todoId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('todo_images').update({ image_url: imageUrl }).eq('id', imageId).eq('todo_id', todoId);
            if (error) throw error;
            if (todo.image_url === currentImages.find(image => image.id === imageId)?.image_url) {
                await supabase.from('todos').update({ image_url: imageUrl }).eq('id', todoId);
            }
        }
        loadTodos();
    } catch (e) {
        alert('Image replace failed: ' + e.message);
    }
}

export async function deleteTodoImage(todoId, imageId) {
    if (!supabase) return;
    const todo = getTodoById(todoId);
    if (!todo) return;
    try {
        if (!todoImagesEnabled || (imageId || '').startsWith('legacy-')) {
            const { error } = await supabase.from('todos').update({ image_url: null }).eq('id', todoId);
            if (error) throw error;
            loadTodos();
            return;
        }
        const { error } = await supabase.from('todo_images').delete().eq('id', imageId).eq('todo_id', todoId);
        if (error) throw error;
        await loadTodos();
        await syncLegacyImageFromTable(todoId);
        loadTodos();
    } catch (e) {
        alert('Image delete failed: ' + e.message);
    }
}

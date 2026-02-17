import { supabase } from './supabase.js';
import { getTodos, renderTodos } from './todos.js';

let draggedItem = null;
let touchDragEl = null;
let touchClone = null;
let touchOffsetY = 0;

export function setupDragAndDrop() {
    const items = document.querySelectorAll('.todo-item[draggable="true"]');

    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragleave', handleDragLeave);

        const handle = item.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('touchstart', handleTouchStart, { passive: false });
        }
    });
}

// Desktop drag
function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.todo-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (draggedItem === this) return;

    const draggedId = draggedItem.dataset.id;
    const targetId = this.dataset.id;

    await reorderTodos(draggedId, targetId);
}

// Touch drag
function handleTouchStart(e) {
    const item = this.closest('.todo-item');
    if (!item) return;

    e.preventDefault();
    touchDragEl = item;

    const rect = item.getBoundingClientRect();
    touchOffsetY = e.touches[0].clientY - rect.top;

    touchClone = item.cloneNode(true);
    touchClone.classList.add('touch-dragging');
    touchClone.style.position = 'fixed';
    touchClone.style.left = rect.left + 'px';
    touchClone.style.top = rect.top + 'px';
    touchClone.style.width = rect.width + 'px';
    touchClone.style.zIndex = '1000';
    touchClone.style.opacity = '0.85';
    touchClone.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.transition = 'none';
    document.body.appendChild(touchClone);

    item.classList.add('dragging');

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
}

function handleTouchMove(e) {
    if (!touchDragEl || !touchClone) return;
    e.preventDefault();

    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;

    touchClone.style.top = (touchY - touchOffsetY) + 'px';

    touchClone.style.display = 'none';
    const elementBelow = document.elementFromPoint(touchX, touchY);
    touchClone.style.display = '';

    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('drag-over'));

    if (elementBelow) {
        const targetItem = elementBelow.closest('.todo-item');
        if (targetItem && targetItem !== touchDragEl) {
            targetItem.classList.add('drag-over');
        }
    }
}

async function handleTouchEnd() {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);

    if (touchClone) {
        touchClone.remove();
        touchClone = null;
    }

    if (!touchDragEl) return;
    touchDragEl.classList.remove('dragging');

    const overItem = document.querySelector('.todo-item.drag-over');
    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('drag-over'));

    if (overItem && overItem !== touchDragEl) {
        await reorderTodos(touchDragEl.dataset.id, overItem.dataset.id);
    }

    touchDragEl = null;
}

// Shared reorder logic
async function reorderTodos(draggedId, targetId) {
    const todos = getTodos();
    const draggedIndex = todos.findIndex(t => t.id === draggedId);
    const targetIndex = todos.findIndex(t => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [removed] = todos.splice(draggedIndex, 1);
    todos.splice(targetIndex, 0, removed);

    const updates = todos.map((todo, index) => ({
        id: todo.id,
        sort_order: index
    }));

    renderTodos();

    for (const update of updates) {
        await supabase
            .from('todos')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id);
    }
}

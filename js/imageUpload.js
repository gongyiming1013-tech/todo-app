import { applyImageOverlayChanges, getMaxTodoImages, getTodoImagesForId, isTodoImagesEnabled } from './todos.js';

let pendingImageFile = null;
let overlayTodoId = null;
let overlayDraft = [];
let overlayDirty = false;

export function getPendingImageFile() {
    return pendingImageFile;
}

export function clearPendingImage() {
    pendingImageFile = null;
    document.getElementById('imagePreviewBar').style.display = 'none';
    document.getElementById('imageInput').value = '';
    document.getElementById('uploadLabel').classList.remove('has-image');
}

export function showImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imageModalImg');
    img.src = imageUrl;
    modal.classList.add('show');
}

function setOverlayDirty(isDirty) {
    overlayDirty = isDirty;
    const hint = document.getElementById('imageOverlayHint');
    const saveBtn = document.getElementById('imageOverlaySaveBtn');
    if (hint) hint.textContent = isDirty ? '未保存更改' : '已保存';
    if (saveBtn) saveBtn.disabled = !isDirty;
}

function disposeDraft() {
    overlayDraft.forEach(item => {
        if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
    overlayDraft = [];
}

function renderImageOverlay(images) {
    const list = document.getElementById('imageOverlayList');
    const mainImg = document.getElementById('imageOverlayMainImg');
    if (!list || !mainImg) return;
    if (!images.length) {
        list.innerHTML = '<div class="image-overlay-empty">暂无图片</div>';
        mainImg.src = '';
        return;
    }
    mainImg.src = images[0].image_url;
    list.innerHTML = images.map((image, index) => `
        <div class="image-overlay-item" data-index="${index}">
            <img src="${image.image_url}" alt="附件" class="image-overlay-thumb" data-index="${index}">
            <div class="image-overlay-actions">
                <button class="image-overlay-move" data-index="${index}" data-direction="up" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="image-overlay-move" data-index="${index}" data-direction="down" ${index === images.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="image-overlay-delete" data-index="${index}">删除</button>
            </div>
        </div>`).join('');
}

export function showImageOverlay(todoId) {
    overlayTodoId = todoId;
    disposeDraft();
    const images = getTodoImagesForId(todoId);
    overlayDraft = images.map(image => ({ ...image }));
    renderImageOverlay(overlayDraft);
    setOverlayDirty(false);
    const overlay = document.getElementById('imageOverlay');
    overlay?.classList.add('show');
}

export function closeImageModal() {
    document.getElementById('imageModal').classList.remove('show');
}

function closeImageOverlay() {
    overlayTodoId = null;
    disposeDraft();
    setOverlayDirty(false);
    document.getElementById('imageOverlay').classList.remove('show');
}

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

function refreshOverlay() {
    renderImageOverlay(overlayDraft);
}

export function setupImageUploadEvents() {
    document.getElementById('imageInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            pendingImageFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('uploadPreview').src = ev.target.result;
                document.getElementById('imagePreviewBar').style.display = 'flex';
                document.getElementById('uploadLabel').classList.add('has-image');
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('removeImageBtn').addEventListener('click', clearPendingImage);

    document.getElementById('imageModalClose').addEventListener('click', closeImageModal);
    document.getElementById('imageModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeImageModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageModal();
            closeImageOverlay();
        }
    });

    document.getElementById('imageOverlayClose').addEventListener('click', closeImageOverlay);
    document.getElementById('imageOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeImageOverlay();
    });
    document.getElementById('imageOverlayAddBtn').addEventListener('click', () => {
        if (!overlayTodoId) return;
        const maxImages = getMaxTodoImages();
        if (overlayDraft.length >= maxImages) {
            alert(`Max ${maxImages} images per todo.`);
            return;
        }
        if (!isTodoImagesEnabled() && overlayDraft.length > 0) {
            alert('当前未启用多图表（todo_images），无法追加第2张及以上图片。请先在 Supabase 执行 todo_images.sql。');
            return;
        }
        pickImageFile(async (file) => {
            const objectUrl = URL.createObjectURL(file);
            overlayDraft.push({
                id: null,
                image_url: objectUrl,
                is_new: true,
                file,
                objectUrl
            });
            setOverlayDirty(true);
            refreshOverlay();
        });
    });
    document.getElementById('imageOverlayList').addEventListener('click', async (e) => {
        const thumb = e.target.closest('.image-overlay-thumb');
        if (thumb?.dataset.index != null) {
            const index = parseInt(thumb.dataset.index, 10);
            const target = overlayDraft[index];
            if (target) document.getElementById('imageOverlayMainImg').src = target.image_url;
            return;
        }
        const moveBtn = e.target.closest('.image-overlay-move');
        if (moveBtn?.dataset.index != null && moveBtn?.dataset.direction) {
            const index = parseInt(moveBtn.dataset.index, 10);
            const nextIndex = moveBtn.dataset.direction === 'up' ? index - 1 : index + 1;
            if (nextIndex >= 0 && nextIndex < overlayDraft.length) {
                const moved = overlayDraft.splice(index, 1)[0];
                overlayDraft.splice(nextIndex, 0, moved);
                setOverlayDirty(true);
                refreshOverlay();
            }
            return;
        }
        const deleteBtn = e.target.closest('.image-overlay-delete');
        if (deleteBtn?.dataset.index != null) {
            const index = parseInt(deleteBtn.dataset.index, 10);
            const removed = overlayDraft.splice(index, 1)[0];
            if (removed?.objectUrl) URL.revokeObjectURL(removed.objectUrl);
            setOverlayDirty(true);
            refreshOverlay();
        }
    });
    document.getElementById('imageOverlaySaveBtn').addEventListener('click', async () => {
        if (!overlayTodoId || !overlayDirty) return;
        await applyImageOverlayChanges(overlayTodoId, overlayDraft);
        const images = getTodoImagesForId(overlayTodoId);
        disposeDraft();
        overlayDraft = images.map(image => ({ ...image }));
        renderImageOverlay(overlayDraft);
        setOverlayDirty(false);
    });

    // Expose to global for inline onclick handlers in todo items
    window.showImageModal = showImageModal;
    window.showImageOverlay = showImageOverlay;
}

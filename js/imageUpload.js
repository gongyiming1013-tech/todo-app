let pendingImageFile = null;

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

export function closeImageModal() {
    document.getElementById('imageModal').classList.remove('show');
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
        if (e.key === 'Escape') closeImageModal();
    });

    // Expose to global for inline onclick handlers in todo items
    window.showImageModal = showImageModal;
}

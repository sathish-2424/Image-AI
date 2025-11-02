class AdvancedAIImageGenerator {
    constructor() {
        this.apiKey = '';
        this.isGenerating = false;
        this.generatedImages = [];
        this.qualitySteps = 30;
        this.apiUrl = 'http://localhost:5000/api';
        
        this.initializeElements();
        this.bindEvents();
        this.initializeSettings();
    }

    initializeElements() {
        this.form = document.querySelector('.generate-form');
        this.promptInput = document.querySelector('.prompt-input');
        this.generateBtn = document.querySelector('.generate-btn');
        this.charCount = document.querySelector('.char-count');
        this.styleSelector = document.querySelector('.style-selector');
        this.sizeSelector = document.querySelector('.size-selector');
        this.galleryGrid = document.querySelector('.gallery-grid');
        this.clearGalleryBtn = document.querySelector('.clear-gallery');
        this.downloadAllBtn = document.querySelector('.download-all');
        this.settingsPanel = document.querySelector('.settings-panel');
        this.apiKeyInput = document.querySelector('#api-key-input');
        this.saveKeyBtn = document.querySelector('#save-key');
        this.qualitySelector = document.querySelector('#quality-selector');
        this.closeSettingsBtn = document.querySelector('.close-settings');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleGeneration(e));
        this.promptInput.addEventListener('input', () => this.updateCharCount());
        this.clearGalleryBtn.addEventListener('click', () => this.clearGallery());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
        this.saveKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.closeSettingsBtn.addEventListener('click', () => {
            this.settingsPanel.classList.remove('active');
        });
        
        this.qualitySelector.addEventListener('change', (e) => {
            this.qualitySteps = parseInt(e.target.value);
        });

        document.querySelectorAll('.prompt-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.promptInput.value = e.target.dataset.prompt;
                this.updateCharCount();
            });
        });

        document.querySelector('a[href="#settings"]').addEventListener('click', (e) => {
            e.preventDefault();
            this.settingsPanel.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (this.settingsPanel.classList.contains('active') && 
                !this.settingsPanel.contains(e.target) && 
                !e.target.closest('a[href="#settings"]')) {
                this.settingsPanel.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleGeneration(e);
            }
            if (e.key === 'Escape' && this.settingsPanel.classList.contains('active')) {
                this.settingsPanel.classList.remove('active');
            }
        });
    }

    initializeSettings() {
        this.qualitySelector.value = this.qualitySteps.toString();
    }

    updateCharCount() {
        const length = this.promptInput.value.length;
        this.charCount.textContent = `${length}/500`;
        this.charCount.style.color = length > 450 ? 'var(--warning-color)' : 'var(--text-secondary)';
    }

    async handleGeneration(e) {
        e.preventDefault();
        if (this.isGenerating) return;

        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            this.showError('Please enter a description for your image.');
            return;
        }

        if (!this.apiKey) {
            this.showError('Please add your Hugging Face API key in settings.');
            this.settingsPanel.classList.add('active');
            return;
        }

        this.setLoadingState(true);
        this.createLoadingCard();

        try {
            const response = await fetch(`${this.apiUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    apiKey: this.apiKey,
                    style: this.styleSelector.value,
                    size: this.sizeSelector.value,
                    qualitySteps: this.qualitySteps
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Generation failed');
            }

            const imageData = {
                id: data.id,
                url: data.image,
                prompt: prompt,
                style: this.styleSelector.value,
                size: this.sizeSelector.value,
                timestamp: new Date().toISOString()
            };

            this.addImageToGallery(imageData);
            this.showSuccess('Image generated successfully!');

        } catch (error) {
            this.showError(error.message || 'An error occurred during generation');
            const loadingCard = document.querySelector('.img-card.loading');
            if (loadingCard) loadingCard.remove();
        } finally {
            this.setLoadingState(false);
        }
    }

    createLoadingCard() {
        const emptyState = document.querySelector('.gallery-empty');
        if (emptyState) emptyState.remove();

        const loadingCard = document.createElement('div');
        loadingCard.className = 'img-card loading';
        loadingCard.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-magic" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                <p>Generating your masterpiece...</p>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        `;
        this.galleryGrid.insertBefore(loadingCard, this.galleryGrid.firstChild);
    }

    addImageToGallery(imageData) {
        const loadingCard = document.querySelector('.img-card.loading');
        if (loadingCard) {
            loadingCard.remove();
        }

        const card = document.createElement('div');
        card.className = 'img-card';
        card.innerHTML = `
            <img src="${imageData.url}" alt="AI Generated: ${imageData.prompt}">
            <div class="card-overlay">
                <p class="card-prompt">${imageData.prompt}</p>
                <div class="card-actions">
                    <button class="action-btn download-btn" title="Download" aria-label="Download image">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn copy-btn" title="Copy Prompt" aria-label="Copy prompt">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete" aria-label="Delete image">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        card.querySelector('.download-btn').addEventListener('click', () => {
            this.downloadImage(imageData.url, `ai-image-${imageData.id}.png`);
        });
        card.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(imageData.prompt);
            this.showSuccess('Prompt copied to clipboard!');
        });
        card.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteImage(imageData.id, card);
        });

        this.galleryGrid.insertBefore(card, this.galleryGrid.firstChild);
        this.generatedImages.unshift(imageData);
    }

    downloadImage(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    deleteImage(id, cardElement) {
        this.generatedImages = this.generatedImages.filter(img => img.id !== id);
        cardElement.remove();
        this.showSuccess('Image deleted successfully!');
        
        if (this.generatedImages.length === 0) {
            this.showEmptyState();
        }
    }

    clearGallery() {
        this.generatedImages = [];
        this.galleryGrid.innerHTML = '';
        this.showEmptyState();
        this.showSuccess('Gallery cleared successfully!');
    }

    showEmptyState() {
        this.galleryGrid.innerHTML = `
            <div class="gallery-empty">
                <i class="fas fa-images"></i>
                <h3>No images yet</h3>
                <p>Generate your first AI image to get started!</p>
            </div>
        `;
    }

    downloadAll() {
        if (this.generatedImages.length === 0) {
            this.showError('No images to download!');
            return;
        }
        
        this.generatedImages.forEach((imageData, index) => {
            setTimeout(() => {
                this.downloadImage(imageData.url, `ai-image-${imageData.id}.png`);
            }, index * 100);
        });
        
        this.showSuccess(`Downloading ${this.generatedImages.length} images...`);
    }

    async saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (!key) {
            this.showError('Please enter a valid API key!');
            return;
        }

        this.saveKeyBtn.disabled = true;
        this.saveKeyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';

        try {
            const response = await fetch(`${this.apiUrl}/validate-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key })
            });

            const data = await response.json();
            
            if (data.valid) {
                this.apiKey = key;
                this.apiKeyInput.value = ''; // Clear input for security
                this.showSuccess('✓ API key saved successfully!');
                setTimeout(() => {
                    this.settingsPanel.classList.remove('active');
                }, 500);
            } else {
                this.showError('✗ Invalid API key: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError('Error validating API key: ' + error.message);
        } finally {
            this.saveKeyBtn.disabled = false;
            this.saveKeyBtn.innerHTML = 'Save';
        }
    }

    setLoadingState(isLoading) {
        this.isGenerating = isLoading;
        this.generateBtn.disabled = isLoading;
        this.generateBtn.innerHTML = isLoading ? 
            '<i class="fas fa-spinner fa-spin"></i> Generating...' : 
            '<i class="fas fa-wand-magic-sparkles"></i> Generate';
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdvancedAIImageGenerator();
});
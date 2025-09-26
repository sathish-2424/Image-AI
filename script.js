class AdvancedAIImageGenerator {
    constructor() {
        this.apiKey = localStorage.getItem('huggingface_api_key') || '';
        this.isGenerating = false;
        this.generatedImages = JSON.parse(localStorage.getItem('generated_images') || '[]');
        this.currentModel = 'runwayml/stable-diffusion-v1-5';
        this.qualitySteps = 30;
        
        this.initializeElements();
        this.bindEvents();
        this.loadGallery();
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
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleGeneration(e));
        this.promptInput.addEventListener('input', () => this.updateCharCount());
        this.clearGalleryBtn.addEventListener('click', () => this.clearGallery());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
        this.saveKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.qualitySelector.addEventListener('change', (e) => {
            this.qualitySteps = parseInt(e.target.value);
        });

        // Quick prompt buttons
        document.querySelectorAll('.prompt-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.promptInput.value = e.target.dataset.prompt;
                this.updateCharCount();
            });
        });

        // Settings panel toggle
        document.querySelector('a[href="#settings"]').addEventListener('click', (e) => {
            e.preventDefault();
            this.settingsPanel.classList.toggle('active');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleGeneration(e);
            }
        });
    }

    initializeSettings() {
        if (this.apiKey) {
            this.apiKeyInput.value = this.apiKey;
        }
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
            const enhancedPrompt = this.enhancePrompt(prompt);
            const imageBlob = await this.generateImage(enhancedPrompt);
            const imageUrl = URL.createObjectURL(imageBlob);
            
            const imageData = {
                id: Date.now(),
                url: imageUrl,
                prompt: prompt,
                enhancedPrompt: enhancedPrompt,
                style: this.styleSelector.value,
                size: this.sizeSelector.value,
                timestamp: new Date().toISOString()
            };

            this.addImageToGallery(imageData);
            this.saveImageData(imageData);
            this.showSuccess('Image generated successfully!');

        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    }

    enhancePrompt(prompt) {
        const style = this.styleSelector.value;
        const styleEnhancements = {
            realistic: ', photorealistic, high detail, professional photography',
            artistic: ', artistic, painterly, fine art, masterpiece',
            cartoon: ', cartoon style, animated, colorful, fun',
            cyberpunk: ', cyberpunk, neon lights, futuristic, high tech',
            vintage: ', vintage style, retro, classic, nostalgic'
        };

        return prompt + (styleEnhancements[style] || '') + ', high quality, detailed';
    }

    async generateImage(prompt) {
        const models = [
            'runwayml/stable-diffusion-v1-5',
            'stabilityai/stable-diffusion-xl-base-1.0',
            'CompVis/stable-diffusion-v1-4'
        ];

        for (let i = 0; i < models.length; i++) {
            try {
                const response = await fetch(`https://api-inference.huggingface.co/models/${models[i]}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: {
                            num_inference_steps: this.qualitySteps,
                            guidance_scale: 7.5,
                            width: parseInt(this.sizeSelector.value.split('x')[0]),
                            height: parseInt(this.sizeSelector.value.split('x')[1])
                        }
                    }),
                });

                if (response.ok) {
                    return await response.blob();
                }

                if (response.status === 503 && i < models.length - 1) {
                    continue; // Try next model
                }

                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);

            } catch (error) {
                if (i === models.length - 1) {
                    throw error;
                }
            }
        }
    }

    createLoadingCard() {
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
        
        // Animate progress bar
        const progressFill = loadingCard.querySelector('.progress-fill');
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
            }
            progressFill.style.width = `${progress}%`;
        }, 500);
    }

    addImageToGallery(imageData) {
        // Remove loading card
        const loadingCard = document.querySelector('.img-card.loading');
        if (loadingCard) {
            loadingCard.remove();
        }

        const card = document.createElement('div');
        card.className = 'img-card';
        card.innerHTML = `
            <img src="${imageData.url}" alt="Generated: ${imageData.prompt}">
            <div class="card-overlay">
                <p class="card-prompt">${imageData.prompt}</p>
                <div class="card-actions">
                    <button class="action-btn download-btn" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn copy-btn" title="Copy Prompt">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        card.querySelector('.download-btn').addEventListener('click', () => {
            this.downloadImage(imageData.url, `ai-image-${imageData.id}.jpg`);
        });

        card.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(imageData.prompt);
            this.showSuccess('Prompt copied to clipboard!');
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteImage(imageData.id, card);
        });

        this.galleryGrid.insertBefore(card, this.galleryGrid.firstChild);
    }

    saveImageData(imageData) {
        this.generatedImages.unshift(imageData);
        localStorage.setItem('generated_images', JSON.stringify(this.generatedImages));
    }

    loadGallery() {
        this.generatedImages.forEach(imageData => {
            this.addImageToGallery(imageData);
        });
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
        if (confirm('Are you sure you want to delete this image?')) {
            this.generatedImages = this.generatedImages.filter(img => img.id !== id);
            localStorage.setItem('generated_images', JSON.stringify(this.generatedImages));
            cardElement.remove();
            this.showSuccess('Image deleted successfully!');
        }
    }

    clearGallery() {
        if (confirm('Are you sure you want to clear all generated images?')) {
            this.generatedImages = [];
            localStorage.removeItem('generated_images');
            this.galleryGrid.innerHTML = '';
            this.showSuccess('Gallery cleared successfully!');
        }
    }

    downloadAll() {
        this.generatedImages.forEach((imageData, index) => {
            setTimeout(() => {
                this.downloadImage(imageData.url, `ai-image-${index + 1}.jpg`);
            }, index * 100);
        });
    }

    saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (key) {
            this.apiKey = key;
            localStorage.setItem('huggingface_api_key', key);
            this.showSuccess('API key saved successfully!');
            this.settingsPanel.classList.remove('active');
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
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedAIImageGenerator();
});
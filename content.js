// Content Script für die Übersetzung von Webseiten
class WebPageTranslator {
    constructor() {
        this.translationService = null;
        this.originalTexts = new Map();
        this.isTranslated = false;
        this.currentSourceLang = 'auto';
        this.currentTargetLang = 'de';

        this.init();
    }

    async init() {
        // Lade Einstellungen
        const settings = await chrome.storage.sync.get(['serviceUrl', 'apiKey', 'targetLang']);
        this.translationService = settings.serviceUrl || 'https://translate.mac/translate';
        this.apiKey = settings.apiKey || '';
        this.currentTargetLang = settings.targetLang || 'de';

        // Erstelle UI-Elemente
        this.createTranslationUI();

        // Höre auf Nachrichten vom Popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Für asynchrone Antworten
        });
    }

    createTranslationUI() {
        // Floating Button erstellen
        const floatingBtn = document.createElement('div');
        floatingBtn.id = 'translate-floating-btn';
        floatingBtn.innerHTML = '🌐';
        floatingBtn.title = 'Seite übersetzen';

        floatingBtn.addEventListener('click', () => {
            this.toggleTranslation();
        });

        document.body.appendChild(floatingBtn);

        // Progress Bar
        const progressBar = document.createElement('div');
        progressBar.id = 'translate-progress';
        progressBar.innerHTML = '<div class="progress-fill"></div><span class="progress-text">Übersetze...</span>';
        document.body.appendChild(progressBar);
    }

    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'translatePage':
                const result = await this.translatePage(request.sourceLang, request.targetLang);
                sendResponse(result);
                break;

            case 'restorePage':
                this.restoreOriginalTexts();
                sendResponse({ success: true });
                break;

            case 'getPageInfo':
                sendResponse({
                    isTranslated: this.isTranslated,
                    sourceLang: this.currentSourceLang,
                    targetLang: this.currentTargetLang,
                    textNodes: this.countTranslatableNodes()
                });
                break;
        }
    }

    async toggleTranslation() {
        if (this.isTranslated) {
            this.restoreOriginalTexts();
        } else {
            await this.translatePage('auto', this.currentTargetLang);
        }
    }

    async translatePage(sourceLang = 'auto', targetLang = 'de') {
        try {
            this.showProgress(true);

            // Finde alle übersetzbare Textknoten
            const textNodes = this.findTranslatableTextNodes();

            if (textNodes.length === 0) {
                throw new Error('Keine übersetzbare Texte gefunden');
            }

            let translated = 0;
            const total = textNodes.length;

            // Übersetze in Batches für bessere Performance
            const batchSize = 5;
            for (let i = 0; i < textNodes.length; i += batchSize) {
                const batch = textNodes.slice(i, i + batchSize);

                await Promise.all(batch.map(async (node) => {
                    try {
                        const originalText = node.textContent.trim();

                        if (originalText.length > 0 && !this.isOnlySpecialChars(originalText)) {
                            // Speichere Originaltext
                            this.originalTexts.set(node, originalText);

                            // Übersetze
                            const translatedText = await this.translateText(originalText, sourceLang, targetLang);

                            if (translatedText && translatedText !== originalText) {
                                node.textContent = translatedText;
                            }
                        }

                        translated++;
                        this.updateProgress(translated, total);

                    } catch (error) {
                        console.warn('Fehler beim Übersetzen eines Textblocks:', error);
                    }
                }));

                // Kleine Pause zwischen Batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.isTranslated = true;
            this.currentSourceLang = sourceLang;
            this.currentTargetLang = targetLang;

            this.showProgress(false);
            this.showNotification('Übersetzung abgeschlossen!', 'success');

            return { success: true, translated: translated };

        } catch (error) {
            this.showProgress(false);
            this.showNotification(`Fehler: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async translateText(text, sourceLang, targetLang) {
        try {
            const response = await fetch(this.translationService, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang,
                    format: 'text',
                    alternatives: 1,
                    api_key: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result.translatedText || text;

        } catch (error) {
            console.error('Übersetzungsfehler:', error);
            throw error;
        }
    }

    findTranslatableTextNodes() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Überspringe bestimmte Elemente
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tagName = parent.tagName.toLowerCase();
                    const excludedTags = ['script', 'style', 'code', 'pre', 'noscript', 'textarea'];

                    if (excludedTags.includes(tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Überspringe unsere eigenen UI-Elemente
                    if (parent.id && parent.id.startsWith('translate-')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Nur Texte mit substanziellem Inhalt
                    const text = node.textContent.trim();
                    if (text.length < 3 || this.isOnlySpecialChars(text)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            nodes.push(node);
        }

        return nodes;
    }

    isOnlySpecialChars(text) {
        return /^[\s\W]*$/.test(text);
    }

    restoreOriginalTexts() {
        this.originalTexts.forEach((originalText, node) => {
            if (node.parentNode) {
                node.textContent = originalText;
            }
        });

        this.originalTexts.clear();
        this.isTranslated = false;
        this.showNotification('Originaltexte wiederhergestellt', 'info');
    }

    countTranslatableNodes() {
        return this.findTranslatableTextNodes().length;
    }

    showProgress(show) {
        const progressBar = document.getElementById('translate-progress');
        if (progressBar) {
            progressBar.style.display = show ? 'block' : 'none';
            if (show) {
                this.updateProgress(0, 1);
            }
        }
    }

    updateProgress(current, total) {
        const progressBar = document.getElementById('translate-progress');
        if (progressBar) {
            const percentage = Math.round((current / total) * 100);
            const fill = progressBar.querySelector('.progress-fill');
            const text = progressBar.querySelector('.progress-text');

            if (fill) fill.style.width = `${percentage}%`;
            if (text) text.textContent = `Übersetze ${current}/${total} (${percentage}%)`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `translate-notification translate-${type}`;
        notification.textContent = message;

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

// Initialisiere den Translator
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WebPageTranslator();
    });
} else {
    new WebPageTranslator();
}
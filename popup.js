// Popup Script für die Translation Extension
class TranslatorPopup {
    constructor() {
        this.init();
    }

    async init() {
        // Lade gespeicherte Einstellungen
        await this.loadSettings();

        // Event Listeners
        this.setupEventListeners();

        // Lade Seiteninformationen
        await this.loadPageInfo();
    }

    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get(['targetLang', 'sourceLang']);

            const sourceLang = document.getElementById('sourceLang');
            const targetLang = document.getElementById('targetLang');

            if (settings.sourceLang) {
                sourceLang.value = settings.sourceLang;
            }

            if (settings.targetLang) {
                targetLang.value = settings.targetLang;
            }
        } catch (error) {
            console.error('Fehler beim Laden der Einstellungen:', error);
        }
    }

    setupEventListeners() {
        const translateBtn = document.getElementById('translateBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        const openSettings = document.getElementById('openSettings');
        const sourceLang = document.getElementById('sourceLang');
        const targetLang = document.getElementById('targetLang');

        translateBtn.addEventListener('click', () => this.translatePage());
        restoreBtn.addEventListener('click', () => this.restorePage());
        openSettings.addEventListener('click', () => this.openOptionsPage());

        // Speichere Sprachauswahl
        sourceLang.addEventListener('change', () => this.saveLanguageSettings());
        targetLang.addEventListener('change', () => this.saveLanguageSettings());
    }

    async saveLanguageSettings() {
        const sourceLang = document.getElementById('sourceLang').value;
        const targetLang = document.getElementById('targetLang').value;

        try {
            await chrome.storage.sync.set({
                sourceLang: sourceLang,
                targetLang: targetLang
            });
        } catch (error) {
            console.error('Fehler beim Speichern der Sprachen:', error);
        }
    }

    async loadPageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getPageInfo'
            });

            if (response) {
                this.updatePageInfo(response);
                this.updateButtonStates(response.isTranslated);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Seiteninformationen:', error);
            this.showStatus('Fehler beim Laden der Seiteninformationen', 'error');
        }
    }

    updatePageInfo(info) {
        const pageInfo = document.getElementById('pageInfo');

        if (info.textNodes > 0) {
            pageInfo.innerHTML = `
        <strong>Seiteninformationen:</strong><br>
        📄 ${info.textNodes} übersetzbare Textblöcke<br>
        ${info.isTranslated ? '✅ Übersetzt (' + info.sourceLang + ' → ' + info.targetLang + ')' : '⏳ Nicht übersetzt'}
      `;
            pageInfo.style.display = 'block';
        } else {
            pageInfo.innerHTML = '<strong>⚠️ Keine übersetzbare Texte gefunden</strong>';
            pageInfo.style.display = 'block';
        }
    }

    updateButtonStates(isTranslated) {
        const translateBtn = document.getElementById('translateBtn');
        const restoreBtn = document.getElementById('restoreBtn');

        translateBtn.textContent = isTranslated ? 'Neu übersetzen' : 'Übersetzen';
        restoreBtn.disabled = !isTranslated;
    }

    async translatePage() {
        const sourceLang = document.getElementById('sourceLang').value;
        const targetLang = document.getElementById('targetLang').value;

        if (sourceLang === targetLang && sourceLang !== 'auto') {
            this.showStatus('Quell- und Zielsprache sind identisch', 'error');
            return;
        }

        try {
            this.setButtonsEnabled(false);
            this.showStatus('Übersetze Seite...', 'info');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'translatePage',
                sourceLang: sourceLang,
                targetLang: targetLang
            });

            if (response && response.success) {
                this.showStatus(`Erfolgreich ${response.translated} Textblöcke übersetzt!`, 'success');
                this.updateButtonStates(true);

                // Aktualisiere Seiteninformationen
                setTimeout(() => this.loadPageInfo(), 1000);
            } else {
                this.showStatus(response?.error || 'Unbekannter Fehler', 'error');
            }
        } catch (error) {
            console.error('Übersetzungsfehler:', error);
            this.showStatus('Fehler beim Übersetzen: ' + error.message, 'error');
        } finally {
            this.setButtonsEnabled(true);
        }
    }

    async restorePage() {
        try {
            this.setButtonsEnabled(false);
            this.showStatus('Stelle Originaltexte wieder her...', 'info');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'restorePage'
            });

            if (response && response.success) {
                this.showStatus('Originaltexte wiederhergestellt', 'success');
                this.updateButtonStates(false);

                // Aktualisiere Seiteninformationen
                setTimeout(() => this.loadPageInfo(), 500);
            } else {
                this.showStatus('Fehler beim Wiederherstellen', 'error');
            }
        } catch (error) {
            console.error('Wiederherstellungsfehler:', error);
            this.showStatus('Fehler beim Wiederherstellen: ' + error.message, 'error');
        } finally {
            this.setButtonsEnabled(true);
        }
    }

    setButtonsEnabled(enabled) {
        document.getElementById('translateBtn').disabled = !enabled;
        document.getElementById('restoreBtn').disabled = !enabled;
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }

    openOptionsPage() {
        chrome.runtime.openOptionsPage();
    }
}

// Initialisiere Popup
document.addEventListener('DOMContentLoaded', () => {
    new TranslatorPopup();
});
// Options Script für die Translation Extension
class TranslatorOptions {
    constructor() {
        this.defaultSettings = {
            serviceUrl: 'https://translate.mac/translate',
            apiKey: '',
            defaultSourceLang: 'auto',
            defaultTargetLang: 'de',
            batchSize: 5,
            excludedDomains: '',
            hotkey: 'Ctrl+Shift+T'
        };

        this.init();
    }

    async init() {
        // Lade gespeicherte Einstellungen
        await this.loadSettings();

        // Setup Event Listeners
        this.setupEventListeners();

        // Teste Verbindung beim Start
        this.testConnection();
    }

    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get(this.defaultSettings);

            // Fülle Formularfelder
            document.getElementById('serviceUrl').value = settings.serviceUrl || this.defaultSettings.serviceUrl;
            document.getElementById('apiKey').value = settings.apiKey || '';
            document.getElementById('defaultSourceLang').value = settings.defaultSourceLang || this.defaultSettings.defaultSourceLang;
            document.getElementById('defaultTargetLang').value = settings.defaultTargetLang || this.defaultSettings.defaultTargetLang;
            document.getElementById('batchSize').value = settings.batchSize || this.defaultSettings.batchSize;
            document.getElementById('excludedDomains').value = settings.excludedDomains || '';
            document.getElementById('hotkey').value = settings.hotkey || this.defaultSettings.hotkey;

        } catch (error) {
            console.error('Fehler beim Laden der Einstellungen:', error);
            this.showStatus('Fehler beim Laden der Einstellungen', 'error');
        }
    }

    setupEventListeners() {
        // Speichern-Button
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // Zurücksetzen-Button
        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });

        // Verbindung testen
        document.getElementById('testConnection').addEventListener('click', () => {
            this.testConnection();
        });

        // Tastenkürzel konfigurieren
        document.getElementById('openShortcuts').addEventListener('click', () => {
            this.openShortcutsPage();
        });

        // Auto-Test bei URL-Änderung
        document.getElementById('serviceUrl').addEventListener('blur', () => {
            this.testConnection();
        });

        // Eingabevalidierung
        document.getElementById('batchSize').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < 1) e.target.value = 1;
            if (value > 20) e.target.value = 20;
        });
    }

    async saveSettings() {
        try {
            const settings = {
                serviceUrl: document.getElementById('serviceUrl').value.trim(),
                apiKey: document.getElementById('apiKey').value.trim(),
                defaultSourceLang: document.getElementById('defaultSourceLang').value,
                defaultTargetLang: document.getElementById('defaultTargetLang').value,
                batchSize: parseInt(document.getElementById('batchSize').value),
                excludedDomains: document.getElementById('excludedDomains').value.trim(),
                hotkey: document.getElementById('hotkey').value.trim()
            };

            // Validierung
            if (!settings.serviceUrl) {
                throw new Error('Service URL ist erforderlich');
            }

            if (!this.isValidUrl(settings.serviceUrl)) {
                throw new Error('Service URL ist ungültig');
            }

            if (settings.batchSize < 1 || settings.batchSize > 20) {
                throw new Error('Batch-Größe muss zwischen 1 und 20 liegen');
            }

            // Speichern
            await chrome.storage.sync.set(settings);

            // Auch lokale Einstellungen für andere Teile der Extension speichern
            await chrome.storage.sync.set({
                sourceLang: settings.defaultSourceLang,
                targetLang: settings.defaultTargetLang
            });

            this.showStatus('Einstellungen erfolgreich gespeichert', 'success');

            // Teste Verbindung nach dem Speichern
            setTimeout(() => this.testConnection(), 500);

        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            this.showStatus('Fehler beim Speichern: ' + error.message, 'error');
        }
    }

    async resetSettings() {
        if (confirm('Alle Einstellungen zurücksetzen? Dies kann nicht rückgängig gemacht werden.')) {
            try {
                // Lösche alle gespeicherten Einstellungen
                await chrome.storage.sync.clear();

                // Lade Standardeinstellungen
                await this.loadSettings();

                this.showStatus('Einstellungen zurückgesetzt', 'success');

                // Teste Verbindung
                setTimeout(() => this.testConnection(), 500);

            } catch (error) {
                console.error('Fehler beim Zurücksetzen:', error);
                this.showStatus('Fehler beim Zurücksetzen: ' + error.message, 'error');
            }
        }
    }

    async testConnection() {
        const serviceUrl = document.getElementById('serviceUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();
        const testButton = document.getElementById('testConnection');
        const testResult = document.getElementById('testResult');
        const connectionStatus = document.getElementById('connectionStatus');

        if (!serviceUrl) {
            this.updateConnectionStatus('error', 'Keine Service URL angegeben');
            return;
        }

        if (!this.isValidUrl(serviceUrl)) {
            this.updateConnectionStatus('error', 'Ungültige Service URL');
            return;
        }

        try {
            testButton.disabled = true;
            testButton.textContent = 'Teste...';
            testResult.style.display = 'none';
            this.updateConnectionStatus('unknown', 'Teste Verbindung...');

            const testText = 'Hello World';
            const startTime = Date.now();

            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: testText,
                    source: 'en',
                    target: 'de',
                    format: 'text',
                    alternatives: 1,
                    api_key: apiKey
                }),
                signal: AbortSignal.timeout(10000) // 10 Sekunden Timeout
            });

            const endTime = Date.now();
            const duration = endTime - startTime;

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.translatedText) {
                this.updateConnectionStatus('success', 'Verbindung erfolgreich');
                testResult.textContent = `✅ Verbindung erfolgreich!\n\nAntwortzeit: ${duration}ms\nTest-Übersetzung: "${testText}" → "${result.translatedText}"\n\nVollständige Antwort:\n${JSON.stringify(result, null, 2)}`;
                testResult.style.display = 'block';
                testResult.style.background = '#d4edda';
                testResult.style.color = '#155724';
                testResult.style.border = '1px solid #c3e6cb';
            } else {
                throw new Error('Keine Übersetzung in der Antwort gefunden');
            }

        } catch (error) {
            console.error('Verbindungstest fehlgeschlagen:', error);
            this.updateConnectionStatus('error', 'Verbindung fehlgeschlagen');

            let errorMessage = `❌ Verbindungstest fehlgeschlagen!\n\nFehler: ${error.message}\n\n`;

            if (error.name === 'AbortError') {
                errorMessage += 'Timeout: Der Service hat nicht innerhalb von 10 Sekunden geantwortet.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage += 'Mögliche Ursachen:\n- Service ist nicht erreichbar\n- CORS-Probleme\n- Netzwerkfehler\n- Falsche URL';
            } else if (error.message.includes('HTTP')) {
                errorMessage += 'HTTP-Fehler: Überprüfe die Service-URL und API-Konfiguration.';
            }

            testResult.textContent = errorMessage;
            testResult.style.display = 'block';
            testResult.style.background = '#f8d7da';
            testResult.style.color = '#721c24';
            testResult.style.border = '1px solid #f5c6cb';
        } finally {
            testButton.disabled = false;
            testButton.textContent = 'Verbindung testen';
        }
    }

    updateConnectionStatus(status, message) {
        const connectionStatus = document.getElementById('connectionStatus');
        connectionStatus.className = `connection-status ${status}`;
        connectionStatus.title = message;
    }

    openShortcutsPage() {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialisiere Options
document.addEventListener('DOMContentLoaded', () => {
    new TranslatorOptions();
});
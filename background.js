// Background Script (Service Worker) für die Translation Extension
class TranslatorBackground {
    constructor() {
        this.init();
    }

    init() {
        // Installationshandler
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });

        // Startup-Handler
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Nachrichten von Content Scripts und Popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Für asynchrone Antworten
        });

        // Kontext-Menü
        this.setupContextMenu();

        // Tastenkürzel
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });

        // Tab-Updates (für ausgeschlossene Domains)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });
    }

    async handleInstall(details) {
        if (details.reason === 'install') {
            // Erste Installation
            console.log('Extension installiert');

            // Setze Standardeinstellungen
            await this.setDefaultSettings();

            // Öffne Optionsseite
            chrome.runtime.openOptionsPage();

        } else if (details.reason === 'update') {
            // Update
            console.log('Extension aktualisiert von', details.previousVersion);

            // Migriere Einstellungen falls nötig
            await this.migrateSettings(details.previousVersion);
        }
    }

    async handleStartup() {
        console.log('Extension gestartet');

        // Prüfe Einstellungen
        await this.validateSettings();
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getSettings':
                    const settings = await chrome.storage.sync.get();
                    sendResponse({ success: true, settings });
                    break;

                case 'translateText':
                    const result = await this.translateText(request.text, request.source, request.target);
                    sendResponse(result);
                    break;

                case 'checkDomain':
                    const isExcluded = await this.isDomainExcluded(request.domain);
                    sendResponse({ excluded: isExcluded });
                    break;

                case 'openOptions':
                    chrome.runtime.openOptionsPage();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unbekannte Aktion' });
            }
        } catch (error) {
            console.error('Fehler im Background Script:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async setupContextMenu() {
        // Entferne existierende Menüs
        await chrome.contextMenus.removeAll();

        // Hauptmenü
        chrome.contextMenus.create({
            id: 'translatePage',
            title: 'Seite übersetzen',
            contexts: ['page']
        });

        // Textauswahl-Menü
        chrome.contextMenus.create({
            id: 'translateSelection',
            title: 'Auswahl übersetzen',
            contexts: ['selection']
        });

        // Separator
        chrome.contextMenus.create({
            id: 'separator1',
            type: 'separator',
            contexts: ['page', 'selection']
        });

        // Optionen
        chrome.contextMenus.create({
            id: 'openOptions',
            title: 'Einstellungen',
            contexts: ['page']
        });

        // Menü-Klick-Handler
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async handleContextMenuClick(info, tab) {
        try {
            switch (info.menuItemId) {
                case 'translatePage':
                    await this.translateCurrentPage(tab);
                    break;

                case 'translateSelection':
                    await this.translateSelection(info.selectionText, tab);
                    break;

                case 'openOptions':
                    chrome.runtime.openOptionsPage();
                    break;
            }
        } catch (error) {
            console.error('Kontextmenü-Fehler:', error);
        }
    }

    async handleCommand(command) {
        try {
            switch (command) {
                case 'translate-page':
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    await this.translateCurrentPage(tab);
                    break;

                case 'toggle-translation':
                    await this.toggleTranslation();
                    break;
            }
        } catch (error) {
            console.error('Tastenkürzel-Fehler:', error);
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            try {
                const domain = new URL(tab.url).hostname;
                const isExcluded = await this.isDomainExcluded(domain);

                if (isExcluded) {
                    // Deaktiviere Extension auf dieser Domain
                    await chrome.action.disable(tabId);
                } else {
                    // Aktiviere Extension
                    await chrome.action.enable(tabId);
                }
            } catch (error) {
                console.error('Tab-Update-Fehler:', error);
            }
        }
    }

    async translateCurrentPage(tab) {
        try {
            const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'translatePage',
                sourceLang: settings.sourceLang || 'auto',
                targetLang: settings.targetLang || 'de'
            });

            if (response && response.success) {
                this.showNotification('Seite erfolgreich übersetzt', 'success');
            } else {
                this.showNotification('Fehler beim Übersetzen der Seite', 'error');
            }
        } catch (error) {
            console.error('Fehler beim Übersetzen der Seite:', error);
            this.showNotification('Fehler beim Übersetzen der Seite', 'error');
        }
    }

    async translateSelection(text, tab) {
        try {
            const settings = await chrome.storage.sync.get(['serviceUrl', 'apiKey', 'sourceLang', 'targetLang']);

            const result = await this.translateText(
                text,
                settings.sourceLang || 'auto',
                settings.targetLang || 'de'
            );

            if (result.success) {
                // Zeige Übersetzung in einer Benachrichtigung
                this.showNotification(`"${text}" → "${result.translatedText}"`, 'success');
            } else {
                this.showNotification('Fehler beim Übersetzen der Auswahl', 'error');
            }
        } catch (error) {
            console.error('Fehler beim Übersetzen der Auswahl:', error);
            this.showNotification('Fehler beim Übersetzen der Auswahl', 'error');
        }
    }

    async toggleTranslation() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getPageInfo'
            });

            if (response && response.isTranslated) {
                await chrome.tabs.sendMessage(tab.id, { action: 'restorePage' });
            } else {
                await this.translateCurrentPage(tab);
            }
        } catch (error) {
            console.error('Fehler beim Umschalten der Übersetzung:', error);
        }
    }

    async translateText(text, source, target) {
        try {
            const settings = await chrome.storage.sync.get(['serviceUrl', 'apiKey']);
            const serviceUrl = settings.serviceUrl || 'https://translate.mac/translate';
            const apiKey = settings.apiKey || '';

            const response = await fetch(serviceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: text,
                    source: source,
                    target: target,
                    format: 'text',
                    alternatives: 1,
                    api_key: apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            return {
                success: true,
                translatedText: result.translatedText || text,
                alternatives: result.alternatives || []
            };

        } catch (error) {
            console.error('Übersetzungsfehler:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async isDomainExcluded(domain) {
        try {
            const settings = await chrome.storage.sync.get(['excludedDomains']);
            const excludedDomains = settings.excludedDomains || '';

            if (!excludedDomains.trim()) {
                return false;
            }

            const domains = excludedDomains.split('\n')
                .map(d => d.trim().toLowerCase())
                .filter(d => d.length > 0);

            const currentDomain = domain.toLowerCase();

            return domains.some(excludedDomain => {
                // Exakte Übereinstimmung oder Subdomain
                return currentDomain === excludedDomain ||
                    currentDomain.endsWith('.' + excludedDomain);
            });

        } catch (error) {
            console.error('Fehler beim Prüfen der Domain:', error);
            return false;
        }
    }

    async setDefaultSettings() {
        const defaultSettings = {
            serviceUrl: 'https://translate.mac/translate',
            apiKey: '',
            sourceLang: 'auto',
            targetLang: 'de',
            defaultSourceLang: 'auto',
            defaultTargetLang: 'de',
            batchSize: 5,
            excludedDomains: '',
            hotkey: 'Ctrl+Shift+T'
        };

        try {
            await chrome.storage.sync.set(defaultSettings);
            console.log('Standardeinstellungen gesetzt');
        } catch (error) {
            console.error('Fehler beim Setzen der Standardeinstellungen:', error);
        }
    }

    async migrateSettings(previousVersion) {
        try {
            console.log('Migriere Einstellungen von Version', previousVersion);

            // Hier können spätere Versionen Migrations-Logik hinzufügen
            // Beispiel:
            // if (previousVersion < '2.0') {
            //   // Migriere alte Einstellungen
            // }

        } catch (error) {
            console.error('Fehler bei der Einstellungsmigration:', error);
        }
    }

    async validateSettings() {
        try {
            const settings = await chrome.storage.sync.get(['serviceUrl']);

            if (!settings.serviceUrl) {
                console.warn('Keine Service URL konfiguriert');
                // Öffne Optionsseite
                chrome.runtime.openOptionsPage();
            }
        } catch (error) {
            console.error('Fehler bei der Einstellungsvalidierung:', error);
        }
    }

    showNotification(message, type = 'info') {
        // Chrome Notifications API verwenden
        if (chrome.notifications) {
            const iconUrl = type === 'success' ? 'icons/icon48.png' :
                type === 'error' ? 'icons/icon48.png' : 'icons/icon48.png';

            chrome.notifications.create({
                type: 'basic',
                iconUrl: iconUrl,
                title: 'Web Translator',
                message: message
            });
        } else {
            console.log('Benachrichtigung:', message);
        }
    }
}

// Initialisiere Background Script
new TranslatorBackground();
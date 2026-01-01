// Background Script (Service Worker) - Smart Web Translator v2.0
class TranslatorBackground {
  constructor() {
    this.translationHistory = [];
    this.init();
  }

  init() {
    // Event Listener müssen synchron registriert werden (MV3 Requirement)
    chrome.runtime.onInstalled.addListener((details) => this.handleInstall(details));
    chrome.runtime.onStartup.addListener(() => this.handleStartup());
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // Commands (Tastenkürzel)
    chrome.commands.onCommand.addListener((command) => this.handleCommand(command));

    // Kontextmenü einrichten
    this.setupContextMenu();

    // Side Panel Verhalten
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  async handleInstall(details) {
    if (details.reason === 'install') {
      await this.setDefaultSettings();
      // Kontextmenü neu erstellen
      await this.setupContextMenu();
    } else if (details.reason === 'update') {
      await this.migrateSettings(details.previousVersion);
      await this.setupContextMenu();
    }
  }

  async handleStartup() {
    await this.setupContextMenu();
  }

  async setupContextMenu() {
    try {
      await chrome.contextMenus.removeAll();

      // Auswahl übersetzen - Hauptfunktion
      chrome.contextMenus.create({
        id: 'translate-selection',
        title: '🌐 "%s" übersetzen',
        contexts: ['selection']
      });

      // Seite übersetzen
      chrome.contextMenus.create({
        id: 'translate-page',
        title: '🌐 Seite übersetzen',
        contexts: ['page']
      });

      // Bilingualer Modus
      chrome.contextMenus.create({
        id: 'translate-page-bilingual',
        title: '📖 Bilingual übersetzen (Original + Übersetzung)',
        contexts: ['page']
      });

      // Separator
      chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['page', 'selection']
      });

      // Side Panel öffnen
      chrome.contextMenus.create({
        id: 'open-sidepanel',
        title: '📋 Side Panel öffnen',
        contexts: ['page', 'selection']
      });

      // Einstellungen
      chrome.contextMenus.create({
        id: 'open-options',
        title: '⚙️ Einstellungen',
        contexts: ['page']
      });

      // Click Handler
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenuClick(info, tab);
      });

    } catch (error) {
      console.error('Kontextmenü-Fehler:', error);
    }
  }

  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case 'translate-selection':
          await this.translateAndShowResult(info.selectionText, tab);
          break;

        case 'translate-page':
          await this.sendToContentScript(tab.id, { action: 'translatePage', mode: 'replace' });
          break;

        case 'translate-page-bilingual':
          await this.sendToContentScript(tab.id, { action: 'translatePage', mode: 'bilingual' });
          break;

        case 'open-sidepanel':
          await chrome.sidePanel.open({ tabId: tab.id });
          if (info.selectionText) {
            // Kurze Verzögerung damit Side Panel laden kann
            setTimeout(() => {
              chrome.runtime.sendMessage({
                action: 'sidepanel-translate',
                text: info.selectionText
              });
            }, 300);
          }
          break;

        case 'open-options':
          chrome.runtime.openOptionsPage();
          break;
      }
    } catch (error) {
      console.error('Kontextmenü-Klick-Fehler:', error);
    }
  }

  async handleCommand(command) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      switch (command) {
        case 'translate-selection':
          // Hole markierten Text vom Content Script
          const response = await this.sendToContentScript(tab.id, { action: 'getSelection' });
          if (response?.text) {
            await this.translateAndShowResult(response.text, tab);
          }
          break;

        case 'translate-page':
          await this.sendToContentScript(tab.id, { action: 'translatePage', mode: 'replace' });
          break;

        case 'toggle-sidepanel':
          await chrome.sidePanel.open({ tabId: tab.id });
          break;
      }
    } catch (error) {
      console.error('Command-Fehler:', error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'translate':
          const result = await this.translateText(request.text, request.source, request.target);
          sendResponse(result);
          break;

        case 'getSettings':
          const settings = await chrome.storage.sync.get();
          sendResponse({ success: true, settings });
          break;

        case 'getHistory':
          const history = await this.getHistory();
          sendResponse({ success: true, history });
          break;

        case 'clearHistory':
          await this.clearHistory();
          sendResponse({ success: true });
          break;

        case 'addToHistory':
          await this.addToHistory(request.entry);
          sendResponse({ success: true });
          break;

        case 'openSidePanel':
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await chrome.sidePanel.open({ tabId: tab.id });
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unbekannte Aktion' });
      }
    } catch (error) {
      console.error('Message-Handler-Fehler:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async translateAndShowResult(text, tab) {
    if (!text || text.trim().length === 0) return;

    const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
    const result = await this.translateText(
      text.trim(),
      settings.sourceLang || 'auto',
      settings.targetLang || 'de'
    );

    if (result.success) {
      // Zum Verlauf hinzufügen
      await this.addToHistory({
        original: text.trim(),
        translated: result.translatedText,
        source: settings.sourceLang || 'auto',
        target: settings.targetLang || 'de',
        timestamp: Date.now()
      });

      // Zeige Tooltip im Content Script
      await this.sendToContentScript(tab.id, {
        action: 'showTranslation',
        original: text.trim(),
        translated: result.translatedText,
        alternatives: result.alternatives
      });
    } else {
      await this.sendToContentScript(tab.id, {
        action: 'showError',
        message: result.error || 'Übersetzungsfehler'
      });
    }
  }

  async translateText(text, source = 'auto', target = 'de') {
    try {
      const settings = await chrome.storage.sync.get(['serviceUrl', 'apiKey']);
      const serviceUrl = settings.serviceUrl || 'http://localhost:5000/translate';

      const response = await fetch(serviceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: source,
          target: target,
          format: 'text',
          alternatives: 3,
          api_key: settings.apiKey || ''
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        translatedText: result.translatedText || text,
        alternatives: result.alternatives || [],
        detectedLanguage: result.detectedLanguage
      };

    } catch (error) {
      console.error('Übersetzungsfehler:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToContentScript(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('Content Script nicht erreichbar:', error);
      return null;
    }
  }

  // History Management
  async getHistory() {
    const data = await chrome.storage.local.get(['translationHistory']);
    return data.translationHistory || [];
  }

  async addToHistory(entry) {
    const history = await this.getHistory();
    history.unshift(entry);
    // Maximal 100 Einträge behalten
    const trimmed = history.slice(0, 100);
    await chrome.storage.local.set({ translationHistory: trimmed });
  }

  async clearHistory() {
    await chrome.storage.local.set({ translationHistory: [] });
  }

  async setDefaultSettings() {
    const defaultSettings = {
      serviceUrl: 'http://localhost:5000/translate',
      apiKey: '',
      sourceLang: 'auto',
      targetLang: 'de',
      // UI-Einstellungen
      showSelectionIcon: true,
      selectionIconDelay: 200,
      tooltipPosition: 'below',
      tooltipAutoHide: true,
      tooltipAutoHideDelay: 5000,
      // Trigger-Einstellungen
      enableDoubleClick: false,
      enableHoverTranslate: false,
      hoverDelay: 500,
      // Anzeige-Einstellungen
      showOriginalInTooltip: true,
      showAlternatives: true,
      // Seitenübersetzung
      bilingualMode: false,
      bilingualPosition: 'below',
      highlightTranslated: true,
      // Sonstiges
      excludedDomains: '',
      enableTTS: false,
      ttsLanguage: 'de-DE'
    };

    await chrome.storage.sync.set(defaultSettings);
  }

  async migrateSettings(previousVersion) {
    // Füge neue Einstellungen hinzu falls sie fehlen
    const current = await chrome.storage.sync.get();
    const defaults = {
      showSelectionIcon: true,
      selectionIconDelay: 200,
      tooltipPosition: 'below',
      tooltipAutoHide: true,
      tooltipAutoHideDelay: 5000,
      enableDoubleClick: false,
      enableHoverTranslate: false,
      hoverDelay: 500,
      showOriginalInTooltip: true,
      showAlternatives: true,
      bilingualMode: false,
      bilingualPosition: 'below',
      highlightTranslated: true,
      enableTTS: false,
      ttsLanguage: 'de-DE'
    };

    const merged = { ...defaults, ...current };
    await chrome.storage.sync.set(merged);
  }
}

// Initialisieren
new TranslatorBackground();

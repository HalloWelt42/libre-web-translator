// Background Script - Smart Web Translator v2.1

class TranslatorBackground {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener((details) => this.handleInstall(details));
    chrome.runtime.onStartup.addListener(() => this.setupContextMenu());
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
    chrome.commands.onCommand.addListener((command) => this.handleCommand(command));
    this.setupContextMenu();
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  async handleInstall(details) {
    if (details.reason === 'install') {
      await this.setDefaultSettings();
    }
    await this.setupContextMenu();
  }

  async setupContextMenu() {
    try {
      await chrome.contextMenus.removeAll();

      chrome.contextMenus.create({
        id: 'translate-selection',
        title: '🌐 "%s" übersetzen',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'translate-word',
        title: '🌐 Wort übersetzen',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'translate-page',
        title: '🌐 Seite übersetzen',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'translate-page-bilingual',
        title: '📖 Bilingual übersetzen',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['page', 'selection']
      });

      // Export-Untermenü
      chrome.contextMenus.create({
        id: 'export-menu',
        title: '📥 Exportieren',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-pdf',
        parentId: 'export-menu',
        title: 'Als PDF (Standard)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-pdf-simple',
        parentId: 'export-menu',
        title: 'Als PDF (Vereinfacht)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-markdown',
        parentId: 'export-menu',
        title: 'Als Markdown',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-text',
        parentId: 'export-menu',
        title: 'Als Text',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-docx',
        parentId: 'export-menu',
        title: 'Als Word (.doc)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'separator2',
        type: 'separator',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'open-sidepanel',
        title: '📋 Side Panel öffnen',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'open-options',
        title: '⚙️ Einstellungen',
        contexts: ['page']
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenuClick(info, tab);
      });
    } catch (e) {
      console.error('Context menu error:', e);
    }
  }

  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case 'translate-selection':
          await this.translateAndShowResult(info.selectionText, tab);
          break;
        case 'translate-word':
          // Wort an Mausposition übersetzen
          await this.sendToContentScript(tab.id, { 
            action: 'translateWordAtCursor',
            x: info.pageX || 0,
            y: info.pageY || 0
          });
          break;
        case 'translate-page':
          await this.sendToContentScript(tab.id, { action: 'translatePage', mode: 'replace' });
          break;
        case 'translate-page-bilingual':
          await this.sendToContentScript(tab.id, { action: 'translatePage', mode: 'bilingual' });
          break;
        case 'export-pdf':
          await this.sendToContentScript(tab.id, { action: 'exportPdf', simplified: false });
          break;
        case 'export-pdf-simple':
          await this.sendToContentScript(tab.id, { action: 'exportPdf', simplified: true });
          break;
        case 'export-markdown':
          await this.sendToContentScript(tab.id, { action: 'exportMarkdown' });
          break;
        case 'export-text':
          await this.sendToContentScript(tab.id, { action: 'exportText' });
          break;
        case 'export-docx':
          await this.sendToContentScript(tab.id, { action: 'exportDocx' });
          break;
        case 'open-sidepanel':
          await chrome.sidePanel.open({ tabId: tab.id });
          if (info.selectionText) {
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: 'sidepanel-translate', text: info.selectionText });
            }, 300);
          }
          break;
        case 'open-options':
          chrome.runtime.openOptionsPage();
          break;
      }
    } catch (e) {
      console.error('Context menu click error:', e);
    }
  }

  async handleCommand(command) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      switch (command) {
        case 'translate-selection':
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
    } catch (e) {
      console.error('Command error:', e);
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
          if (tab) await chrome.sidePanel.open({ tabId: tab.id });
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (e) {
      console.error('Message handler error:', e);
      sendResponse({ success: false, error: e.message });
    }
  }

  async translateAndShowResult(text, tab) {
    if (!text?.trim()) return;

    const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
    const result = await this.translateText(
      text.trim(),
      settings.sourceLang || 'auto',
      settings.targetLang || 'de'
    );

    if (result.success) {
      await this.addToHistory({
        original: text.trim(),
        translated: result.translatedText,
        source: settings.sourceLang || 'auto',
        target: settings.targetLang || 'de',
        timestamp: Date.now()
      });

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
    } catch (e) {
      console.error('Translation error:', e);
      return { success: false, error: e.message };
    }
  }

  async sendToContentScript(tabId, message) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
      console.error('Content script unreachable:', e);
      return null;
    }
  }

  async getHistory() {
    const data = await chrome.storage.local.get(['translationHistory']);
    return data.translationHistory || [];
  }

  async addToHistory(entry) {
    const history = await this.getHistory();
    history.unshift(entry);
    await chrome.storage.local.set({ translationHistory: history.slice(0, 100) });
  }

  async clearHistory() {
    await chrome.storage.local.set({ translationHistory: [] });
  }

  async setDefaultSettings() {
    const defaults = {
      serviceUrl: 'http://localhost:5000/translate',
      apiKey: '',
      sourceLang: 'auto',
      targetLang: 'de',
      showSelectionIcon: true,
      selectionIconDelay: 200,
      tooltipPosition: 'below',
      tooltipAutoHide: true,
      tooltipAutoHideDelay: 5000,
      enableDoubleClick: false,
      showOriginalInTooltip: true,
      showAlternatives: true,
      enableTTS: false,
      ttsLanguage: 'de-DE',
      skipCodeBlocks: true,
      skipBlockquotes: true,
      highlightTranslated: true,
      bilingualPosition: 'below',
      useTabsForAlternatives: true,
      simplifyPdfExport: false,
      fixInlineSpacing: true,
      tabWordThreshold: 20
    };
    await chrome.storage.sync.set(defaults);
  }
}

new TranslatorBackground();

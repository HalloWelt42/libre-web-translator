// Background Script - Smart Web Translator v3.0 mit LM Studio Support

// Fachkontext System-Prompts (identisch mit options.js für Konsistenz)
const CONTEXT_PROMPTS = {
  general: `Du bist ein präziser Übersetzer. Übersetze den folgenden Text von {source} nach {target}.
Gib eine natürliche, flüssige Übersetzung. Behalte die Formatierung bei.
Antworte NUR mit einem JSON-Objekt im Format: {"translation": "deine Übersetzung", "alternatives": ["alternative1", "alternative2"]}`,

  automotive: `Du bist ein Kfz-Fachübersetzer für {source} nach {target}.
WICHTIGE REGELN:
- NIEMALS übersetzen: Teilenummern, OE-Nummern, Codes, Abkürzungen (ABS, ESP, etc.), Markennamen
- Verwende korrekte deutsche Kfz-Fachbegriffe:
  • Control arm → Querlenker
  • Tie rod end → Spurstangenkopf
  • Ball joint → Traggelenk
  • Wheel bearing → Radlager
  • Brake caliper → Bremssattel
  • Strut mount → Domlager
- Bei Unsicherheit: technisch korrekte Variante bevorzugen
Antworte NUR mit JSON: {"translation": "...", "alternatives": ["...", "..."], "context_notes": "Fachhinweise falls relevant"}`,

  technical: `Du bist ein technischer Fachübersetzer {source} → {target}.
REGELN:
- Bewahre absolute technische Präzision
- Belasse etablierte englische Fachbegriffe (API, Cache, Backend, Framework, etc.)
- Verwende korrekte deutsche IT-Terminologie wo üblich
- Code-Beispiele und Variablennamen NIEMALS übersetzen
Antworte NUR mit JSON: {"translation": "...", "alternatives": ["..."]}`,

  medical: `Du bist ein medizinischer Fachübersetzer {source} → {target}.
REGELN:
- Verwende exakte medizinische Terminologie
- Lateinische/griechische Fachbegriffe beibehalten wenn in der Medizin üblich
- Höchste Präzision bei Dosierungen, Maßeinheiten und Anweisungen
- Anatomische Begriffe korrekt übersetzen
Antworte NUR mit JSON: {"translation": "...", "alternatives": ["..."], "context_notes": "Medizinische Hinweise"}`,

  legal: `Du bist ein juristischer Fachübersetzer {source} → {target}.
REGELN:
- Verwende exakte juristische Terminologie des Zielrechtssystems
- Beachte länderspezifische Rechtsbegriffe (deutsches Recht)
- Gesetzesnamen und Paragraphen korrekt übertragen
- Im Zweifel: wörtliche Übersetzung mit erklärender Anmerkung
Antworte NUR mit JSON: {"translation": "...", "alternatives": ["..."], "context_notes": "Rechtliche Anmerkungen"}`,

  custom: ''
};

// Batch-Übersetzungs-Prompt für Seitenübersetzung
const BATCH_PROMPT = `Du bist ein Batch-Übersetzer {source} → {target}.
Du erhältst ein JSON-Array mit Texten.
Übersetze jeden Text einzeln und behalte die EXAKTE Reihenfolge bei.
Antworte NUR mit JSON im Format:
{"items": [{"original": "...", "translation": "..."}, ...]}
WICHTIG: Die Anzahl der Ausgabe-Items MUSS der Anzahl der Eingabe-Items entsprechen.`;

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
    } else if (details.reason === 'update') {
      // Migration für bestehende Nutzer
      await this.migrateSettings();
    }
    await this.setupContextMenu();
  }

  async migrateSettings() {
    const settings = await chrome.storage.sync.get();
    
    // Wenn alte Settings, aber kein apiType → Default auf LibreTranslate
    if (!settings.apiType) {
      await chrome.storage.sync.set({
        apiType: 'libretranslate',
        lmStudioUrl: 'http://192.168.178.45:1234',
        lmStudioModel: '',
        lmStudioTemperature: 0.1,
        lmStudioMaxTokens: 2000,
        lmStudioContext: 'general',
        lmStudioCustomPrompt: ''
      });
    }
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

        case 'translateBatch':
          const batchResult = await this.translateBatch(request.texts, request.source, request.target);
          sendResponse(batchResult);
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

        case 'getApiType':
          const apiSettings = await chrome.storage.sync.get(['apiType']);
          sendResponse({ success: true, apiType: apiSettings.apiType || 'libretranslate' });
          break;

        case 'getTokenStats':
          const tokenStats = await this.getTokenStats();
          sendResponse({ success: true, stats: tokenStats });
          break;

        case 'updateTokenStats':
          const updatedStats = await this.updateTokenStats(request.usage);
          sendResponse({ success: true, stats: updatedStats });
          break;

        case 'resetTokenStats':
          await this.resetTokenStats();
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
        timestamp: Date.now(),
        apiType: result.apiType
      });

      await this.sendToContentScript(tab.id, {
        action: 'showTranslation',
        original: text.trim(),
        translated: result.translatedText,
        alternatives: result.alternatives,
        contextNotes: result.contextNotes
      });
    } else {
      await this.sendToContentScript(tab.id, {
        action: 'showError',
        message: result.error || 'Übersetzungsfehler'
      });
    }
  }

  async translateText(text, source = 'auto', target = 'de') {
    const settings = await chrome.storage.sync.get([
      'apiType', 'serviceUrl', 'apiKey',
      'lmStudioUrl', 'lmStudioModel', 'lmStudioTemperature',
      'lmStudioMaxTokens', 'lmStudioContext', 'lmStudioCustomPrompt',
      'enableLLMFallback'
    ]);

    const apiType = settings.apiType || 'libretranslate';

    if (apiType === 'lmstudio') {
      const result = await this.translateWithLMStudio(text, source, target, settings);
      
      // Fallback auf LibreTranslate wenn aktiviert und Fehler
      if (!result.success && settings.enableLLMFallback) {
        console.log('LM Studio Fallback zu LibreTranslate...');
        const fallbackResult = await this.translateWithLibreTranslate(text, source, target, settings);
        fallbackResult.fallbackUsed = true;
        return fallbackResult;
      }
      
      return result;
    } else {
      return await this.translateWithLibreTranslate(text, source, target, settings);
    }
  }

  async translateWithLibreTranslate(text, source, target, settings) {
    try {
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
        detectedLanguage: result.detectedLanguage,
        apiType: 'libretranslate',
        tokens: 0 // LibreTranslate hat keine Token-Info
      };
    } catch (e) {
      console.error('LibreTranslate error:', e);
      return { success: false, error: e.message };
    }
  }

  async translateWithLMStudio(text, source, target, settings) {
    try {
      const url = settings.lmStudioUrl || 'http://192.168.178.45:1234';
      const model = settings.lmStudioModel;
      
      if (!model) {
        throw new Error('Kein LM Studio Modell ausgewählt');
      }

      const systemPrompt = this.buildSystemPrompt(settings, source, target);

      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: settings.lmStudioTemperature || 0.1,
          max_tokens: settings.lmStudioMaxTokens || 2000,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'translation',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  translation: { type: 'string' },
                  alternatives: { 
                    type: 'array',
                    items: { type: 'string' }
                  },
                  context_notes: { type: 'string' }
                },
                required: ['translation'],
                additionalProperties: false
              }
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.choices || !result.choices[0]) {
        throw new Error('Ungültige Antwort vom LM Studio Server');
      }

      const content = result.choices[0].message.content;
      
      // Token-Usage extrahieren und persistent speichern
      const usage = result.usage || {};
      const tokens = usage.total_tokens || 
                    (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      
      // Globale Token-Stats aktualisieren
      if (usage.total_tokens) {
        await this.updateTokenStats(usage);
      }
      
      try {
        const parsed = JSON.parse(content);
        return {
          success: true,
          translatedText: parsed.translation,
          alternatives: parsed.alternatives || [],
          contextNotes: parsed.context_notes,
          apiType: 'lmstudio',
          tokens: tokens,
          usage: usage
        };
      } catch (parseError) {
        // Fallback: Wenn kein JSON, nutze die rohe Antwort
        return {
          success: true,
          translatedText: content.trim(),
          alternatives: [],
          apiType: 'lmstudio',
          tokens: tokens,
          usage: usage
        };
      }
    } catch (e) {
      console.error('LM Studio error:', e);
      return { success: false, error: e.message };
    }
  }

  async translateBatch(texts, source, target) {
    const settings = await chrome.storage.sync.get([
      'apiType', 'serviceUrl', 'apiKey',
      'lmStudioUrl', 'lmStudioModel', 'lmStudioTemperature',
      'lmStudioMaxTokens', 'lmStudioContext', 'lmStudioCustomPrompt'
    ]);

    const apiType = settings.apiType || 'libretranslate';

    if (apiType === 'lmstudio') {
      return await this.batchTranslateWithLMStudio(texts, source, target, settings);
    } else {
      // LibreTranslate: Einzeln übersetzen
      const results = [];
      for (const text of texts) {
        const result = await this.translateWithLibreTranslate(text, source, target, settings);
        results.push({
          original: text,
          translation: result.success ? result.translatedText : text
        });
      }
      return { success: true, items: results };
    }
  }

  async batchTranslateWithLMStudio(texts, source, target, settings) {
    try {
      const url = settings.lmStudioUrl || 'http://192.168.178.45:1234';
      const model = settings.lmStudioModel;
      
      if (!model) {
        throw new Error('Kein LM Studio Modell ausgewählt');
      }

      // Batch-Prompt mit Sprachplatzhaltern
      const sourceLabel = source === 'auto' ? 'der Quellsprache' : this.getLanguageName(source);
      const targetLabel = this.getLanguageName(target);
      const systemPrompt = BATCH_PROMPT
        .replace(/{source}/g, sourceLabel)
        .replace(/{target}/g, targetLabel);

      const response = await fetch(`${url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(texts) }
          ],
          temperature: settings.lmStudioTemperature || 0.1,
          max_tokens: Math.min(texts.length * 300, 8000), // ~300 Token pro Übersetzung
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'translations',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        original: { type: 'string' },
                        translation: { type: 'string' }
                      },
                      required: ['original', 'translation'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['items'],
                additionalProperties: false
              }
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      return { success: true, items: parsed.items };
    } catch (e) {
      console.error('LM Studio batch error:', e);
      // Fallback: Einzeln übersetzen
      const results = [];
      for (const text of texts) {
        const result = await this.translateWithLMStudio(text, source, target, settings);
        results.push({
          original: text,
          translation: result.success ? result.translatedText : text
        });
      }
      return { success: true, items: results };
    }
  }

  buildSystemPrompt(settings, source, target) {
    const context = settings.lmStudioContext || 'general';
    const customPrompt = settings.lmStudioCustomPrompt;
    
    let prompt = context === 'custom' && customPrompt 
      ? customPrompt 
      : CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.general;
    
    // Sprachbezeichnungen ersetzen
    const sourceLabel = source === 'auto' ? 'der Quellsprache' : this.getLanguageName(source);
    const targetLabel = this.getLanguageName(target);
    
    return prompt
      .replace(/{source}/g, sourceLabel)
      .replace(/{target}/g, targetLabel);
  }

  getLanguageName(code) {
    const names = {
      'auto': 'Automatisch',
      'en': 'Englisch',
      'de': 'Deutsch',
      'fr': 'Französisch',
      'es': 'Spanisch',
      'it': 'Italienisch',
      'pt': 'Portugiesisch',
      'nl': 'Niederländisch',
      'pl': 'Polnisch',
      'ru': 'Russisch',
      'zh': 'Chinesisch',
      'ja': 'Japanisch',
      'ko': 'Koreanisch',
      'ar': 'Arabisch',
      'tr': 'Türkisch'
    };
    return names[code] || code;
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

  // === Token Statistics ===
  async getTokenStats() {
    const data = await chrome.storage.local.get(['tokenStats']);
    return data.tokenStats || {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      lastUpdated: null
    };
  }

  async updateTokenStats(usage) {
    if (!usage) return;
    
    const stats = await this.getTokenStats();
    stats.totalTokens += usage.total_tokens || 0;
    stats.promptTokens += usage.prompt_tokens || 0;
    stats.completionTokens += usage.completion_tokens || 0;
    stats.requestCount += 1;
    stats.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ tokenStats: stats });
    
    // Kosten aktualisieren wenn aktiviert
    await this.updateCost(usage.total_tokens || 0);
    
    return stats;
  }

  async updateCost(newTokens) {
    const settings = await chrome.storage.sync.get([
      'enableTokenCost', 'tokenCostAmount', 'tokenCostPer'
    ]);
    
    if (!settings.enableTokenCost) return;
    
    const costAmount = settings.tokenCostAmount || 1;
    const costPer = settings.tokenCostPer || 10000;
    
    // Cent pro X Tokens -> Hauptwährung
    const costPerToken = (costAmount / 100) / costPer;
    const addedCost = newTokens * costPerToken;
    
    const costData = await chrome.storage.local.get(['totalCost']);
    const newTotalCost = (costData.totalCost || 0) + addedCost;
    
    await chrome.storage.local.set({ totalCost: newTotalCost });
  }

  async resetTokenStats() {
    await chrome.storage.local.set({ 
      tokenStats: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        requestCount: 0,
        lastUpdated: null
      }
    });
  }

  async setDefaultSettings() {
    const defaults = {
      // API-Typ (neu)
      apiType: 'libretranslate',
      
      // LibreTranslate
      serviceUrl: 'http://localhost:5000/translate',
      apiKey: '',
      
      // LM Studio (neu)
      lmStudioUrl: 'http://192.168.178.45:1234',
      lmStudioModel: '',
      lmStudioTemperature: 0.1,
      lmStudioMaxTokens: 2000,
      lmStudioContext: 'general',
      lmStudioCustomPrompt: '',
      
      // Sprachen
      sourceLang: 'auto',
      targetLang: 'de',
      
      // UI
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
      tabWordThreshold: 20,
      excludedDomains: ''
    };
    await chrome.storage.sync.set(defaults);
  }
}

new TranslatorBackground();

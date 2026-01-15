// Side Panel JavaScript - Smart Web Translator v3.0

class SidePanelController {
  constructor() {
    this.currentTranslation = '';
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupTabs();
    this.setupTranslation();
    this.setupHistory();
    this.setupCache();
    this.setupActions();
    this.setupMessageListener();
  }

  async loadSettings() {
    const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang', 'apiType']);
    document.getElementById('sourceLang').value = settings.sourceLang || 'auto';
    document.getElementById('targetLang').value = settings.targetLang || 'de';
    
    // API-Badge aktualisieren
    this.updateApiBadge(settings.apiType || 'libretranslate');
  }

  updateApiBadge(apiType) {
    const badge = document.getElementById('apiBadge');
    const badgeText = document.getElementById('apiBadgeText');
    
    if (badge && badgeText) {
      if (apiType === 'lmstudio') {
        badge.classList.add('lmstudio');
        badgeText.textContent = 'LLM';
        badge.title = 'LM Studio (Lokales LLM)';
      } else {
        badge.classList.remove('lmstudio');
        badgeText.textContent = 'Libre';
        badge.title = 'LibreTranslate';
      }
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(targetId).classList.add('active');

        if (targetId === 'history') this.loadHistory();
        if (targetId === 'cache') this.loadCache();
      });
    });
  }

  setupTranslation() {
    const sourceText = document.getElementById('sourceText');
    const translateBtn = document.getElementById('translateBtn');
    const resultBox = document.getElementById('resultBox');
    const resultActions = document.getElementById('resultActions');

    translateBtn.addEventListener('click', () => this.translate());

    sourceText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.translate();
      }
    });

    // Click-to-Copy für sourceText
    sourceText.addEventListener('click', (e) => {
      const text = sourceText.value.trim();
      if (text && e.detail === 2) { // Doppelklick
        navigator.clipboard.writeText(text);
        this.showToast('Quelltext kopiert!');
      }
    });

    // Click-to-Copy für resultBox
    resultBox.addEventListener('click', () => {
      if (this.currentTranslation) {
        navigator.clipboard.writeText(this.currentTranslation);
        resultBox.classList.add('copied');
        this.showToast('Übersetzung kopiert!');
        setTimeout(() => resultBox.classList.remove('copied'), 1500);
      }
    });

    document.getElementById('swapLangs').addEventListener('click', () => {
      const source = document.getElementById('sourceLang');
      const target = document.getElementById('targetLang');
      if (source.value !== 'auto') {
        const temp = source.value;
        source.value = target.value;
        target.value = temp;
        this.saveLanguages();
      }
    });

    document.getElementById('copyResult').addEventListener('click', () => {
      navigator.clipboard.writeText(this.currentTranslation);
      this.showToast('Kopiert!');
    });

    document.getElementById('speakResult').addEventListener('click', () => {
      const targetLang = document.getElementById('targetLang').value;
      const utterance = new SpeechSynthesisUtterance(this.currentTranslation);
      utterance.lang = this.getLangCode(targetLang);
      speechSynthesis.speak(utterance);
    });

    document.getElementById('sourceLang').addEventListener('change', () => this.saveLanguages());
    document.getElementById('targetLang').addEventListener('change', () => this.saveLanguages());
  }

  async translate() {
    const sourceText = document.getElementById('sourceText').value.trim();
    if (!sourceText) return;

    const translateBtn = document.getElementById('translateBtn');
    const resultBox = document.getElementById('resultBox');
    const resultActions = document.getElementById('resultActions');
    const contextNotes = document.getElementById('contextNotes');
    const contextNotesText = document.getElementById('contextNotesText');

    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;

    translateBtn.disabled = true;
    translateBtn.innerHTML = '<div class="spinner"></div> Übersetze...';
    
    // Context Notes ausblenden während der Übersetzung
    if (contextNotes) contextNotes.classList.remove('show');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text: sourceText,
        source: sourceLang,
        target: targetLang
      });

      resultBox.classList.remove('error');

      if (result.success) {
        resultBox.textContent = result.translatedText;
        this.currentTranslation = result.translatedText;
        resultActions.style.display = 'flex';

        // Kontext-Notizen anzeigen (nur bei LM Studio)
        if (result.contextNotes && contextNotes && contextNotesText) {
          contextNotesText.textContent = result.contextNotes;
          contextNotes.classList.add('show');
        }

        await chrome.runtime.sendMessage({
          action: 'addToHistory',
          entry: {
            original: sourceText,
            translated: result.translatedText,
            source: sourceLang,
            target: targetLang,
            timestamp: Date.now(),
            apiType: result.apiType
          }
        });
      } else {
        resultBox.textContent = 'Fehler: ' + (result.error || 'Unbekannt');
        resultBox.classList.add('error');
      }
    } catch (error) {
      resultBox.textContent = 'Verbindungsfehler: ' + error.message;
      resultBox.classList.add('error');
    }

    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      Übersetzen
    `;
  }

  async saveLanguages() {
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    await chrome.storage.sync.set({ sourceLang, targetLang });
  }

  setupActions() {
    document.getElementById('translatePage').addEventListener('click', () => this.sendPageAction('translatePage', { mode: 'replace' }));
    document.getElementById('bilingualPage').addEventListener('click', () => this.sendPageAction('translatePage', { mode: 'bilingual' }));
    document.getElementById('toggleTranslation').addEventListener('click', () => this.sendPageAction('toggleTranslation'));
    document.getElementById('restorePage').addEventListener('click', () => this.sendPageAction('restorePage'));
    document.getElementById('loadCache').addEventListener('click', () => this.sendPageAction('loadCachedTranslation'));
    document.getElementById('exportPdf').addEventListener('click', () => this.sendPageAction('exportPdf'));

    document.getElementById('openOptions').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  async sendPageAction(action, data = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action, ...data });
        this.showToast('Aktion ausgeführt');
      }
    } catch (e) {
      this.showToast('Fehler: Seite nicht erreichbar');
    }
  }

  setupHistory() {
    document.getElementById('clearHistory').addEventListener('click', async () => {
      if (confirm('Verlauf wirklich löschen?')) {
        await chrome.runtime.sendMessage({ action: 'clearHistory' });
        this.loadHistory();
        this.showToast('Verlauf gelöscht');
      }
    });
  }

  async loadHistory() {
    const historyList = document.getElementById('historyList');

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      const history = response.history || [];

      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="history-empty">
            <svg viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
            <p>Noch keine Übersetzungen</p>
          </div>
        `;
        return;
      }

      historyList.innerHTML = history.map(item => `
        <div class="history-item" data-original="${this.escapeAttr(item.original)}" data-translated="${this.escapeAttr(item.translated)}">
          <div class="history-original">${this.escapeHtml(item.original)}</div>
          <div class="history-translated">${this.escapeHtml(item.translated)}</div>
          <div class="history-meta">${this.formatDate(item.timestamp)} · ${item.source} → ${item.target}</div>
        </div>
      `).join('');

      historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          document.getElementById('sourceText').value = item.dataset.original;
          document.getElementById('resultBox').textContent = item.dataset.translated;
          this.currentTranslation = item.dataset.translated;
          document.getElementById('resultActions').style.display = 'flex';
          document.querySelector('.tab[data-tab="translate"]').click();
        });
      });
    } catch (e) {
      console.error('History error:', e);
    }
  }

  setupCache() {
    document.getElementById('refreshCache').addEventListener('click', () => this.loadCache());
    document.getElementById('clearAllCache').addEventListener('click', async () => {
      if (confirm('Gesamten Cache löschen?')) {
        await this.sendPageAction('clearCache');
        this.loadCache();
        this.showToast('Cache gelöscht');
      }
    });
    
    // Token Reset Button (nur Tokens)
    const resetTokensBtn = document.getElementById('resetTokens');
    if (resetTokensBtn) {
      resetTokensBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'resetTokenStats' });
        this.loadTokenStats();
        this.showToast('Token-Zähler zurückgesetzt');
      });
    }
    
    // Kosten Reset Button
    const resetCostBtn = document.getElementById('resetCost');
    if (resetCostBtn) {
      resetCostBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({ totalCost: 0 });
        this.loadTokenStats();
        this.showToast('Kosten zurückgesetzt');
      });
    }
    
    // Alles Reset Button
    const resetAllBtn = document.getElementById('resetAll');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', async () => {
        if (confirm('Alle Statistiken (Tokens + Kosten) zurücksetzen?')) {
          await chrome.runtime.sendMessage({ action: 'resetTokenStats' });
          await chrome.storage.local.set({ totalCost: 0 });
          this.loadTokenStats();
          this.showToast('Alle Statistiken zurückgesetzt');
        }
      });
    }
  }

  async loadTokenStats() {
    try {
      // Token-Stats laden
      const response = await chrome.runtime.sendMessage({ action: 'getTokenStats' });
      
      // Kosten-Einstellungen laden
      const settings = await chrome.storage.sync.get([
        'enableTokenCost', 'tokenCostAmount', 'tokenCostPer', 'tokenCostCurrency'
      ]);
      
      // Gespeicherte Kosten laden
      const costData = await chrome.storage.local.get(['totalCost']);
      
      if (response.success && response.stats) {
        const stats = response.stats;
        
        const totalEl = document.getElementById('totalTokens');
        const promptEl = document.getElementById('promptTokens');
        const completionEl = document.getElementById('completionTokens');
        const requestEl = document.getElementById('requestCount');
        
        if (totalEl) totalEl.textContent = this.formatNumber(stats.totalTokens);
        if (promptEl) promptEl.textContent = this.formatNumber(stats.promptTokens);
        if (completionEl) completionEl.textContent = this.formatNumber(stats.completionTokens);
        if (requestEl) requestEl.textContent = this.formatNumber(stats.requestCount);
        
        // Kosten-Anzeige
        const costDisplay = document.getElementById('costDisplay');
        const totalCostEl = document.getElementById('totalCost');
        const costCurrencyEl = document.getElementById('costCurrency');
        
        if (settings.enableTokenCost && costDisplay) {
          costDisplay.style.display = 'block';
          
          // Kosten berechnen
          const costAmount = settings.tokenCostAmount || 1;
          const costPer = settings.tokenCostPer || 10000;
          const currency = settings.tokenCostCurrency || 'EUR';
          
          // Cent pro X Tokens -> Euro/Dollar
          const costPerToken = (costAmount / 100) / costPer;
          const totalCost = costData.totalCost || (stats.totalTokens * costPerToken);
          
          // Falls noch keine gespeicherten Kosten, basierend auf Tokens berechnen
          if (!costData.totalCost && stats.totalTokens > 0) {
            await chrome.storage.local.set({ totalCost: totalCost });
          }
          
          if (totalCostEl) {
            totalCostEl.textContent = totalCost.toLocaleString('de-DE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4
            });
          }
          
          if (costCurrencyEl) {
            const symbols = { 'EUR': '€', 'USD': '$', 'CHF': 'CHF' };
            costCurrencyEl.textContent = symbols[currency] || '€';
          }
        } else if (costDisplay) {
          costDisplay.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Token stats error:', e);
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 10000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString('de-DE');
  }

  async loadCache() {
    // Token-Stats laden
    await this.loadTokenStats();
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCacheInfo' });

      if (!response) {
        document.getElementById('cacheList').innerHTML = '<div class="cache-empty">Seite nicht erreichbar</div>';
        return;
      }

      document.getElementById('cacheTotalSize').textContent = this.formatBytes(response.size);
      document.getElementById('cachePageCount').textContent = response.entries.length;

      const cacheList = document.getElementById('cacheList');

      if (response.entries.length === 0) {
        cacheList.innerHTML = '<div class="cache-empty">Kein Cache vorhanden</div>';
        return;
      }

      cacheList.innerHTML = response.entries.map(entry => `
        <div class="cache-item" data-key="${entry.key}">
          <div class="cache-item-info">
            <a href="${this.escapeAttr(entry.url)}" class="cache-item-url" target="_blank" title="In neuem Tab öffnen">${this.escapeHtml(entry.url)}</a>
            <div class="cache-item-meta">${entry.count} Übersetzungen · ${this.formatBytes(entry.size)} · ${this.formatDate(entry.timestamp)}</div>
          </div>
          <div class="cache-item-actions">
            <button class="cache-item-btn delete" title="Löschen">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>
      `).join('');

      cacheList.querySelectorAll('.cache-item-btn.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const item = btn.closest('.cache-item');
          const key = item.dataset.key;
          await chrome.tabs.sendMessage(tab.id, { action: 'clearCache', key });
          item.remove();
          this.loadCache();
          this.showToast('Cache-Eintrag gelöscht');
        });
      });
    } catch (e) {
      console.error('Cache error:', e);
      document.getElementById('cacheList').innerHTML = '<div class="cache-empty">Fehler beim Laden</div>';
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'sidepanel-translate') {
        document.getElementById('sourceText').value = request.text;
        this.translate();
      } else if (request.action === 'sidepanel-show-cache') {
        document.querySelector('.tab[data-tab="cache"]').click();
      }
    });
  }

  getLangCode(lang) {
    const codes = {
      'de': 'de-DE', 'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES',
      'it': 'it-IT', 'pt': 'pt-PT', 'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP'
    };
    return codes[lang] || 'en-US';
  }

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    return date.toLocaleDateString('de-DE');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

new SidePanelController();

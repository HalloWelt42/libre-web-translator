// Side Panel JavaScript - Smart Web Translator v2.0

class SidePanelController {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupTabs();
    this.setupTranslation();
    this.setupHistory();
    this.setupSettings();
    this.setupMessageListener();
  }

  async loadSettings() {
    this.settings = await chrome.storage.sync.get([
      'sourceLang', 'targetLang', 'showSelectionIcon', 'enableDoubleClick',
      'showOriginalInTooltip', 'showAlternatives', 'tooltipAutoHide', 'enableTTS'
    ]);

    // UI aktualisieren
    document.getElementById('sourceLang').value = this.settings.sourceLang || 'auto';
    document.getElementById('targetLang').value = this.settings.targetLang || 'de';
    document.getElementById('showSelectionIcon').checked = this.settings.showSelectionIcon !== false;
    document.getElementById('enableDoubleClick').checked = this.settings.enableDoubleClick || false;
    document.getElementById('showOriginalInTooltip').checked = this.settings.showOriginalInTooltip !== false;
    document.getElementById('showAlternatives').checked = this.settings.showAlternatives !== false;
    document.getElementById('tooltipAutoHide').checked = this.settings.tooltipAutoHide !== false;
    document.getElementById('enableTTS').checked = this.settings.enableTTS || false;
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

        // Verlauf laden wenn Tab gewechselt wird
        if (targetId === 'history') {
          this.loadHistory();
        }
      });
    });
  }

  setupTranslation() {
    const sourceText = document.getElementById('sourceText');
    const translateBtn = document.getElementById('translateBtn');
    const resultBox = document.getElementById('resultBox');
    const resultActions = document.getElementById('resultActions');
    const charCount = document.getElementById('charCount');
    const swapBtn = document.getElementById('swapLangs');
    const copyBtn = document.getElementById('copyResult');
    const speakBtn = document.getElementById('speakResult');

    // Zeichen zählen
    sourceText.addEventListener('input', () => {
      charCount.textContent = sourceText.value.length;
    });

    // Übersetzen
    translateBtn.addEventListener('click', () => this.translate());

    // Enter zum Übersetzen (Shift+Enter für neue Zeile)
    sourceText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.translate();
      }
    });

    // Sprachen tauschen
    swapBtn.addEventListener('click', () => {
      const sourceLang = document.getElementById('sourceLang');
      const targetLang = document.getElementById('targetLang');

      if (sourceLang.value !== 'auto') {
        const temp = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = temp;
        this.saveLanguageSettings();
      }
    });

    // Kopieren
    copyBtn.addEventListener('click', () => {
      const text = resultBox.textContent;
      navigator.clipboard.writeText(text);
      this.showToast('Kopiert!');
    });

    // Vorlesen
    speakBtn.addEventListener('click', () => {
      const text = resultBox.textContent;
      const targetLang = document.getElementById('targetLang').value;
      this.speak(text, targetLang);
    });

    // Sprache speichern bei Änderung
    document.getElementById('sourceLang').addEventListener('change', () => this.saveLanguageSettings());
    document.getElementById('targetLang').addEventListener('change', () => this.saveLanguageSettings());
  }

  async translate() {
    const sourceText = document.getElementById('sourceText').value.trim();
    if (!sourceText) return;

    const translateBtn = document.getElementById('translateBtn');
    const resultBox = document.getElementById('resultBox');
    const resultActions = document.getElementById('resultActions');

    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;

    // Loading State
    translateBtn.disabled = true;
    translateBtn.innerHTML = '<div class="spinner"></div> Übersetze...';
    resultBox.textContent = 'Übersetze...';
    resultBox.classList.add('empty');

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text: sourceText,
        source: sourceLang,
        target: targetLang
      });

      if (result.success) {
        resultBox.textContent = result.translatedText;
        resultBox.classList.remove('empty');
        resultActions.style.display = 'flex';

        // Zum Verlauf hinzufügen
        await chrome.runtime.sendMessage({
          action: 'addToHistory',
          entry: {
            original: sourceText,
            translated: result.translatedText,
            source: sourceLang,
            target: targetLang,
            timestamp: Date.now()
          }
        });
      } else {
        resultBox.textContent = 'Fehler: ' + (result.error || 'Unbekannter Fehler');
        resultBox.classList.add('empty');
      }
    } catch (error) {
      resultBox.textContent = 'Verbindungsfehler';
      resultBox.classList.add('empty');
    }

    // Reset Button
    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      Übersetzen
    `;
  }

  async saveLanguageSettings() {
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    await chrome.storage.sync.set({ sourceLang, targetLang });
  }

  setupHistory() {
    const clearBtn = document.getElementById('clearHistory');

    clearBtn.addEventListener('click', async () => {
      if (confirm('Verlauf wirklich löschen?')) {
        await chrome.runtime.sendMessage({ action: 'clearHistory' });
        this.loadHistory();
        this.showToast('Verlauf gelöscht');
      }
    });

    // Initial laden
    this.loadHistory();
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

      // Klick-Handler für Verlaufseinträge
      historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          document.getElementById('sourceText').value = item.dataset.original;
          document.getElementById('resultBox').textContent = item.dataset.translated;
          document.getElementById('resultBox').classList.remove('empty');
          document.getElementById('resultActions').style.display = 'flex';
          document.getElementById('charCount').textContent = item.dataset.original.length;

          // Zum Übersetzen-Tab wechseln
          document.querySelector('.tab[data-tab="translate"]').click();
        });
      });

    } catch (error) {
      console.error('Fehler beim Laden des Verlaufs:', error);
    }
  }

  setupSettings() {
    const settingsInputs = [
      'showSelectionIcon', 'enableDoubleClick', 'showOriginalInTooltip',
      'showAlternatives', 'tooltipAutoHide', 'enableTTS'
    ];

    settingsInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => {
          this.saveSettings();
        });
      }
    });

    // Vollständige Einstellungen öffnen
    document.getElementById('openFullOptions').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  async saveSettings() {
    const settings = {
      showSelectionIcon: document.getElementById('showSelectionIcon').checked,
      enableDoubleClick: document.getElementById('enableDoubleClick').checked,
      showOriginalInTooltip: document.getElementById('showOriginalInTooltip').checked,
      showAlternatives: document.getElementById('showAlternatives').checked,
      tooltipAutoHide: document.getElementById('tooltipAutoHide').checked,
      enableTTS: document.getElementById('enableTTS').checked
    };

    await chrome.storage.sync.set(settings);
    this.showToast('Einstellungen gespeichert');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'sidepanel-translate') {
        document.getElementById('sourceText').value = request.text;
        document.getElementById('charCount').textContent = request.text.length;
        this.translate();
      }
    });
  }

  speak(text, lang) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLangCode(lang);
    speechSynthesis.speak(utterance);
  }

  getLangCode(lang) {
    const codes = {
      'de': 'de-DE', 'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES',
      'it': 'it-IT', 'pt': 'pt-PT', 'nl': 'nl-NL', 'pl': 'pl-PL',
      'ru': 'ru-RU', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
      'ar': 'ar-SA', 'tr': 'tr-TR'
    };
    return codes[lang] || 'en-US';
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    if (diff < 604800000) return `vor ${Math.floor(diff / 86400000)} Tagen`;

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
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1F2937;
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 1000;
      animation: fadeInOut 2s ease forwards;
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }
}

// CSS für Toast Animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }
`;
document.head.appendChild(style);

// Initialisieren
new SidePanelController();

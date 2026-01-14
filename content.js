// Content Script - Smart Web Translator v3.0
// Mit LocalStorage Cache, Pin-Funktion, Hover-Original, Toggle
// NEU: Plain-Text Support (RFC, .txt, Pre-Only Seiten)

class SmartTranslator {
  constructor() {
    this.settings = {};
    this.originalTexts = new Map();
    this.translatedTexts = new Map();
    this.isTranslated = false;
    this.translationMode = null;
    this.selectionIcon = null;
    this.tooltip = null;
    this.pinnedTooltips = [];
    this.progressOverlay = null;
    this.cacheIndicator = null;
    this.pageUrl = window.location.href;
    this.cacheKey = this.generateCacheKey();

    this.init();
  }

  generateCacheKey() {
    // Erzeuge einen eindeutigen Key für diese Seite
    return 'smt_cache_' + btoa(window.location.hostname + window.location.pathname).replace(/[^a-zA-Z0-9]/g, '').slice(0, 50);
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.checkForCachedTranslation();

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    chrome.storage.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        this.settings[key] = newValue;
      }
    });
  }

  async loadSettings() {
    this.settings = await chrome.storage.sync.get([
      'serviceUrl', 'apiKey', 'sourceLang', 'targetLang',
      'showSelectionIcon', 'selectionIconDelay', 'tooltipPosition',
      'tooltipAutoHide', 'tooltipAutoHideDelay', 'enableDoubleClick',
      'showOriginalInTooltip', 'showAlternatives', 'enableTTS',
      'skipCodeBlocks', 'skipBlockquotes', 'useTabsForAlternatives',
      'simplifyPdfExport', 'fixInlineSpacing', 'tabWordThreshold',
      // LM Studio Settings
      'apiType', 'lmStudioUrl', 'lmStudioModel', 'lmStudioContext'
    ]);

    this.settings.serviceUrl = this.settings.serviceUrl || 'http://localhost:5000/translate';
    this.settings.targetLang = this.settings.targetLang || 'de';
    this.settings.sourceLang = this.settings.sourceLang || 'auto';
    this.settings.showSelectionIcon = this.settings.showSelectionIcon !== false;
    this.settings.selectionIconDelay = this.settings.selectionIconDelay || 200;
    this.settings.tooltipAutoHideDelay = this.settings.tooltipAutoHideDelay || 5000;
    this.settings.skipCodeBlocks = this.settings.skipCodeBlocks !== false;
    this.settings.skipBlockquotes = this.settings.skipBlockquotes !== false;
    this.settings.useTabsForAlternatives = this.settings.useTabsForAlternatives !== false;
    this.settings.simplifyPdfExport = this.settings.simplifyPdfExport || false;
    this.settings.fixInlineSpacing = this.settings.fixInlineSpacing !== false;
    this.settings.tabWordThreshold = this.settings.tabWordThreshold || 20;
    this.settings.apiType = this.settings.apiType || 'libretranslate';
  }

  // === Cache Management ===
  async checkForCachedTranslation() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && data.translations && Object.keys(data.translations).length > 0) {
          this.showCacheIndicator();
        }
      }
    } catch (e) {
      console.warn('Cache check error:', e);
    }
  }

  showCacheIndicator() {
    if (this.cacheIndicator) return;

    this.cacheIndicator = document.createElement('div');
    this.cacheIndicator.className = 'smt-ui smt-cache-indicator';
    this.cacheIndicator.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      <span>Übersetzung verfügbar</span>
    `;
    this.cacheIndicator.title = 'Gecachte Übersetzung für diese Seite verfügbar';

    this.cacheIndicator.addEventListener('click', () => {
      this.loadCachedTranslation();
      this.hideCacheIndicator();
    });

    document.body.appendChild(this.cacheIndicator);

    requestAnimationFrame(() => {
      this.cacheIndicator?.classList.add('smt-visible');
    });

    // Nach 10 Sekunden ausblenden
    setTimeout(() => {
      this.hideCacheIndicator();
    }, 10000);
  }

  hideCacheIndicator() {
    if (this.cacheIndicator) {
      this.cacheIndicator.classList.remove('smt-visible');
      setTimeout(() => {
        this.cacheIndicator?.remove();
        this.cacheIndicator = null;
      }, 300);
    }
  }

  saveToCache(translations) {
    try {
      const data = {
        url: this.pageUrl,
        timestamp: Date.now(),
        targetLang: this.settings.targetLang,
        translations: translations
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Cache save error:', e);
    }
  }

  loadCachedTranslation() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return false;

      const data = JSON.parse(cached);
      if (!data.translations) return false;

      // Wende gecachte Übersetzungen an
      this.applyCachedTranslations(data.translations);
      this.showNotification('Gecachte Übersetzung geladen', 'success');
      return true;
    } catch (e) {
      console.warn('Cache load error:', e);
      return false;
    }
  }

  applyCachedTranslations(translations) {
    const textNodes = this.findTranslatableTextNodes();

    textNodes.forEach(node => {
      const originalText = node.textContent.trim();
      const hash = this.hashText(originalText);

      if (translations[hash]) {
        this.originalTexts.set(node, {
          text: originalText,
          element: node.parentElement
        });
        this.translatedTexts.set(node, translations[hash]);

        // Wrapper für Hover-Effekt erstellen
        this.wrapWithHoverOriginal(node, originalText, translations[hash]);
      }
    });

    this.isTranslated = true;
    this.translationMode = 'replace';
  }

  hashText(text) {
    // Einfacher Hash für Text-Identifikation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h' + Math.abs(hash).toString(36);
  }

  getCacheSize() {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('smt_cache_')) {
        const value = localStorage.getItem(key);
        totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16
      }
    }
    return totalSize;
  }

  getCacheInfo() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('smt_cache_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          entries.push({
            key,
            url: data.url,
            timestamp: data.timestamp,
            size: (key.length + JSON.stringify(data).length) * 2,
            count: Object.keys(data.translations || {}).length
          });
        } catch (e) {}
      }
    }
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  clearCache(key = null) {
    if (key) {
      localStorage.removeItem(key);
    } else {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('smt_cache_')) {
          keys.push(k);
        }
      }
      keys.forEach(k => localStorage.removeItem(k));
    }
  }

  // === Event Listeners ===
  setupEventListeners() {
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideSelectionIcon();
        this.hideTooltip();
      }
    });

    document.addEventListener('scroll', () => {
      this.hideSelectionIcon();
    }, { passive: true });
  }

  handleMouseDown(e) {
    if (!e.target.closest('.smt-ui')) {
      this.hideSelectionIcon();
      // Gepinnte Tooltips nicht schließen!
      if (!e.target.closest('.smt-tooltip.smt-pinned') && this.tooltip && !this.tooltip.classList.contains('smt-pinned')) {
        this.hideTooltip();
      }
    }
  }

  handleMouseUp(e) {
    if (e.target.closest('.smt-ui')) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0 && this.settings.showSelectionIcon) {
        this.showSelectionIcon(selection, e);
      } else {
        this.hideSelectionIcon();
      }
    }, this.settings.selectionIconDelay);
  }

  handleDoubleClick(e) {
    if (!this.settings.enableDoubleClick) return;
    if (e.target.closest('.smt-ui')) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.translateSelection(text);
    }
  }

  // === Selection Icon ===
  showSelectionIcon(selection, mouseEvent) {
    this.hideSelectionIcon();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // WICHTIG: Text und Position JETZT speichern, bevor die Selection verloren geht
    const selectedText = selection.toString().trim();
    const savedPosition = {
      top: rect.bottom + window.scrollY + 10,
      left: rect.left + (rect.width / 2)
    };

    this.selectionIcon = document.createElement('div');
    this.selectionIcon.className = 'smt-ui smt-selection-icon';
    this.selectionIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    `;

    const iconSize = 32;
    let left = rect.right + 8;
    let top = rect.top + window.scrollY - 4;

    if (left + iconSize > window.innerWidth) {
      left = rect.left - iconSize - 8;
    }

    this.selectionIcon.style.cssText = `position: absolute; left: ${left}px; top: ${top}px;`;

    this.selectionIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Verwende die GESPEICHERTEN Werte, nicht die aktuelle Selection
      if (selectedText) {
        this.translateSelection(selectedText, savedPosition);
      }
      this.hideSelectionIcon();
    });

    document.body.appendChild(this.selectionIcon);
    requestAnimationFrame(() => this.selectionIcon?.classList.add('smt-visible'));
  }

  hideSelectionIcon() {
    if (this.selectionIcon) {
      this.selectionIcon.remove();
      this.selectionIcon = null;
    }
  }

  // === Tooltip mit Pin-Funktion ===
  showTooltip(original, translated, alternatives = [], isPinned = false, savedPosition = null) {
    // Vorherigen nicht-gepinnten Tooltip entfernen
    if (this.tooltip && !this.tooltip.classList.contains('smt-pinned')) {
      this.tooltip.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'smt-ui smt-tooltip' + (isPinned ? ' smt-pinned' : '');

    const hasAlternatives = this.settings.showAlternatives && alternatives?.length > 0;
    
    // Wörter zählen
    const wordCount = original ? original.trim().split(/\s+/).length : 0;
    const tabThreshold = this.settings.tabWordThreshold || 20;
    
    // Tabs nur bei langen Texten (> threshold Wörter) UND wenn Alternativen vorhanden
    const useTabs = hasAlternatives && this.settings.useTabsForAlternatives && wordCount > tabThreshold;

    // Aktionsleiste OBEN
    let content = `
      <div class="smt-tooltip-actions">
        <button class="smt-action smt-pin" title="${isPinned ? 'Lösen' : 'Anpinnen'}">
          <svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        </button>
        <button class="smt-action smt-copy" title="Kopieren">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        ${this.settings.enableTTS ? `
        <button class="smt-action smt-speak" title="Vorlesen">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
        ` : ''}
        <button class="smt-action smt-close" title="Schließen">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `;

    // Original anzeigen
    if (this.settings.showOriginalInTooltip && original) {
      content += `<div class="smt-tooltip-original">${this.escapeHtml(original)}</div>`;
    }

    // Mit Tabs für Alternativen (bei längeren Texten)
    if (useTabs) {
      content += `<div class="smt-tooltip-tabs">`;
      content += `<button class="smt-tab active" data-index="0">1</button>`;
      alternatives.slice(0, 3).forEach((_, i) => {
        content += `<button class="smt-tab" data-index="${i + 1}">${i + 2}</button>`;
      });
      content += `</div>`;

      content += `<div class="smt-tooltip-content">`;
      content += `<div class="smt-tab-panel active" data-index="0">${this.escapeHtml(translated)}</div>`;
      alternatives.slice(0, 3).forEach((alt, i) => {
        content += `<div class="smt-tab-panel" data-index="${i + 1}">${this.escapeHtml(alt)}</div>`;
      });
      content += `</div>`;
    } else {
      // Standard-Layout ohne Tabs
      content += `<div class="smt-tooltip-content">`;
      content += `<div class="smt-translated">${this.escapeHtml(translated)}</div>`;

      if (hasAlternatives) {
        content += `<div class="smt-alternatives">`;
        alternatives.slice(0, 3).forEach(alt => {
          content += `<span class="smt-alt">${this.escapeHtml(alt)}</span>`;
        });
        content += `</div>`;
      }
      content += `</div>`;
    }

    tooltip.innerHTML = content;

    // Position - verwende übergebene Position oder berechne aus Selection
    let top, left;

    if (savedPosition) {
      top = savedPosition.top;
      left = savedPosition.left;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        top = rect.bottom + window.scrollY + 10;
        left = rect.left + (rect.width / 2);
      } else {
        top = window.innerHeight / 3 + window.scrollY;
        left = window.innerWidth / 2;
      }
    }

    tooltip.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; transform: translateX(-50%);`;

    document.body.appendChild(tooltip);

    // Tab-Switching
    if (useTabs) {
      tooltip.querySelectorAll('.smt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const index = tab.dataset.index;
          tooltip.querySelectorAll('.smt-tab').forEach(t => t.classList.remove('active'));
          tooltip.querySelectorAll('.smt-tab-panel').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          tooltip.querySelector(`.smt-tab-panel[data-index="${index}"]`)?.classList.add('active');
        });
      });
    }

    // Alternative klickbar zum Kopieren
    tooltip.querySelectorAll('.smt-alt').forEach(alt => {
      alt.addEventListener('click', () => {
        navigator.clipboard.writeText(alt.textContent);
        this.showNotification('Alternative kopiert!', 'success');
      });
    });

    // Event Listener für Buttons
    tooltip.querySelector('.smt-pin').addEventListener('click', () => {
      tooltip.classList.toggle('smt-pinned');
      const pinBtn = tooltip.querySelector('.smt-pin');
      pinBtn.title = tooltip.classList.contains('smt-pinned') ? 'Lösen' : 'Anpinnen';
      if (tooltip.classList.contains('smt-pinned')) {
        this.pinnedTooltips.push(tooltip);
      } else {
        this.pinnedTooltips = this.pinnedTooltips.filter(t => t !== tooltip);
      }
    });

    tooltip.querySelector('.smt-copy').addEventListener('click', () => {
      // Bei Tabs: aktiven Tab kopieren
      const activePanel = tooltip.querySelector('.smt-tab-panel.active');
      const textToCopy = activePanel ? activePanel.textContent : translated;
      navigator.clipboard.writeText(textToCopy);
      this.showNotification('Kopiert!', 'success');
    });

    tooltip.querySelector('.smt-speak')?.addEventListener('click', () => {
      const activePanel = tooltip.querySelector('.smt-tab-panel.active');
      const textToSpeak = activePanel ? activePanel.textContent : translated;
      this.speak(textToSpeak);
    });

    tooltip.querySelector('.smt-close').addEventListener('click', () => {
      tooltip.classList.remove('smt-visible');
      setTimeout(() => tooltip.remove(), 200);
      this.pinnedTooltips = this.pinnedTooltips.filter(t => t !== tooltip);
    });

    // Draggable für gepinnte Tooltips
    this.makeDraggable(tooltip);

    if (!isPinned) {
      this.tooltip = tooltip;
    }

    requestAnimationFrame(() => tooltip.classList.add('smt-visible'));
    this.adjustTooltipPosition(tooltip);

    // Auto-Hide nur wenn nicht gepinnt
    if (!isPinned && this.settings.tooltipAutoHide) {
      setTimeout(() => {
        if (tooltip && !tooltip.classList.contains('smt-pinned')) {
          tooltip.classList.remove('smt-visible');
          setTimeout(() => tooltip.remove(), 200);
        }
      }, this.settings.tooltipAutoHideDelay);
    }
  }

  makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const header = element.querySelector('.smt-tooltip-content') || element;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.smt-tooltip-actions')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      startLeft = rect.left + window.scrollX;
      startTop = rect.top + window.scrollY;
      element.style.transform = 'none';
      element.style.left = startLeft + 'px';
      element.style.top = startTop + 'px';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = (startLeft + dx) + 'px';
      element.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  adjustTooltipPosition(tooltip) {
    const rect = tooltip.getBoundingClientRect();
    const padding = 10;

    if (rect.right > window.innerWidth - padding) {
      tooltip.style.left = (parseFloat(tooltip.style.left) - (rect.right - window.innerWidth + padding)) + 'px';
    }
    if (rect.left < padding) {
      tooltip.style.left = (parseFloat(tooltip.style.left) + (padding - rect.left)) + 'px';
    }
  }

  hideTooltip() {
    if (this.tooltip && !this.tooltip.classList.contains('smt-pinned')) {
      this.tooltip.classList.remove('smt-visible');
      setTimeout(() => {
        this.tooltip?.remove();
        this.tooltip = null;
      }, 200);
    }
  }

  // === Übersetzungsfunktionen ===
  async translateSelection(text, position = null) {
    if (!text || text.trim().length === 0) return;

    // Zeige Loading-Spinner sofort
    this.showLoadingTooltip(position);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text.trim(),
        source: this.settings.sourceLang,
        target: this.settings.targetLang
      });

      // Entferne Loading-Tooltip
      this.hideLoadingTooltip();

      if (result.success) {
        this.showTooltip(text.trim(), result.translatedText, result.alternatives, false, position);
      } else {
        this.showNotification(result.error || 'Übersetzungsfehler', 'error');
      }
    } catch (error) {
      this.hideLoadingTooltip();
      this.showNotification('Verbindungsfehler', 'error');
    }
  }

  // Loading-Spinner Tooltip
  showLoadingTooltip(position) {
    this.hideLoadingTooltip();
    
    const loader = document.createElement('div');
    loader.className = 'smt-ui smt-loading-tooltip';
    loader.innerHTML = `
      <div class="smt-spinner"></div>
      <span>Übersetze...</span>
    `;

    let top, left;
    if (position) {
      top = position.top;
      left = position.left;
    } else {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        top = rect.bottom + window.scrollY + 10;
        left = rect.left + (rect.width / 2);
      } else {
        top = window.innerHeight / 3 + window.scrollY;
        left = window.innerWidth / 2;
      }
    }

    loader.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; transform: translateX(-50%);`;
    document.body.appendChild(loader);
    this._loadingTooltip = loader;
    
    requestAnimationFrame(() => loader.classList.add('smt-visible'));
  }

  hideLoadingTooltip() {
    if (this._loadingTooltip) {
      this._loadingTooltip.remove();
      this._loadingTooltip = null;
    }
  }

  // === Seitenübersetzung ===
  async translatePage(mode = 'replace') {
    if (this.isTranslated) {
      this.toggleTranslation();
      return;
    }

    // API-Typ laden für Progress-Anzeige
    const apiSettings = await chrome.storage.sync.get(['apiType', 'lmStudioContext']);
    this.settings.apiType = apiSettings.apiType || 'libretranslate';
    this.settings.lmStudioContext = apiSettings.lmStudioContext || 'general';

    this.showProgress(true);
    this.translationMode = mode;

    try {
      // Prüfe ob Plain-Text Seite
      const isPlainText = this.detectPlainTextPage();
      
      let textNodes;
      if (isPlainText) {
        textNodes = this.handlePlainTextPage();
      } else {
        // Leerzeichen bei Inline-Tags normalisieren
        if (this.settings.fixInlineSpacing) {
          this.normalizeInlineSpacing();
        }
        textNodes = this.findTranslatableTextNodes();
      }

      const total = textNodes.length;
      let translated = 0;
      const cacheTranslations = {};

      // Batch-Verarbeitung (bewährt)
      const batchSize = 5;
      for (let i = 0; i < textNodes.length; i += batchSize) {
        const batch = textNodes.slice(i, i + batchSize);

        await Promise.all(batch.map(async (node) => {
          const originalText = node.textContent.trim();
          if (originalText.length < 2) return;

          try {
            const result = await chrome.runtime.sendMessage({
              action: 'translate',
              text: originalText,
              source: this.settings.sourceLang,
              target: this.settings.targetLang
            });

            if (result.success && result.translatedText !== originalText) {
              const hash = this.hashText(originalText);
              cacheTranslations[hash] = result.translatedText;

              this.originalTexts.set(node, {
                text: originalText,
                element: node.parentElement
              });
              this.translatedTexts.set(node, result.translatedText);

              if (mode === 'bilingual') {
                this.insertBilingualTranslation(node, originalText, result.translatedText);
              } else {
                this.wrapWithHoverOriginal(node, originalText, result.translatedText);
              }
            }
          } catch (e) {
            console.warn('Übersetzungsfehler:', e);
          }

          translated++;
          this.updateProgress(translated, total);
        }));

        await new Promise(r => setTimeout(r, 50));
      }

      // Cache speichern
      this.saveToCache(cacheTranslations);

      this.isTranslated = true;
      this.showProgress(false);
      this.showNotification(`${translated} Textblöcke übersetzt`, 'success');

    } catch (error) {
      this.showProgress(false);
      this.showNotification('Fehler bei Seitenübersetzung', 'error');
    }
  }

  // Erkennt Plain-Text Seiten (RFC, .txt, Pre-Only)
  detectPlainTextPage() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    
    // URL-basierte Erkennung
    if (url.endsWith('.txt') || url.endsWith('.text')) return true;
    
    // RFC-Seiten
    if (hostname.includes('ietf.org') || hostname.includes('rfc-editor.org')) return true;
    if (url.includes('/rfc/') || url.includes('/doc/rfc')) return true;
    
    // Content-Type Check (wenn verfügbar)
    const contentType = document.contentType || '';
    if (contentType.includes('text/plain')) return true;
    
    // DOM-basierte Erkennung: Nur ein Pre-Element mit viel Text?
    const body = document.body;
    const preElements = body.querySelectorAll('pre');
    
    if (preElements.length === 1) {
      const pre = preElements[0];
      const preText = pre.textContent.length;
      const bodyText = body.textContent.length;
      // Wenn Pre mehr als 80% des Seiteninhalts ausmacht
      if (preText > 1000 && preText / bodyText > 0.8) return true;
    }
    
    // Keine anderen Block-Elemente außer Pre?
    const blocks = body.querySelectorAll('p, div, article, section, h1, h2, h3, h4, h5, h6');
    if (blocks.length < 3 && preElements.length > 0) return true;
    
    return false;
  }

  // Behandelt Plain-Text Seiten speziell
  handlePlainTextPage() {
    const preElements = document.querySelectorAll('pre');
    const textNodes = [];
    
    preElements.forEach(pre => {
      // Pre-Element in logische Abschnitte aufteilen
      const text = pre.textContent;
      const paragraphs = this.splitIntoParagraphs(text);
      
      // Erstelle für jeden Absatz einen virtuellen Container
      pre.innerHTML = ''; // Leeren
      
      paragraphs.forEach(para => {
        if (para.trim().length < 3) {
          // Leerzeilen beibehalten
          pre.appendChild(document.createTextNode(para + '\n\n'));
          return;
        }
        
        const span = document.createElement('span');
        span.className = 'smt-pre-paragraph';
        span.textContent = para;
        pre.appendChild(span);
        pre.appendChild(document.createTextNode('\n\n'));
        
        // TextNode aus dem Span für Übersetzung
        if (span.firstChild) {
          textNodes.push(span.firstChild);
        }
      });
    });
    
    // Falls keine Pre-Elemente, versuche Body-Text
    if (textNodes.length === 0) {
      return this.findTranslatableTextNodes();
    }
    
    return textNodes;
  }

  // Teilt Text in logische Absätze (für Plain-Text/RFC)
  splitIntoParagraphs(text) {
    // Erkenne Absätze anhand von Leerzeilen
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs.map(p => p.trim()).filter(p => p.length > 0);
  }

  wrapWithHoverOriginal(node, original, translated) {
    const parent = node.parentElement;
    if (!parent) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'smt-translated-text';
    wrapper.textContent = translated;
    wrapper.dataset.original = original;
    wrapper.dataset.translated = translated;
    wrapper.title = original; // Native Tooltip als Fallback

    // Hover-Event für schönen Tooltip
    wrapper.addEventListener('mouseenter', (e) => {
      this.showOriginalTooltip(e.target, original);
    });

    wrapper.addEventListener('mouseleave', () => {
      this.hideOriginalTooltip();
    });

    node.parentNode.replaceChild(wrapper, node);
  }

  showOriginalTooltip(element, original) {
    this.hideOriginalTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'smt-ui smt-original-tooltip';
    tooltip.textContent = original;

    const rect = element.getBoundingClientRect();
    tooltip.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top - 8}px;
      transform: translateY(-100%);
    `;

    document.body.appendChild(tooltip);
    this._originalTooltip = tooltip;
    requestAnimationFrame(() => tooltip.classList.add('smt-visible'));
  }

  hideOriginalTooltip() {
    if (this._originalTooltip) {
      this._originalTooltip.remove();
      this._originalTooltip = null;
    }
  }

  insertBilingualTranslation(node, original, translated) {
    const parent = node.parentElement;
    if (!parent) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'smt-bilingual-wrapper';

    const originalSpan = document.createElement('span');
    originalSpan.className = 'smt-bilingual-original';
    originalSpan.textContent = original;

    const translatedSpan = document.createElement('span');
    translatedSpan.className = 'smt-bilingual-translated';
    translatedSpan.textContent = translated;

    wrapper.appendChild(originalSpan);
    wrapper.appendChild(translatedSpan);

    node.parentNode.replaceChild(wrapper, node);
  }

  toggleTranslation() {
    if (!this.isTranslated) return;

    document.querySelectorAll('.smt-translated-text').forEach(el => {
      const current = el.textContent;
      const original = el.dataset.original;
      const translated = el.dataset.translated;

      if (current === translated) {
        el.textContent = original;
        el.classList.add('smt-showing-original');
      } else {
        el.textContent = translated;
        el.classList.remove('smt-showing-original');
      }
    });

    this.showNotification('Ansicht gewechselt', 'info');
  }

  restorePage() {
    document.querySelectorAll('.smt-translated-text').forEach(el => {
      const textNode = document.createTextNode(el.dataset.original);
      el.parentNode.replaceChild(textNode, el);
    });

    document.querySelectorAll('.smt-bilingual-wrapper').forEach(el => {
      const original = el.querySelector('.smt-bilingual-original');
      if (original) {
        const textNode = document.createTextNode(original.textContent);
        el.parentNode.replaceChild(textNode, el);
      }
    });

    this.originalTexts.clear();
    this.translatedTexts.clear();
    this.isTranslated = false;
    this.translationMode = null;
    this.showNotification('Originaltexte wiederhergestellt', 'info');
  }

  findTranslatableTextNodes() {
    const skipCode = this.settings.skipCodeBlocks !== false;
    const skipQuotes = this.settings.skipBlockquotes !== false;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName.toLowerCase();
          
          // Immer ausschließen: Scripts, Styles, Formulare, SVG
          const alwaysExcluded = ['script', 'style', 'noscript', 'textarea', 'input', 'svg'];
          if (alwaysExcluded.includes(tag)) return NodeFilter.FILTER_REJECT;

          // Code-Elemente (konfigurierbar)
          if (skipCode) {
            const codeTags = ['code', 'pre', 'kbd', 'samp', 'var'];
            if (codeTags.includes(tag)) return NodeFilter.FILTER_REJECT;
            
            // Elemente innerhalb von Code-Containern
            if (parent.closest('code, pre, kbd, samp')) return NodeFilter.FILTER_REJECT;
            
            // Typische Code-Klassen (GitHub, StackOverflow, Prism, Highlight.js, etc.)
            const codeClasses = [
              'highlight', 'hljs', 'prism', 'codehilite', 'syntaxhighlighter',
              'code-block', 'codeblock', 'sourceCode', 'source-code',
              'language-', 'lang-', 'brush:', 'prettyprint',
              'monaco-editor', 'ace_editor', 'CodeMirror'
            ];
            
            const hasCodeClass = codeClasses.some(cls => 
              parent.className?.includes?.(cls) || 
              parent.closest(`[class*="${cls}"]`)
            );
            if (hasCodeClass) return NodeFilter.FILTER_REJECT;

            // data-Attribute für Code
            if (parent.closest('[data-language], [data-lang], [data-code]')) {
              return NodeFilter.FILTER_REJECT;
            }
          }

          // Zitate (konfigurierbar)
          if (skipQuotes) {
            if (tag === 'blockquote') return NodeFilter.FILTER_REJECT;
            if (parent.closest('blockquote')) return NodeFilter.FILTER_REJECT;
          }

          // Eigene UI-Elemente
          if (parent.closest('.smt-ui')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.smt-translated-text')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.smt-bilingual-wrapper')) return NodeFilter.FILTER_REJECT;

          const text = node.textContent.trim();
          if (text.length < 3 || /^[\s\d\W]*$/.test(text)) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let node;
    while (node = walker.nextNode()) nodes.push(node);
    return nodes;
  }

  // === Export Funktionen ===
  
  // Normalisiert Leerzeichen bei Inline-Tag-Wechseln im DOM
  // Muss VOR findTranslatableTextNodes aufgerufen werden
  normalizeInlineSpacing() {
    const inlineTags = ['strong', 'b', 'em', 'i', 'a', 'span', 'mark', 'u', 's', 'sub', 'sup', 'small', 'code', 'abbr', 'cite', 'q'];
    
    inlineTags.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        // Überspringe unsere eigenen UI-Elemente
        if (el.closest('.smt-ui')) return;
        
        // Prüfe vorherigen Textknoten
        const prev = el.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE) {
          const text = prev.textContent;
          // Wenn Text nicht mit Leerzeichen/Zeilenumbruch endet UND nicht leer ist
          if (text.length > 0 && /[^\s]$/.test(text)) {
            prev.textContent = text + ' ';
          }
        }
        
        // Prüfe nachfolgenden Textknoten
        const next = el.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) {
          const text = next.textContent;
          // Wenn Text nicht mit Leerzeichen/Zeilenumbruch beginnt UND nicht leer ist
          // UND nicht mit Satzzeichen beginnt
          if (text.length > 0 && /^[^\s.,;:!?)\]}"']/.test(text)) {
            next.textContent = ' ' + text;
          }
        }
      });
    });
  }

  // Leerzeichen-Fix für Inline-Tags (President<strong>Donald Trump</strong>said -> President Donald Trump said)
  fixInlineTagSpacing(element) {
    if (!element) return '';
    
    const clone = element.cloneNode(true);
    
    // Alle Inline-Tags durchgehen
    const inlineTags = ['strong', 'b', 'em', 'i', 'a', 'span', 'mark', 'u', 's', 'sub', 'sup', 'small'];
    
    inlineTags.forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => {
        // Prüfe ob vor dem Element ein Zeichen ohne Leerzeichen steht
        const prev = el.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE) {
          const text = prev.textContent;
          if (text.length > 0 && !/\s$/.test(text)) {
            prev.textContent = text + ' ';
          }
        }
        
        // Prüfe ob nach dem Element ein Zeichen ohne Leerzeichen steht
        const next = el.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) {
          const text = next.textContent;
          if (text.length > 0 && !/^\s/.test(text)) {
            next.textContent = ' ' + text;
          }
        }
      });
    });
    
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  // Vereinfachten Text aus Element extrahieren
  extractSimplifiedContent(rootElement) {
    const result = {
      title: document.title,
      content: []
    };

    // Domain-Strategie verwenden falls verfügbar
    let mainSelector = 'body';
    if (window.DomainStrategies) {
      const strategy = window.DomainStrategies.getStrategy(window.location.href);
      mainSelector = strategy.getMainContentSelector();
    }

    const mainContent = document.querySelector(mainSelector) || rootElement;
    
    const processNode = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        
        // Überspringen
        if (['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'svg'].includes(tag)) {
          return;
        }
        if (node.closest('.smt-ui')) return;
        
        // Überschriften
        if (/^h[1-6]$/.test(tag)) {
          const level = parseInt(tag[1]);
          const text = this.fixInlineTagSpacing(node);
          if (text) {
            result.content.push({ type: 'heading', level, text });
          }
          return;
        }
        
        // Absätze
        if (tag === 'p') {
          const text = this.fixInlineTagSpacing(node);
          if (text && text.length > 10) {
            result.content.push({ type: 'paragraph', text });
          }
          return;
        }
        
        // Listen
        if (tag === 'ul' || tag === 'ol') {
          const items = Array.from(node.querySelectorAll(':scope > li'))
            .map(li => this.fixInlineTagSpacing(li))
            .filter(t => t.length > 0);
          if (items.length > 0) {
            result.content.push({ type: 'list', ordered: tag === 'ol', items });
          }
          return;
        }
        
        // Code-Blöcke
        if (tag === 'pre' || (tag === 'code' && node.parentElement?.tagName !== 'PRE')) {
          result.content.push({ type: 'code', text: node.textContent });
          return;
        }
        
        // Zitate
        if (tag === 'blockquote') {
          result.content.push({ type: 'quote', text: this.fixInlineTagSpacing(node) });
          return;
        }
        
        // Bilder
        if (tag === 'img') {
          result.content.push({ 
            type: 'image', 
            src: node.src, 
            alt: node.alt || '' 
          });
          return;
        }
        
        // Rekursiv für Container
        if (['div', 'section', 'article', 'main'].includes(tag)) {
          node.childNodes.forEach(child => processNode(child));
        }
      }
    };

    mainContent.childNodes.forEach(child => processNode(child));
    return result;
  }

  // Export als Markdown
  exportAsMarkdown() {
    const data = this.extractSimplifiedContent(document.body);
    let md = `# ${data.title}\n\n`;
    
    data.content.forEach(item => {
      switch (item.type) {
        case 'heading':
          md += `${'#'.repeat(item.level)} ${item.text}\n\n`;
          break;
        case 'paragraph':
          md += `${item.text}\n\n`;
          break;
        case 'list':
          item.items.forEach((li, i) => {
            md += item.ordered ? `${i + 1}. ${li}\n` : `- ${li}\n`;
          });
          md += '\n';
          break;
        case 'code':
          md += `\`\`\`\n${item.text}\n\`\`\`\n\n`;
          break;
        case 'quote':
          md += `> ${item.text}\n\n`;
          break;
        case 'image':
          md += `![${item.alt}](${item.src})\n\n`;
          break;
      }
    });

    this.downloadFile(md, 'translation.md', 'text/markdown');
    this.showNotification('Markdown exportiert', 'success');
  }

  // Export als Text mit Original/Übersetzung
  exportAsText(bilingual = false) {
    const data = this.extractSimplifiedContent(document.body);
    let txt = `${data.title}\n${'='.repeat(data.title.length)}\n\n`;
    
    data.content.forEach(item => {
      switch (item.type) {
        case 'heading':
          txt += `\n${item.text}\n${'-'.repeat(item.text.length)}\n\n`;
          break;
        case 'paragraph':
          txt += `${item.text}\n\n`;
          break;
        case 'list':
          item.items.forEach((li, i) => {
            txt += `  ${item.ordered ? `${i + 1}.` : '•'} ${li}\n`;
          });
          txt += '\n';
          break;
        case 'code':
          txt += `---CODE---\n${item.text}\n---/CODE---\n\n`;
          break;
        case 'quote':
          txt += `"${item.text}"\n\n`;
          break;
      }
    });

    this.downloadFile(txt, 'translation.txt', 'text/plain');
    this.showNotification('Text exportiert', 'success');
  }

  // Export als DOCX (HTML-basiert, Word-kompatibel)
  exportAsDocx() {
    const data = this.extractSimplifiedContent(document.body);
    
    // Word-kompatibles HTML mit XML-Header
    let html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(data.title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 2.5cm; }
    h1 { font-size: 24pt; font-weight: bold; margin-bottom: 18pt; border-bottom: 1pt solid #333; padding-bottom: 6pt; }
    h2 { font-size: 18pt; font-weight: bold; margin-top: 24pt; margin-bottom: 12pt; }
    h3 { font-size: 14pt; font-weight: bold; margin-top: 18pt; margin-bottom: 10pt; }
    p { margin-bottom: 12pt; text-align: justify; }
    pre, code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 8pt; border: 1pt solid #ddd; }
    pre { display: block; white-space: pre-wrap; margin: 12pt 0; }
    blockquote { border-left: 3pt solid #ccc; padding-left: 12pt; margin: 12pt 0; font-style: italic; color: #555; }
    ul, ol { margin-bottom: 12pt; padding-left: 24pt; }
    li { margin-bottom: 6pt; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(data.title)}</h1>
`;

    data.content.forEach(item => {
      switch (item.type) {
        case 'heading':
          html += `<h${item.level}>${this.escapeHtml(item.text)}</h${item.level}>\n`;
          break;
        case 'paragraph':
          html += `<p>${this.escapeHtml(item.text)}</p>\n`;
          break;
        case 'list':
          const tag = item.ordered ? 'ol' : 'ul';
          html += `<${tag}>\n${item.items.map(li => `  <li>${this.escapeHtml(li)}</li>`).join('\n')}\n</${tag}>\n`;
          break;
        case 'code':
          html += `<pre><code>${this.escapeHtml(item.text)}</code></pre>\n`;
          break;
        case 'quote':
          html += `<blockquote>${this.escapeHtml(item.text)}</blockquote>\n`;
          break;
        case 'image':
          html += `<p><img src="${item.src}" alt="${this.escapeHtml(item.alt)}"></p>\n`;
          break;
      }
    });

    html += '</body></html>';

    // Als .doc speichern (Word öffnet HTML mit .doc Endung)
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translation.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showNotification('Word-Dokument exportiert', 'success');
  }

  // Vereinfachter PDF-Export
  async exportAsPdf(simplified = false) {
    if (simplified && this.settings.simplifyPdfExport) {
      // Vereinfachte Version erstellen
      const data = this.extractSimplifiedContent(document.body);
      const printWindow = window.open('', '_blank');
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${data.title}</title>
          <style>
            body {
              font-family: Georgia, 'Times New Roman', serif;
              max-width: 800px;
              margin: 40px auto;
              padding: 20px;
              line-height: 1.8;
              color: #333;
            }
            h1 { font-size: 28px; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; }
            h2 { font-size: 22px; margin-top: 32px; }
            h3 { font-size: 18px; margin-top: 24px; }
            p { margin-bottom: 16px; text-align: justify; }
            pre, code {
              font-family: 'Consolas', 'Monaco', monospace;
              background: #f5f5f5;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            pre { padding: 16px; overflow-x: auto; white-space: pre-wrap; }
            code { padding: 2px 6px; }
            blockquote {
              border-left: 4px solid #ccc;
              margin: 16px 0;
              padding: 8px 16px;
              font-style: italic;
              color: #555;
            }
            ul, ol { margin-bottom: 16px; padding-left: 24px; }
            li { margin-bottom: 8px; }
            img { max-width: 100%; height: auto; margin: 16px 0; }
            @media print {
              body { margin: 0; }
              pre { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${this.escapeHtml(data.title)}</h1>
      `;

      data.content.forEach(item => {
        switch (item.type) {
          case 'heading':
            html += `<h${item.level}>${this.escapeHtml(item.text)}</h${item.level}>`;
            break;
          case 'paragraph':
            html += `<p>${this.escapeHtml(item.text)}</p>`;
            break;
          case 'list':
            const listTag = item.ordered ? 'ol' : 'ul';
            html += `<${listTag}>${item.items.map(li => `<li>${this.escapeHtml(li)}</li>`).join('')}</${listTag}>`;
            break;
          case 'code':
            html += `<pre><code>${this.escapeHtml(item.text)}</code></pre>`;
            break;
          case 'quote':
            html += `<blockquote>${this.escapeHtml(item.text)}</blockquote>`;
            break;
          case 'image':
            html += `<img src="${item.src}" alt="${this.escapeHtml(item.alt)}">`;
            break;
        }
      });

      html += '</body></html>';
      
      printWindow.document.write(html);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      // Standard: aktuelle Seite drucken
      this.showNotification('PDF wird generiert...', 'info');
      await new Promise(r => setTimeout(r, 100));
      window.print();
    }
  }

  // Datei herunterladen
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // === UI Helfer ===
  showProgress(show) {
    if (show) {
      if (!this.progressOverlay) {
        this.progressOverlay = document.createElement('div');
        this.progressOverlay.className = 'smt-ui smt-progress';
        this.progressOverlay.innerHTML = `
          <div class="smt-progress-content">
            <div class="smt-progress-bar"><div class="smt-progress-fill"></div></div>
            <div class="smt-progress-text">Übersetze... 0%</div>
          </div>
        `;
        document.body.appendChild(this.progressOverlay);
      }
      requestAnimationFrame(() => this.progressOverlay?.classList.add('smt-visible'));
    } else {
      if (this.progressOverlay) {
        this.progressOverlay.classList.remove('smt-visible');
        setTimeout(() => {
          this.progressOverlay?.remove();
          this.progressOverlay = null;
        }, 300);
      }
    }
  }

  updateProgress(current, total) {
    if (!this.progressOverlay) return;
    const percent = Math.round((current / total) * 100);
    const fill = this.progressOverlay.querySelector('.smt-progress-fill');
    const text = this.progressOverlay.querySelector('.smt-progress-text');
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `Übersetze... ${percent}% (${current}/${total})`;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `smt-ui smt-notification smt-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add('smt-visible'));

    setTimeout(() => {
      notification.classList.remove('smt-visible');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.settings.ttsLanguage || 'de-DE';
    speechSynthesis.speak(utterance);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === Message Handler ===
  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'getSelection':
        sendResponse({ text: window.getSelection().toString().trim() });
        break;

      case 'showTranslation':
        this.showTooltip(request.original, request.translated, request.alternatives);
        sendResponse({ success: true });
        break;

      case 'showError':
        this.showNotification(request.message, 'error');
        sendResponse({ success: true });
        break;

      case 'translatePage':
        this.translatePage(request.mode || 'replace');
        sendResponse({ success: true });
        break;

      case 'restorePage':
        this.restorePage();
        sendResponse({ success: true });
        break;

      case 'toggleTranslation':
        this.toggleTranslation();
        sendResponse({ success: true });
        break;

      case 'exportPdf':
        this.exportAsPdf(request.simplified);
        sendResponse({ success: true });
        break;

      case 'exportMarkdown':
        this.exportAsMarkdown();
        sendResponse({ success: true });
        break;

      case 'exportText':
        this.exportAsText(request.bilingual);
        sendResponse({ success: true });
        break;

      case 'exportDocx':
        this.exportAsDocx();
        sendResponse({ success: true });
        break;

      case 'loadCachedTranslation':
        const loaded = this.loadCachedTranslation();
        sendResponse({ success: loaded });
        break;

      case 'getCacheInfo':
        sendResponse({
          size: this.getCacheSize(),
          entries: this.getCacheInfo(),
          currentPageHasCache: !!localStorage.getItem(this.cacheKey)
        });
        break;

      case 'clearCache':
        this.clearCache(request.key);
        sendResponse({ success: true });
        break;

      case 'getPageInfo':
        sendResponse({
          isTranslated: this.isTranslated,
          mode: this.translationMode,
          count: this.originalTexts.size,
          hasCache: !!localStorage.getItem(this.cacheKey)
        });
        break;

      case 'translateWordAtCursor':
        this.translateWordAtPosition(request.x, request.y);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false });
    }
  }

  // Wort an Position übersetzen (für Rechtsklick ohne Markierung)
  async translateWordAtPosition(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return;

    // Finde das Wort an der Position
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return;

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent;
    const offset = range.startOffset;

    // Wortgrenzen finden
    let start = offset;
    let end = offset;

    // Nach links
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    // Nach rechts
    while (end < text.length && /\w/.test(text[end])) end++;

    const word = text.substring(start, end).trim();
    if (!word || word.length < 2) return;

    // Position für Tooltip
    const rect = element.getBoundingClientRect();
    const savedPosition = {
      top: rect.bottom + window.scrollY + 10,
      left: x
    };

    // Übersetzen
    await this.translateSelection(word, savedPosition);
  }
}

// Initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SmartTranslator());
} else {
  new SmartTranslator();
}

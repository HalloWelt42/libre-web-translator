// Content Script - Smart Web Translator v2.1
// Mit LocalStorage Cache, Pin-Funktion, Hover-Original, Toggle

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
      'showOriginalInTooltip', 'showAlternatives', 'enableTTS'
    ]);

    this.settings.serviceUrl = this.settings.serviceUrl || 'http://localhost:5000/translate';
    this.settings.targetLang = this.settings.targetLang || 'de';
    this.settings.sourceLang = this.settings.sourceLang || 'auto';
    this.settings.showSelectionIcon = this.settings.showSelectionIcon !== false;
    this.settings.selectionIconDelay = this.settings.selectionIconDelay || 200;
    this.settings.tooltipAutoHideDelay = this.settings.tooltipAutoHideDelay || 5000;
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

    let content = `<div class="smt-tooltip-content">`;

    if (this.settings.showOriginalInTooltip && original) {
      content += `<div class="smt-original">${this.escapeHtml(original)}</div>`;
    }

    content += `<div class="smt-translated">${this.escapeHtml(translated)}</div>`;

    if (this.settings.showAlternatives && alternatives?.length > 0) {
      content += `<div class="smt-alternatives">`;
      alternatives.slice(0, 3).forEach(alt => {
        content += `<span class="smt-alt">${this.escapeHtml(alt)}</span>`;
      });
      content += `</div>`;
    }

    content += `</div>`;

    // Aktionsleiste mit Pin
    content += `
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

    tooltip.innerHTML = content;

    // Position - verwende übergebene Position oder berechne aus Selection
    let top, left;

    if (savedPosition) {
      // Verwende die gespeicherte Position
      top = savedPosition.top;
      left = savedPosition.left;
    } else {
      // Fallback: versuche aktuelle Selection zu verwenden
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        top = rect.bottom + window.scrollY + 10;
        left = rect.left + (rect.width / 2);
      } else {
        // Letzter Fallback: Mitte des Bildschirms
        top = window.innerHeight / 3 + window.scrollY;
        left = window.innerWidth / 2;
      }
    }

    tooltip.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; transform: translateX(-50%);`;

    document.body.appendChild(tooltip);

    // Event Listener
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
      navigator.clipboard.writeText(translated);
      this.showNotification('Kopiert!', 'success');
    });

    tooltip.querySelector('.smt-speak')?.addEventListener('click', () => {
      this.speak(translated);
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

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text.trim(),
        source: this.settings.sourceLang,
        target: this.settings.targetLang
      });

      if (result.success) {
        this.showTooltip(text.trim(), result.translatedText, result.alternatives, false, position);
      } else {
        this.showNotification(result.error || 'Übersetzungsfehler', 'error');
      }
    } catch (error) {
      this.showNotification('Verbindungsfehler', 'error');
    }
  }

  // === Seitenübersetzung ===
  async translatePage(mode = 'replace') {
    if (this.isTranslated) {
      this.toggleTranslation();
      return;
    }

    this.showProgress(true);
    this.translationMode = mode;

    try {
      const textNodes = this.findTranslatableTextNodes();
      const total = textNodes.length;
      let translated = 0;
      const cacheTranslations = {};

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
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName.toLowerCase();
          const excluded = ['script', 'style', 'code', 'pre', 'noscript', 'textarea', 'input', 'svg'];
          if (excluded.includes(tag)) return NodeFilter.FILTER_REJECT;

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

  // === PDF Export ===
  async exportAsPdf() {
    this.showNotification('PDF wird generiert...', 'info');

    // Kurze Verzögerung damit Notification sichtbar ist
    await new Promise(r => setTimeout(r, 100));

    window.print();
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
        this.exportAsPdf();
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

      default:
        sendResponse({ success: false });
    }
  }
}

// Initialisieren
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SmartTranslator());
} else {
  new SmartTranslator();
}

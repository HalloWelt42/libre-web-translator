// Content Script - Smart Web Translator v2.0
// Keine störenden UI-Elemente, elegante Tooltips bei Bedarf

class SmartTranslator {
  constructor() {
    this.settings = {};
    this.originalTexts = new Map();
    this.isTranslated = false;
    this.translationMode = null; // 'replace' oder 'bilingual'
    this.selectionIcon = null;
    this.tooltip = null;
    this.progressOverlay = null;
    this.hideTimeout = null;
    this.selectionTimeout = null;

    this.init();
  }

  async init() {
    // Lade Einstellungen
    await this.loadSettings();

    // Event Listener
    this.setupEventListeners();

    // Message Handler
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // Settings-Änderungen beobachten
    chrome.storage.onChanged.addListener((changes) => {
      this.handleSettingsChange(changes);
    });
  }

  async loadSettings() {
    this.settings = await chrome.storage.sync.get([
      'serviceUrl', 'apiKey', 'sourceLang', 'targetLang',
      'showSelectionIcon', 'selectionIconDelay', 'tooltipPosition',
      'tooltipAutoHide', 'tooltipAutoHideDelay', 'enableDoubleClick',
      'enableHoverTranslate', 'hoverDelay', 'showOriginalInTooltip',
      'showAlternatives', 'bilingualMode', 'bilingualPosition',
      'highlightTranslated', 'enableTTS', 'ttsLanguage'
    ]);

    // Defaults
    this.settings.serviceUrl = this.settings.serviceUrl || 'http://localhost:5000/translate';
    this.settings.targetLang = this.settings.targetLang || 'de';
    this.settings.sourceLang = this.settings.sourceLang || 'auto';
    this.settings.showSelectionIcon = this.settings.showSelectionIcon !== false;
    this.settings.selectionIconDelay = this.settings.selectionIconDelay || 200;
    this.settings.tooltipAutoHideDelay = this.settings.tooltipAutoHideDelay || 5000;
  }

  handleSettingsChange(changes) {
    for (const [key, { newValue }] of Object.entries(changes)) {
      this.settings[key] = newValue;
    }
  }

  setupEventListeners() {
    // Text-Auswahl erkennen
    document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('mousedown', (e) => this.handleMouseDown(e));

    // Doppelklick auf Wörter
    document.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // Escape zum Schließen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideSelectionIcon();
        this.hideTooltip();
      }
    });

    // Scroll - Icons verstecken
    document.addEventListener('scroll', () => {
      this.hideSelectionIcon();
    }, { passive: true });
  }

  handleMouseDown(e) {
    // Klick außerhalb von UI-Elementen schließt sie
    if (!e.target.closest('.smt-ui')) {
      this.hideSelectionIcon();
      if (this.settings.tooltipAutoHide) {
        this.hideTooltip();
      }
    }
  }

  handleMouseUp(e) {
    // Ignoriere Klicks auf eigene UI-Elemente
    if (e.target.closest('.smt-ui')) return;

    // Verzögert prüfen ob Text ausgewählt wurde
    clearTimeout(this.selectionTimeout);
    this.selectionTimeout = setTimeout(() => {
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

  // === Selection Icon (kleines Übersetzen-Icon neben Auswahl) ===
  showSelectionIcon(selection, mouseEvent) {
    this.hideSelectionIcon();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    this.selectionIcon = document.createElement('div');
    this.selectionIcon.className = 'smt-ui smt-selection-icon';
    this.selectionIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    `;

    // Position: rechts unterhalb der Auswahl
    const iconSize = 28;
    let left = rect.right + 5;
    let top = rect.bottom + window.scrollY + 5;

    // Sicherstellen, dass Icon im Viewport bleibt
    if (left + iconSize > window.innerWidth) {
      left = rect.left - iconSize - 5;
    }

    this.selectionIcon.style.cssText = `
      position: absolute;
      left: ${left}px;
      top: ${top}px;
    `;

    // Klick-Handler
    this.selectionIcon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = window.getSelection().toString().trim();
      if (text) {
        this.translateSelection(text);
      }
      this.hideSelectionIcon();
    });

    document.body.appendChild(this.selectionIcon);

    // Animation
    requestAnimationFrame(() => {
      this.selectionIcon?.classList.add('smt-visible');
    });
  }

  hideSelectionIcon() {
    if (this.selectionIcon) {
      this.selectionIcon.remove();
      this.selectionIcon = null;
    }
  }

  // === Tooltip für Übersetzungsergebnis ===
  showTooltip(original, translated, alternatives = [], position = null) {
    this.hideTooltip();

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'smt-ui smt-tooltip';

    // Inhalt aufbauen
    let content = `<div class="smt-tooltip-content">`;

    if (this.settings.showOriginalInTooltip && original) {
      content += `<div class="smt-original">${this.escapeHtml(original)}</div>`;
    }

    content += `<div class="smt-translated">${this.escapeHtml(translated)}</div>`;

    if (this.settings.showAlternatives && alternatives && alternatives.length > 0) {
      content += `<div class="smt-alternatives">`;
      alternatives.slice(0, 3).forEach(alt => {
        content += `<span class="smt-alt">${this.escapeHtml(alt)}</span>`;
      });
      content += `</div>`;
    }

    content += `</div>`;

    // Aktionsleiste
    content += `
      <div class="smt-tooltip-actions">
        <button class="smt-action smt-copy" title="Kopieren">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        ${this.settings.enableTTS ? `
        <button class="smt-action smt-speak" title="Vorlesen">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
        ` : ''}
        <button class="smt-action smt-sidepanel" title="Im Side Panel öffnen">
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/><path d="M15 7h2v10h-2z"/></svg>
        </button>
        <button class="smt-action smt-close" title="Schließen">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `;

    this.tooltip.innerHTML = content;

    // Position berechnen
    const selection = window.getSelection();
    let top, left;

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (this.settings.tooltipPosition === 'above') {
        top = rect.top + window.scrollY - 10;
        this.tooltip.classList.add('smt-above');
      } else {
        top = rect.bottom + window.scrollY + 10;
      }

      left = rect.left + (rect.width / 2);
    } else if (position) {
      top = position.top;
      left = position.left;
    } else {
      top = window.innerHeight / 2;
      left = window.innerWidth / 2;
    }

    this.tooltip.style.cssText = `
      position: absolute;
      left: ${left}px;
      top: ${top}px;
      transform: translateX(-50%);
    `;

    document.body.appendChild(this.tooltip);

    // Event Listener für Aktionen
    this.tooltip.querySelector('.smt-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(translated);
      this.showNotification('Kopiert!', 'success');
    });

    this.tooltip.querySelector('.smt-speak')?.addEventListener('click', () => {
      this.speak(translated);
    });

    this.tooltip.querySelector('.smt-sidepanel')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });

    this.tooltip.querySelector('.smt-close')?.addEventListener('click', () => {
      this.hideTooltip();
    });

    // Animation
    requestAnimationFrame(() => {
      this.tooltip?.classList.add('smt-visible');
    });

    // Im Viewport halten
    this.adjustTooltipPosition();

    // Auto-Hide
    if (this.settings.tooltipAutoHide) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = setTimeout(() => {
        this.hideTooltip();
      }, this.settings.tooltipAutoHideDelay);
    }
  }

  adjustTooltipPosition() {
    if (!this.tooltip) return;

    const rect = this.tooltip.getBoundingClientRect();
    const padding = 10;

    // Rechts außerhalb?
    if (rect.right > window.innerWidth - padding) {
      const currentLeft = parseFloat(this.tooltip.style.left);
      this.tooltip.style.left = `${currentLeft - (rect.right - window.innerWidth + padding)}px`;
    }

    // Links außerhalb?
    if (rect.left < padding) {
      const currentLeft = parseFloat(this.tooltip.style.left);
      this.tooltip.style.left = `${currentLeft + (padding - rect.left)}px`;
    }

    // Oben außerhalb? (Bei 'above' Position)
    if (rect.top < padding && this.settings.tooltipPosition === 'above') {
      this.tooltip.classList.remove('smt-above');
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const selRect = selection.getRangeAt(0).getBoundingClientRect();
        this.tooltip.style.top = `${selRect.bottom + window.scrollY + 10}px`;
      }
    }
  }

  hideTooltip() {
    clearTimeout(this.hideTimeout);
    if (this.tooltip) {
      this.tooltip.classList.remove('smt-visible');
      setTimeout(() => {
        this.tooltip?.remove();
        this.tooltip = null;
      }, 200);
    }
  }

  // === Übersetzungsfunktionen ===
  async translateSelection(text) {
    if (!text || text.trim().length === 0) return;

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text.trim(),
        source: this.settings.sourceLang,
        target: this.settings.targetLang
      });

      if (result.success) {
        this.showTooltip(text.trim(), result.translatedText, result.alternatives);
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
      this.restorePage();
      return;
    }

    this.showProgress(true);
    this.translationMode = mode;

    try {
      const textNodes = this.findTranslatableTextNodes();
      const total = textNodes.length;
      let translated = 0;

      // Batch-Verarbeitung
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
              this.originalTexts.set(node, {
                text: originalText,
                parent: node.parentElement
              });

              if (mode === 'bilingual') {
                this.insertBilingualTranslation(node, originalText, result.translatedText);
              } else {
                node.textContent = result.translatedText;
              }
            }
          } catch (e) {
            console.warn('Übersetzungsfehler:', e);
          }

          translated++;
          this.updateProgress(translated, total);
        }));

        // Kurze Pause zwischen Batches
        await new Promise(r => setTimeout(r, 50));
      }

      this.isTranslated = true;
      this.showProgress(false);
      this.showNotification(`${translated} Textblöcke übersetzt`, 'success');

    } catch (error) {
      this.showProgress(false);
      this.showNotification('Fehler bei Seitenübersetzung', 'error');
    }
  }

  insertBilingualTranslation(node, original, translated) {
    const parent = node.parentElement;
    if (!parent) return;

    // Container für bilinguale Anzeige
    const wrapper = document.createElement('span');
    wrapper.className = 'smt-bilingual-wrapper';

    const originalSpan = document.createElement('span');
    originalSpan.className = 'smt-bilingual-original';
    originalSpan.textContent = original;

    const translatedSpan = document.createElement('span');
    translatedSpan.className = 'smt-bilingual-translated';
    translatedSpan.textContent = translated;

    if (this.settings.bilingualPosition === 'above') {
      wrapper.appendChild(translatedSpan);
      wrapper.appendChild(originalSpan);
    } else {
      wrapper.appendChild(originalSpan);
      wrapper.appendChild(translatedSpan);
    }

    // Ersetze den Textknoten
    const textNode = document.createTextNode('');
    node.parentNode.replaceChild(wrapper, node);
    this.originalTexts.set(wrapper, { node, text: original, parent });
  }

  restorePage() {
    this.originalTexts.forEach((data, element) => {
      if (this.translationMode === 'bilingual') {
        // Bilinguale Wrapper ersetzen
        if (element.parentNode && data.node) {
          data.node.textContent = data.text;
          element.parentNode.replaceChild(data.node, element);
        }
      } else {
        // Einfache Textersetzung
        if (element.parentNode) {
          element.textContent = data.text;
        }
      }
    });

    this.originalTexts.clear();
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
          const excluded = ['script', 'style', 'code', 'pre', 'noscript', 'textarea', 'input'];
          if (excluded.includes(tag)) return NodeFilter.FILTER_REJECT;

          // Eigene UI-Elemente überspringen
          if (parent.closest('.smt-ui')) return NodeFilter.FILTER_REJECT;

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
    if (!this.settings.enableTTS) return;
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
        const selection = window.getSelection().toString().trim();
        sendResponse({ text: selection });
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

      case 'getPageInfo':
        sendResponse({
          isTranslated: this.isTranslated,
          mode: this.translationMode,
          count: this.originalTexts.size
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

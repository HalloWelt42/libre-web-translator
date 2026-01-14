// Popup JavaScript - Smart Web Translator v3.0

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkPageCache();
  setupEventListeners();
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang', 'apiType']);
  document.getElementById('sourceLang').value = settings.sourceLang || 'auto';
  document.getElementById('targetLang').value = settings.targetLang || 'de';
  
  // API-Badge aktualisieren
  updateApiBadge(settings.apiType || 'libretranslate');
}

function updateApiBadge(apiType) {
  const badge = document.getElementById('apiBadge');
  const badgeText = document.getElementById('apiBadgeText');
  
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

async function checkPageCache() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCacheInfo' });

    if (response && response.currentPageHasCache) {
      const cacheStatus = document.getElementById('cacheStatus');
      const cacheSize = document.getElementById('cacheSize');
      const cacheHint = document.getElementById('cacheHint');

      cacheStatus.style.display = 'flex';
      cacheStatus.classList.add('has-cache');
      cacheSize.textContent = formatBytes(response.size);
      cacheHint.textContent = `${response.entries.length} Seite(n) gecacht`;
    }
  } catch (e) {
    // Content script nicht geladen
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function setupEventListeners() {
  const translateBtn = document.getElementById('translateBtn');
  const inputText = document.getElementById('inputText');
  const resultBox = document.getElementById('resultBox');
  const resultActions = document.getElementById('resultActions');

  // Quick Translate
  translateBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) return;

    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;

    translateBtn.disabled = true;
    translateBtn.innerHTML = '<div class="spinner"></div> Übersetze...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        source: sourceLang,
        target: targetLang
      });

      resultBox.classList.add('show');
      resultBox.classList.remove('error');

      if (response.success) {
        resultBox.textContent = response.translatedText;
        resultActions.style.display = 'flex';

        await chrome.runtime.sendMessage({
          action: 'addToHistory',
          entry: {
            original: text,
            translated: response.translatedText,
            source: sourceLang,
            target: targetLang,
            timestamp: Date.now()
          }
        });
      } else {
        resultBox.textContent = 'Fehler: ' + (response.error || 'Unbekannt');
        resultBox.classList.add('error');
      }
    } catch (error) {
      resultBox.classList.add('show', 'error');
      resultBox.textContent = 'Verbindungsfehler: ' + error.message;
    }

    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12m-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
      Übersetzen
    `;
  });

  // Enter zum Übersetzen
  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      translateBtn.click();
    }
  });

  // Sprachen speichern
  document.getElementById('sourceLang').addEventListener('change', saveLanguages);
  document.getElementById('targetLang').addEventListener('change', saveLanguages);

  // Sprachen tauschen
  document.getElementById('swapLangs').addEventListener('click', () => {
    const source = document.getElementById('sourceLang');
    const target = document.getElementById('targetLang');
    if (source.value !== 'auto') {
      const temp = source.value;
      source.value = target.value;
      target.value = temp;
      saveLanguages();
    }
  });

  // Kopieren
  document.getElementById('copyResult').addEventListener('click', () => {
    navigator.clipboard.writeText(resultBox.textContent);
    showToast('Kopiert!');
  });

  // Click-to-Copy auf resultBox
  resultBox.addEventListener('click', () => {
    const text = resultBox.textContent.trim();
    if (text && !resultBox.classList.contains('error')) {
      navigator.clipboard.writeText(text);
      resultBox.classList.add('copied');
      showToast('Übersetzung kopiert!');
      setTimeout(() => resultBox.classList.remove('copied'), 1500);
    }
  });

  // Vorlesen
  document.getElementById('speakResult').addEventListener('click', () => {
    const targetLang = document.getElementById('targetLang').value;
    const utterance = new SpeechSynthesisUtterance(resultBox.textContent);
    utterance.lang = getLangCode(targetLang);
    speechSynthesis.speak(utterance);
  });

  // Cache laden
  document.getElementById('loadCacheBtn')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'loadCachedTranslation' });
    window.close();
  });

  // Page Actions
  document.getElementById('translatePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'translatePage', mode: 'replace' });
    window.close();
  });

  document.getElementById('bilingualPage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'translatePage', mode: 'bilingual' });
    window.close();
  });

  document.getElementById('toggleTranslation').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleTranslation' });
    window.close();
  });

  document.getElementById('restorePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'restorePage' });
    window.close();
  });

  document.getElementById('exportPdf').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'exportPdf' });
    window.close();
  });

  document.getElementById('openSidepanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });

  // Footer Links
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('manageCache').addEventListener('click', async (e) => {
    e.preventDefault();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    // Signal zum Side Panel, Cache-Tab zu öffnen
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'sidepanel-show-cache' });
    }, 300);
    window.close();
  });
}

async function saveLanguages() {
  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  await chrome.storage.sync.set({ sourceLang, targetLang });
}

function getLangCode(lang) {
  const codes = {
    'de': 'de-DE', 'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES',
    'it': 'it-IT', 'pt': 'pt-PT', 'ru': 'ru-RU', 'zh': 'zh-CN',
    'ja': 'ja-JP'
  };
  return codes[lang] || 'en-US';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 16px;
    background: #1B5E20; color: white; padding: 12px 20px; border-radius: 8px;
    font-size: 14px; font-weight: 500; z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: toastSlide 2s ease forwards;
  `;
  
  // Animation hinzufügen
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlide {
      0% { opacity: 0; transform: translateX(100%); }
      15% { opacity: 1; transform: translateX(0); }
      85% { opacity: 1; transform: translateX(0); }
      100% { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);
  
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
    style.remove();
  }, 2000);
}

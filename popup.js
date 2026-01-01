// Popup JavaScript - Smart Web Translator v2.0

document.addEventListener('DOMContentLoaded', async () => {
  // Einstellungen laden
  const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
  document.getElementById('sourceLang').value = settings.sourceLang || 'auto';
  document.getElementById('targetLang').value = settings.targetLang || 'de';

  // Quick Translate
  const translateBtn = document.getElementById('translateBtn');
  const inputText = document.getElementById('inputText');
  const result = document.getElementById('result');

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

      result.classList.add('show');
      result.classList.remove('error');

      if (response.success) {
        result.textContent = response.translatedText;

        // Zum Verlauf hinzufügen
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
        result.textContent = 'Fehler: ' + (response.error || 'Unbekannt');
        result.classList.add('error');
      }
    } catch (error) {
      result.classList.add('show', 'error');
      result.textContent = 'Verbindungsfehler';
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

  async function saveLanguages() {
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    await chrome.storage.sync.set({ sourceLang, targetLang });
  }

  // Seite übersetzen
  document.getElementById('translatePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'translatePage', mode: 'replace' });
    window.close();
  });

  // Bilingual
  document.getElementById('bilingualPage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'translatePage', mode: 'bilingual' });
    window.close();
  });

  // Side Panel öffnen
  document.getElementById('openSidepanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });

  // Wiederherstellen
  document.getElementById('restorePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'restorePage' });
    window.close();
  });

  // Einstellungen öffnen
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

// Options JavaScript - Smart Web Translator v2.0

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'serviceUrl', 'apiKey', 'sourceLang', 'targetLang',
    'showSelectionIcon', 'selectionIconDelay', 'enableDoubleClick',
    'showOriginalInTooltip', 'showAlternatives', 'tooltipAutoHide',
    'tooltipPosition', 'tooltipAutoHideDelay', 'highlightTranslated',
    'bilingualPosition', 'enableTTS', 'ttsLanguage', 'excludedDomains',
    'skipCodeBlocks', 'skipBlockquotes'
  ]);

  // Werte setzen
  document.getElementById('serviceUrl').value = settings.serviceUrl || 'http://localhost:5000/translate';
  document.getElementById('apiKey').value = settings.apiKey || '';
  document.getElementById('sourceLang').value = settings.sourceLang || 'auto';
  document.getElementById('targetLang').value = settings.targetLang || 'de';
  document.getElementById('showSelectionIcon').checked = settings.showSelectionIcon !== false;
  document.getElementById('selectionIconDelay').value = settings.selectionIconDelay || 200;
  document.getElementById('enableDoubleClick').checked = settings.enableDoubleClick || false;
  document.getElementById('showOriginalInTooltip').checked = settings.showOriginalInTooltip !== false;
  document.getElementById('showAlternatives').checked = settings.showAlternatives !== false;
  document.getElementById('tooltipAutoHide').checked = settings.tooltipAutoHide !== false;
  document.getElementById('tooltipPosition').value = settings.tooltipPosition || 'below';
  document.getElementById('tooltipAutoHideDelay').value = settings.tooltipAutoHideDelay || 5000;
  document.getElementById('highlightTranslated').checked = settings.highlightTranslated !== false;
  document.getElementById('bilingualPosition').value = settings.bilingualPosition || 'below';
  document.getElementById('enableTTS').checked = settings.enableTTS || false;
  document.getElementById('ttsLanguage').value = settings.ttsLanguage || 'de-DE';
  document.getElementById('excludedDomains').value = settings.excludedDomains || '';
  document.getElementById('skipCodeBlocks').checked = settings.skipCodeBlocks !== false;
  document.getElementById('skipBlockquotes').checked = settings.skipBlockquotes !== false;
}

function setupEventListeners() {
  // Speichern
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Zurücksetzen
  document.getElementById('resetBtn').addEventListener('click', resetSettings);

  // Testen
  document.getElementById('testBtn').addEventListener('click', testConnection);
}

async function saveSettings() {
  const settings = {
    serviceUrl: document.getElementById('serviceUrl').value.trim() || 'http://localhost:5000/translate',
    apiKey: document.getElementById('apiKey').value.trim(),
    sourceLang: document.getElementById('sourceLang').value,
    targetLang: document.getElementById('targetLang').value,
    showSelectionIcon: document.getElementById('showSelectionIcon').checked,
    selectionIconDelay: parseInt(document.getElementById('selectionIconDelay').value) || 200,
    enableDoubleClick: document.getElementById('enableDoubleClick').checked,
    showOriginalInTooltip: document.getElementById('showOriginalInTooltip').checked,
    showAlternatives: document.getElementById('showAlternatives').checked,
    tooltipAutoHide: document.getElementById('tooltipAutoHide').checked,
    tooltipPosition: document.getElementById('tooltipPosition').value,
    tooltipAutoHideDelay: parseInt(document.getElementById('tooltipAutoHideDelay').value) || 5000,
    highlightTranslated: document.getElementById('highlightTranslated').checked,
    bilingualPosition: document.getElementById('bilingualPosition').value,
    enableTTS: document.getElementById('enableTTS').checked,
    ttsLanguage: document.getElementById('ttsLanguage').value,
    excludedDomains: document.getElementById('excludedDomains').value.trim(),
    skipCodeBlocks: document.getElementById('skipCodeBlocks').checked,
    skipBlockquotes: document.getElementById('skipBlockquotes').checked
  };

  try {
    await chrome.storage.sync.set(settings);
    showStatus('Einstellungen erfolgreich gespeichert!', 'success');
  } catch (error) {
    showStatus('Fehler beim Speichern: ' + error.message, 'error');
  }
}

async function resetSettings() {
  if (!confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) {
    return;
  }

  const defaultSettings = {
    serviceUrl: 'http://localhost:5000/translate',
    apiKey: '',
    sourceLang: 'auto',
    targetLang: 'de',
    showSelectionIcon: true,
    selectionIconDelay: 200,
    enableDoubleClick: false,
    showOriginalInTooltip: true,
    showAlternatives: true,
    tooltipAutoHide: true,
    tooltipPosition: 'below',
    tooltipAutoHideDelay: 5000,
    highlightTranslated: true,
    bilingualPosition: 'below',
    enableTTS: false,
    ttsLanguage: 'de-DE',
    excludedDomains: ''
  };

  try {
    await chrome.storage.sync.set(defaultSettings);
    await loadSettings();
    showStatus('Einstellungen zurückgesetzt!', 'success');
  } catch (error) {
    showStatus('Fehler beim Zurücksetzen: ' + error.message, 'error');
  }
}

async function testConnection() {
  const testInput = document.getElementById('testInput').value.trim() || 'Hello, world!';
  const testResult = document.getElementById('testResult');
  const testBtn = document.getElementById('testBtn');

  testBtn.disabled = true;
  testBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border:2px solid #D1D5DB;border-top-color:#4F46E5;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Teste...';
  testResult.textContent = 'Verbindung wird getestet...';
  testResult.classList.remove('error');

  const serviceUrl = document.getElementById('serviceUrl').value.trim() || 'http://localhost:5000/translate';
  const apiKey = document.getElementById('apiKey').value.trim();
  const targetLang = document.getElementById('targetLang').value;

  try {
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: testInput,
        source: 'auto',
        target: targetLang,
        format: 'text',
        api_key: apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.translatedText) {
      testResult.textContent = `✓ Erfolgreich!\n\n"${testInput}"\n→ "${result.translatedText}"`;
      testResult.classList.remove('error');
    } else {
      throw new Error('Keine Übersetzung in der Antwort');
    }

  } catch (error) {
    testResult.textContent = `✗ Fehler: ${error.message}\n\nBitte überprüfen Sie die API-URL und ob der Server erreichbar ist.`;
    testResult.classList.add('error');
  }

  testBtn.disabled = false;
  testBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>
    Testen
  `;
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;

  setTimeout(() => {
    status.className = 'status';
  }, 4000);
}

// CSS für Spinner
const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

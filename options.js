// Options JavaScript - Smart Web Translator v3.0 mit LM Studio Support

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Fachkontext System-Prompts
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

  custom: '' // Wird vom Benutzer definiert
};

async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'serviceUrl', 'apiKey', 'sourceLang', 'targetLang',
    'showSelectionIcon', 'selectionIconDelay',
    'showOriginalInTooltip', 'showAlternatives',
    'tooltipPosition', 'highlightTranslated',
    'bilingualPosition', 'enableTTS', 'ttsLanguage', 'excludedDomains',
    'skipCodeBlocks', 'skipBlockquotes', 'useTabsForAlternatives',
    'simplifyPdfExport', 'fixInlineSpacing', 'tabWordThreshold',
    // LM Studio Einstellungen
    'apiType', 'lmStudioUrl', 'lmStudioModel', 'lmStudioTemperature',
    'lmStudioMaxTokens', 'lmStudioContext', 'lmStudioCustomPrompt',
    // Neue v3.1 Einstellungen
    'autoLoadCache', 'autoTranslateDomains',
    'filterEmbeddingModels', 'enableAbortTranslation', 'enableLLMFallback',
    // Token-Kosten (Experimentell)
    'enableTokenCost', 'tokenCostAmount', 'tokenCostPer', 'tokenCostCurrency'
  ]);

  // LibreTranslate Werte
  document.getElementById('serviceUrl').value = settings.serviceUrl || 'http://localhost:5000/translate';
  document.getElementById('apiKey').value = settings.apiKey || '';
  
  // LM Studio Werte
  document.getElementById('lmStudioUrl').value = settings.lmStudioUrl || 'http://192.168.178.45:1234';
  document.getElementById('lmStudioTemperature').value = settings.lmStudioTemperature ?? 0.1;
  document.getElementById('temperatureValue').textContent = settings.lmStudioTemperature ?? 0.1;
  document.getElementById('lmStudioMaxTokens').value = settings.lmStudioMaxTokens || 2000;
  document.getElementById('lmStudioContext').value = settings.lmStudioContext || 'general';
  document.getElementById('lmStudioCustomPrompt').value = settings.lmStudioCustomPrompt || '';
  
  // Erweiterte LLM Optionen (default: aus)
  document.getElementById('filterEmbeddingModels').checked = settings.filterEmbeddingModels || false;
  document.getElementById('enableAbortTranslation').checked = settings.enableAbortTranslation || false;
  document.getElementById('enableLLMFallback').checked = settings.enableLLMFallback || false;
  
  // API-Typ setzen und UI aktualisieren
  const apiType = settings.apiType || 'libretranslate';
  setApiType(apiType);
  
  // Custom Prompt anzeigen wenn ausgewählt
  toggleCustomPrompt(settings.lmStudioContext);
  
  // Modell laden wenn LM Studio URL vorhanden
  if (settings.lmStudioUrl && settings.lmStudioModel) {
    const modelSelect = document.getElementById('lmStudioModel');
    const option = document.createElement('option');
    option.value = settings.lmStudioModel;
    option.textContent = settings.lmStudioModel.split('/').pop();
    option.selected = true;
    modelSelect.innerHTML = '';
    modelSelect.appendChild(option);
  }
  
  // Sprachen
  document.getElementById('sourceLang').value = settings.sourceLang || 'auto';
  document.getElementById('targetLang').value = settings.targetLang || 'de';
  
  // Auslöser
  document.getElementById('showSelectionIcon').checked = settings.showSelectionIcon !== false;
  document.getElementById('selectionIconDelay').value = settings.selectionIconDelay || 200;
  
  // Anzeige
  document.getElementById('showOriginalInTooltip').checked = settings.showOriginalInTooltip !== false;
  document.getElementById('showAlternatives').checked = settings.showAlternatives !== false;
  document.getElementById('tooltipPosition').value = settings.tooltipPosition || 'below';
  document.getElementById('highlightTranslated').checked = settings.highlightTranslated !== false;
  document.getElementById('bilingualPosition').value = settings.bilingualPosition || 'below';
  
  // Seitenübersetzung
  document.getElementById('autoLoadCache').checked = settings.autoLoadCache || false;
  
  // Auto-Translate Domains laden
  renderAutoTranslateDomains(settings.autoTranslateDomains || []);
  
  // Inhaltsfilter
  document.getElementById('skipCodeBlocks').checked = settings.skipCodeBlocks !== false;
  document.getElementById('skipBlockquotes').checked = settings.skipBlockquotes !== false;
  document.getElementById('fixInlineSpacing').checked = settings.fixInlineSpacing !== false;
  
  // Anzeige-Optionen
  document.getElementById('useTabsForAlternatives').checked = settings.useTabsForAlternatives !== false;
  document.getElementById('tabWordThreshold').value = settings.tabWordThreshold || 20;
  document.getElementById('simplifyPdfExport').checked = settings.simplifyPdfExport || false;
  
  // TTS
  document.getElementById('enableTTS').checked = settings.enableTTS || false;
  document.getElementById('ttsLanguage').value = settings.ttsLanguage || 'de-DE';
  
  // Ausgeschlossene Domains
  document.getElementById('excludedDomains').value = settings.excludedDomains || '';
  
  // Token-Kosten (Experimentell)
  document.getElementById('enableTokenCost').checked = settings.enableTokenCost || false;
  document.getElementById('tokenCostAmount').value = settings.tokenCostAmount ?? 1;
  document.getElementById('tokenCostPer').value = settings.tokenCostPer || 10000;
  document.getElementById('tokenCostCurrency').value = settings.tokenCostCurrency || 'EUR';
}

// Auto-Translate Domains rendern
function renderAutoTranslateDomains(domains) {
  const container = document.getElementById('autoTranslateDomains');
  container.innerHTML = '';
  
  domains.forEach((domain, index) => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `
      <span>${domain}</span>
      <button type="button" data-index="${index}" title="Entfernen">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    container.appendChild(item);
  });
  
  // Event-Listener für Löschen
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => removeAutoTranslateDomain(parseInt(btn.dataset.index)));
  });
}

// Domain hinzufügen
async function addAutoTranslateDomain() {
  const input = document.getElementById('newAutoTranslateDomain');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  // Domain validieren
  if (!/^[a-z0-9]+([\-\.][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
    showStatus('Ungültige Domain: ' + domain, 'error');
    return;
  }
  
  const settings = await chrome.storage.sync.get(['autoTranslateDomains']);
  const domains = settings.autoTranslateDomains || [];
  
  if (domains.includes(domain)) {
    showStatus('Domain bereits vorhanden', 'error');
    return;
  }
  
  domains.push(domain);
  await chrome.storage.sync.set({ autoTranslateDomains: domains });
  
  input.value = '';
  renderAutoTranslateDomains(domains);
  showStatus('Domain hinzugefügt: ' + domain, 'success');
}

// Domain entfernen
async function removeAutoTranslateDomain(index) {
  const settings = await chrome.storage.sync.get(['autoTranslateDomains']);
  const domains = settings.autoTranslateDomains || [];
  
  const removed = domains.splice(index, 1);
  await chrome.storage.sync.set({ autoTranslateDomains: domains });
  
  renderAutoTranslateDomains(domains);
  showStatus('Domain entfernt: ' + removed[0], 'success');
}

function setupEventListeners() {
  // Speichern
  document.getElementById('saveBtn').addEventListener('click', saveSettings);

  // Zurücksetzen
  document.getElementById('resetBtn').addEventListener('click', resetSettings);

  // Testen
  document.getElementById('testBtn').addEventListener('click', testConnection);
  
  // API-Typ Buttons
  document.querySelectorAll('.api-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      setApiType(type);
    });
  });
  
  // Modelle laden Button
  document.getElementById('refreshModelsBtn').addEventListener('click', loadLMStudioModels);
  
  // Temperatur Slider
  document.getElementById('lmStudioTemperature').addEventListener('input', (e) => {
    document.getElementById('temperatureValue').textContent = e.target.value;
  });
  
  // Kontext Auswahl
  document.getElementById('lmStudioContext').addEventListener('change', (e) => {
    toggleCustomPrompt(e.target.value);
  });
  
  // Auto-Translate Domain hinzufügen
  document.getElementById('addAutoTranslateDomain').addEventListener('click', addAutoTranslateDomain);
  document.getElementById('newAutoTranslateDomain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAutoTranslateDomain();
    }
  });
}

function setApiType(type) {
  // Buttons aktualisieren
  document.querySelectorAll('.api-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  
  // Einstellungsbereiche umschalten
  document.getElementById('libretranslate-settings').style.display = 
    type === 'libretranslate' ? 'block' : 'none';
  document.getElementById('lmstudio-settings').style.display = 
    type === 'lmstudio' ? 'block' : 'none';
  
  // Wenn LM Studio ausgewählt, Modelle laden
  if (type === 'lmstudio') {
    loadLMStudioModels();
  }
}

function toggleCustomPrompt(context) {
  const customGroup = document.getElementById('customPromptGroup');
  customGroup.style.display = context === 'custom' ? 'block' : 'none';
}

async function loadLMStudioModels() {
  const url = document.getElementById('lmStudioUrl').value.trim();
  const modelSelect = document.getElementById('lmStudioModel');
  const refreshBtn = document.getElementById('refreshModelsBtn');
  const filterEmbedding = document.getElementById('filterEmbeddingModels').checked;
  
  if (!url) {
    showStatus('Bitte LM Studio URL eingeben', 'error');
    return;
  }
  
  // Loading-State
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<div class="spinner-small"></div>';
  modelSelect.innerHTML = '<option value="">Lade Modelle...</option>';
  
  try {
    const response = await fetch(`${url}/v1/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    modelSelect.innerHTML = '';
    
    if (data.data && data.data.length > 0) {
      let models = data.data;
      
      // Embedding-Modelle filtern wenn Option aktiviert
      if (filterEmbedding) {
        models = models.filter(model => {
          const id = model.id.toLowerCase();
          return !id.includes('embed') && !id.includes('embedding');
        });
      }
      
      if (models.length > 0) {
        models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          // Kurzen Namen extrahieren
          const shortName = model.id.split('/').pop();
          option.textContent = shortName;
          option.title = model.id; // Vollständiger Name als Tooltip
          modelSelect.appendChild(option);
        });
        
        const filtered = data.data.length - models.length;
        const msg = filtered > 0 
          ? `${models.length} Chat-Modell(e) geladen (${filtered} Embedding-Modelle ausgeblendet)`
          : `${models.length} Modell(e) geladen`;
        showStatus(msg, 'success');
      } else {
        modelSelect.innerHTML = '<option value="">Keine Chat-Modelle gefunden</option>';
        showStatus('Keine Chat-Modelle gefunden (nur Embedding-Modelle vorhanden)', 'error');
      }
    } else {
      modelSelect.innerHTML = '<option value="">Keine Modelle gefunden</option>';
      showStatus('Keine Modelle in LM Studio geladen', 'error');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Modelle:', error);
    modelSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
    showStatus(`Verbindung fehlgeschlagen: ${error.message}`, 'error');
  }
  
  // Loading-State zurücksetzen
  refreshBtn.disabled = false;
  refreshBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
}

async function saveSettings() {
  // Aktiven API-Typ ermitteln
  const apiType = document.querySelector('.api-type-btn.active').dataset.type;
  
  const settings = {
    // API-Typ
    apiType: apiType,
    
    // LibreTranslate
    serviceUrl: document.getElementById('serviceUrl').value.trim() || 'http://localhost:5000/translate',
    apiKey: document.getElementById('apiKey').value.trim(),
    
    // LM Studio
    lmStudioUrl: document.getElementById('lmStudioUrl').value.trim() || 'http://192.168.178.45:1234',
    lmStudioModel: document.getElementById('lmStudioModel').value,
    lmStudioTemperature: parseFloat(document.getElementById('lmStudioTemperature').value) || 0.1,
    lmStudioMaxTokens: parseInt(document.getElementById('lmStudioMaxTokens').value) || 2000,
    lmStudioContext: document.getElementById('lmStudioContext').value,
    lmStudioCustomPrompt: document.getElementById('lmStudioCustomPrompt').value.trim(),
    
    // Erweiterte LLM Optionen
    filterEmbeddingModels: document.getElementById('filterEmbeddingModels').checked,
    enableAbortTranslation: document.getElementById('enableAbortTranslation').checked,
    enableLLMFallback: document.getElementById('enableLLMFallback').checked,
    
    // Sprachen
    sourceLang: document.getElementById('sourceLang').value,
    targetLang: document.getElementById('targetLang').value,
    
    // Auslöser
    showSelectionIcon: document.getElementById('showSelectionIcon').checked,
    selectionIconDelay: parseInt(document.getElementById('selectionIconDelay').value) || 200,
    
    // Anzeige
    showOriginalInTooltip: document.getElementById('showOriginalInTooltip').checked,
    showAlternatives: document.getElementById('showAlternatives').checked,
    tooltipPosition: document.getElementById('tooltipPosition').value,
    highlightTranslated: document.getElementById('highlightTranslated').checked,
    bilingualPosition: document.getElementById('bilingualPosition').value,
    
    // Seitenübersetzung
    autoLoadCache: document.getElementById('autoLoadCache').checked,
    
    // Inhaltsfilter
    skipCodeBlocks: document.getElementById('skipCodeBlocks').checked,
    skipBlockquotes: document.getElementById('skipBlockquotes').checked,
    fixInlineSpacing: document.getElementById('fixInlineSpacing').checked,
    
    // Anzeige-Optionen
    useTabsForAlternatives: document.getElementById('useTabsForAlternatives').checked,
    tabWordThreshold: parseInt(document.getElementById('tabWordThreshold').value) || 20,
    simplifyPdfExport: document.getElementById('simplifyPdfExport').checked,
    
    // TTS
    enableTTS: document.getElementById('enableTTS').checked,
    ttsLanguage: document.getElementById('ttsLanguage').value,
    
    // Ausgeschlossene Domains
    excludedDomains: document.getElementById('excludedDomains').value.trim(),
    
    // Token-Kosten (Experimentell)
    enableTokenCost: document.getElementById('enableTokenCost').checked,
    tokenCostAmount: parseFloat(document.getElementById('tokenCostAmount').value) || 1,
    tokenCostPer: parseInt(document.getElementById('tokenCostPer').value) || 10000,
    tokenCostCurrency: document.getElementById('tokenCostCurrency').value
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
    apiType: 'libretranslate',
    serviceUrl: 'http://localhost:5000/translate',
    apiKey: '',
    lmStudioUrl: 'http://192.168.178.45:1234',
    lmStudioModel: '',
    lmStudioTemperature: 0.1,
    lmStudioMaxTokens: 2000,
    lmStudioContext: 'general',
    lmStudioCustomPrompt: '',
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
    skipCodeBlocks: true,
    skipBlockquotes: true,
    fixInlineSpacing: true,
    useTabsForAlternatives: true,
    tabWordThreshold: 20,
    simplifyPdfExport: false,
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
  const apiType = document.querySelector('.api-type-btn.active').dataset.type;

  testBtn.disabled = true;
  testBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border:2px solid #D1D5DB;border-top-color:#4F46E5;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Teste...';
  testResult.textContent = 'Verbindung wird getestet...';
  testResult.classList.remove('error');

  try {
    let result;
    
    if (apiType === 'libretranslate') {
      result = await testLibreTranslate(testInput);
    } else {
      result = await testLMStudio(testInput);
    }

    if (result.success) {
      testResult.textContent = `✓ Erfolgreich!\n\n"${testInput}"\n→ "${result.translation}"`;
      if (result.alternatives && result.alternatives.length > 0) {
        testResult.textContent += `\n\nAlternativen: ${result.alternatives.join(', ')}`;
      }
      if (result.contextNotes) {
        testResult.textContent += `\n\n💡 ${result.contextNotes}`;
      }
      testResult.classList.remove('error');
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    testResult.textContent = `✗ Fehler: ${error.message}\n\nBitte überprüfen Sie die Verbindungseinstellungen.`;
    testResult.classList.add('error');
  }

  testBtn.disabled = false;
  testBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>
    Testen
  `;
}

async function testLibreTranslate(testInput) {
  const serviceUrl = document.getElementById('serviceUrl').value.trim() || 'http://localhost:5000/translate';
  const apiKey = document.getElementById('apiKey').value.trim();
  const targetLang = document.getElementById('targetLang').value;

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
    return {
      success: true,
      translation: result.translatedText,
      alternatives: result.alternatives || []
    };
  } else {
    throw new Error('Keine Übersetzung in der Antwort');
  }
}

async function testLMStudio(testInput) {
  const url = document.getElementById('lmStudioUrl').value.trim();
  const model = document.getElementById('lmStudioModel').value;
  const temperature = parseFloat(document.getElementById('lmStudioTemperature').value);
  const maxTokens = parseInt(document.getElementById('lmStudioMaxTokens').value);
  const context = document.getElementById('lmStudioContext').value;
  const customPrompt = document.getElementById('lmStudioCustomPrompt').value;
  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  
  if (!url) throw new Error('LM Studio URL fehlt');
  if (!model) throw new Error('Kein Modell ausgewählt');
  
  // System-Prompt aufbauen
  let systemPrompt = context === 'custom' && customPrompt 
    ? customPrompt 
    : CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.general;
  
  // Platzhalter ersetzen
  const sourceLabel = sourceLang === 'auto' ? 'der Quellsprache' : getLanguageName(sourceLang);
  const targetLabel = getLanguageName(targetLang);
  systemPrompt = systemPrompt
    .replace(/{source}/g, sourceLabel)
    .replace(/{target}/g, targetLabel);

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testInput }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
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
    throw new Error('Ungültige Antwort vom Server');
  }
  
  const content = result.choices[0].message.content;
  
  try {
    const parsed = JSON.parse(content);
    return {
      success: true,
      translation: parsed.translation,
      alternatives: parsed.alternatives || [],
      contextNotes: parsed.context_notes
    };
  } catch (e) {
    // Fallback: Wenn kein JSON, nutze die rohe Antwort
    return {
      success: true,
      translation: content.trim(),
      alternatives: []
    };
  }
}

function getLanguageName(code) {
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
style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid #D1D5DB;
    border-top-color: #4F46E5;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
`;
document.head.appendChild(style);

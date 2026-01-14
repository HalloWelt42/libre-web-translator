# Smart Web Translator v3.0

Browser-Erweiterung mit **Dual-API-System**: LibreTranslate + LM Studio (lokale LLMs)

## Neue Features in v3.0

### 🤖 LM Studio Integration
- **Lokale LLM-Übersetzung** via OpenAI-kompatible API
- **Dynamische Modell-Auswahl** – zeigt alle in LM Studio geladenen Modelle
- **Fachkontext-System** mit vordefinierten Prompts:
  - 🌐 Allgemein
  - 🚗 Kfz / Automotive
  - ⚙️ Technisch / IT
  - 🏥 Medizin
  - ⚖️ Recht / Juristisch
  - 📝 Eigener Custom-Prompt

### 📄 Plain-Text & RFC Support
- **Automatische Erkennung** von .txt Dateien
- **RFC-Seiten** (ietf.org, rfc-editor.org) werden speziell erkannt
- **Pre-Only Seiten** werden intelligent verarbeitet
- Text wird in **logische Absätze** aufgeteilt (anhand von Leerzeilen)

### 📊 Einstellbare Parameter
- **Temperatur-Slider** (0.0–1.0) – niedriger = präziser
- **Max Tokens** – für längere Übersetzungen
- **JSON Structured Output** – Alternativen + Kontext-Notizen

## Installation

1. Chrome → `chrome://extensions`
2. "Entwicklermodus" aktivieren
3. "Entpackte Erweiterung laden"
4. Ordner `smart-translator` auswählen

## LM Studio Setup

1. **LM Studio starten** und ein Chat-Modell laden (z.B. Qwen3, Llama)
2. **Server aktivieren**: Developer → Start Server
3. In der Erweiterung → Einstellungen:
   - API-Backend: "LM Studio (LLM)" auswählen
   - URL eingeben: `http://DEINE-IP:1234`
   - Modelle laden klicken
   - Gewünschtes Modell auswählen

**Wichtig:** Nur Chat/Instruct-Modelle verwenden, keine Embedding-Modelle!

## Empfohlene Modelle (Mac M4 Max 128GB)

| Modell | RAM | Beschreibung |
|--------|-----|--------------|
| **Qwen3-32B-Instruct MLX** | ~20GB | Beste Übersetzungsqualität |
| **Qwen3-30B-A3B MLX** | ~18GB | MoE, schnell & effizient |
| **Qwen3-14B-Instruct MLX** | ~10GB | Schnell für Echtzeit |
| **Llama-3.3-70B MLX** | ~45GB | Stark bei EU-Sprachen |

## Dateien

```
smart-translator/
├── manifest.json          # Extension Config
├── background.js          # Service Worker mit Dual-API
├── content.js             # Seiten-Manipulation + Plain-Text Support
├── popup.html/js          # Popup UI
├── sidepanel.html/js      # Side Panel
├── options.html/js        # Einstellungen mit API-Auswahl
├── styles.css             # Content Styles
├── domain-strategies.js   # Domain-spezifische Regeln
└── icons/                 # Extension Icons
```

## Changelog

### v3.0
- ✅ LM Studio API Integration
- ✅ Fachkontext System-Prompts
- ✅ Dynamische Modell-Auswahl
- ✅ Temperatur & Token-Einstellungen
- ✅ Kontext-Notizen Anzeige
- ✅ API-Badge in Popup/Sidepanel
- ✅ Batch-Übersetzung via LLM
- ✅ **Plain-Text & RFC Support**

### v2.1
- LibreTranslate Integration
- Seitenübersetzung mit Cache
- PDF/Markdown/DOCX Export
- Bilingual-Modus

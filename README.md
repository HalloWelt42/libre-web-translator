# Web Translator - Browser Extension

Eine Chrome/Edge-Erweiterung zur Übersetzung von Webseiten mit einem lokalen Übersetzungsservice.

## 🚀 Features

- **Vollständige Seitenübersetzung** - Übersetzt alle Texte auf einer Webseite
- **Lokaler Service** - Nutzt deinen eigenen Übersetzungsservice (z.B. auf `https://translate.mac/translate`)
- **Unterstützt HTTP/HTTPS** - Funktioniert mit lokalen und Internet-Seiten
- **Batch-Verarbeitung** - Optimierte Performance durch intelligente Batch-Übersetzung
- **Originaltext-Wiederherstellung** - Wechsle einfach zwischen Original und Übersetzung
- **Ausgeschlossene Domains** - Deaktiviere die Extension auf bestimmten Seiten
- **Tastenkürzel** - Schnelle Übersetzung per Hotkey
- **Responsive UI** - Floating Button und Progress Bar

## 📋 Systemanforderungen

- Chrome/Edge Browser (Manifest V3)
- Lokaler Übersetzungsservice mit der API:

```javascript
const response = await fetch("https://translate.mac/translate", {
  method: "POST",
  body: JSON.stringify({
    q: "beautiful new world",
    source: "en", 
    target: "de",
    format: "text",
    alternatives: 3,
    api_key: ""
  }),
  headers: { "Content-Type": "application/json" }
});
```

Erwartete Antwort:
```json
{
  "alternatives": ["schön neue welt", "wunderschöne neue welt"],
  "translatedText": "schöne neue welt"
}
```

## 🛠️ Installation

### 1. Extension vorbereiten

Erstelle einen Ordner `web-translator` und füge alle Dateien hinzu:

```
web-translator/
├── manifest.json
├── content.js
├── popup.html
├── popup.js
├── options.html  
├── options.js
├── background.js
├── styles.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 2. Icons erstellen

Erstelle die benötigten Icon-Dateien im `icons/` Ordner:
- `icon16.png` (16x16 px)
- `icon48.png` (48x48 px)
- `icon128.png` (128x128 px)

Du kannst einfache Icons mit einem Übersetzungs-Symbol (🌐) verwenden.

### 3. Extension laden

1. Öffne Chrome/Edge
2. Gehe zu `chrome://extensions/` (oder `edge://extensions/`)
3. Aktiviere den "Entwicklermodus" (oben rechts)
4. Klicke "Entpackte Erweiterung laden"
5. Wähle den `web-translator` Ordner aus

### 4. Service konfigurieren

1. Klicke auf das Extension-Icon
2. Klicke "Einstellungen"
3. Gib deine Service-URL ein (z.B. `https://translate.mac/translate`)
4. Optional: API Key eingeben
5. Klicke "Verbindung testen"
6. Speichere die Einstellungen

## 🎯 Nutzung

### Grundlegende Übersetzung

1. **Über Extension-Icon:**
    - Klicke auf das Extension-Icon in der Toolbar
    - Wähle Quell- und Zielsprache
    - Klicke "Übersetzen"

2. **Über Floating Button:**
    - Klicke auf den blauen 🌐 Button (oben rechts auf der Seite)

3. **Über Kontextmenü:**
    - Rechtsklick auf die Seite → "Seite übersetzen"
    - Text markieren → Rechtsklick → "Auswahl übersetzen"

4. **Über Tastenkürzel:**
    - Standard: `Ctrl+Shift+T`
    - Konfigurierbar über `chrome://extensions/shortcuts`

### Erweiterte Features

- **Originaltexte wiederherstellen:** Klicke "Zurücksetzen" oder den Floating Button erneut
- **Domains ausschließen:** In den Einstellungen können bestimmte Domains deaktiviert werden
- **Batch-Größe anpassen:** Optimiere die Performance durch Anpassung der gleichzeitig verarbeiteten Textblöcke

## ⚙️ Konfiguration

### Service-Einstellungen

- **Service URL:** URL zu deinem lokalen Übersetzungsservice
- **API Key:** Optional, falls dein Service einen API Key benötigt
- **Sprachen:** Standard-Quell- und Zielsprachen
- **Batch-Größe:** 1-20 (Standard: 5)

### Ausgeschlossene Domains

Trage Domains ein (eine pro Zeile), auf denen die Extension deaktiviert werden soll:

```
admin.example.com
banking.com
internal.company.net
```

### Tastenkürzel

Standardmäßig ist `Ctrl+Shift+T` für die Seitenübersetzung konfiguriert. Dies kann unter `chrome://extensions/shortcuts` angepasst werden.

## 🔧 Technische Details

### Architektur

- **Content Script:** Analysiert und übersetzt Seitentexte
- **Background Script:** Verwaltet Einstellungen und API-Calls
- **Popup:** Benutzeroberfläche für manuelle Übersetzung
- **Options Page:** Erweiterte Konfiguration

### Text-Parsing

Die Extension verwendet einen `TreeWalker` um alle übersetzbare Textknoten zu finden und:

- Überspringt Code-Elemente (`<script>`, `<style>`, `<code>`, `<pre>`)
- Filtert leere oder nur Sonderzeichen enthaltende Texte
- Behält die Original-DOM-Struktur bei
- Speichert Originaltexte für Wiederherstellung

### Performance-Optimierung

- **Batch-Verarbeitung:** Mehrere Texte werden gleichzeitig übersetzt
- **Intelligente Filterung:** Nur relevante Texte werden verarbeitet
- **Asynchrone Verarbeitung:** Non-blocking UI mit Progress-Anzeige
- **Caching:** Originaltexte werden im Speicher gehalten

## 🐛 Problembehandlung

### Häufige Probleme

1. **"Verbindung fehlgeschlagen"**
    - Prüfe, ob der Übersetzungsservice läuft
    - Teste die URL im Browser
    - Überprüfe CORS-Einstellungen des Services

2. **"Keine übersetzbare Texte gefunden"**
    - Seite könnte dynamisch geladen werden (warte kurz)
    - JavaScript-generierte Inhalte brauchen Zeit zum Laden

3. **Übersetzung funktioniert nicht**
    - Prüfe die Entwicklerkonsole (F12) auf Fehlermeldungen
    - Teste die API-Verbindung in den Einstellungen

4. **Extension wird nicht angezeigt**
    - Prüfe, ob die Domain ausgeschlossen ist
    - Lade die Seite neu nach Installation

### Debug-Modus

Für Entwickler: Öffne die Entwicklerkonsole (F12) um detaillierte Logs zu sehen:

```javascript
// Zeige Content Script Status
console.log('Translator Status:', window.translator);

// Teste API direkt
fetch("https://translate.mac/translate", { /* ... */ })
  .then(r => r.json())
  .then(console.log);
```

## 🔄 Updates

### Extension aktualisieren

1. Ersetze die Dateien im Extension-Ordner
2. Gehe zu `chrome://extensions/`
3. Klicke auf das Reload-Symbol bei der Extension

### Service-API erweitern

Die Extension unterstützt zusätzliche API-Parameter:

```javascript
{
  q: "text",
  source: "en",
  target: "de", 
  format: "text",
  alternatives: 3,
  api_key: "",
  // Zusätzliche Parameter:
  model: "custom-model",
  context: "technical",
  preserve_formatting: true
}
```

## 📝 Lizenz

Diese Extension ist Open Source. Nutze und modifiziere sie nach deinen Bedürfnissen.

## 🤝 Beitragen

Verbesserungen und Bugfixes sind willkommen! Die Extension ist modular aufgebaut und kann einfach erweitert werden.

### Entwicklung

1. Fork das Projekt
2. Erstelle einen Feature-Branch
3. Teste deine Änderungen
4. Erstelle einen Pull Request

## 📞 Support

Bei Problemen:

1. Prüfe die Entwicklerkonsole auf Fehlermeldungen
2. Teste die API-Verbindung in den Einstellungen
3. Überprüfe die Service-Logs
4. Erstelle ein Issue mit detaillierter Fehlerbeschreibung
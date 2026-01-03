# Smart Web Translator v2.2

Browser-Extension zur Übersetzung von Webinhalten mit LibreTranslate-Backend.

---

## Überblick

Smart Web Translator ist eine Chrome/Brave-Extension, die Texte auf Webseiten übersetzt. Die Extension verwendet einen selbst gehosteten LibreTranslate-Server und bietet verschiedene Übersetzungsmodi sowie lokales Caching der Ergebnisse.

### Kernfunktionen

- Übersetzung markierter Textpassagen
- Vollständige Seitenübersetzung
- Bilingualer Modus (Original + Übersetzung nebeneinander)
- Lokaler Cache für bereits übersetzte Seiten
- Anpinnbare Übersetzungs-Tooltips
- Toggle zwischen Original und Übersetzung
- Intelligente Code- und Zitat-Erkennung

---

## Installation

1. `chrome://extensions` öffnen
2. Entwicklermodus aktivieren
3. ZIP entpacken
4. "Entpackte Erweiterung laden" wählen
5. Entpackten Ordner auswählen

### Voraussetzungen

- Chrome 114+ oder Brave (aktuell)
- LibreTranslate-Server (lokal oder remote)

---

## Bedienung

### Textauswahl übersetzen

| Methode | Beschreibung |
|---------|--------------|
| Icon-Klick | Text markieren → Übersetzer-Icon erscheint rechts → Klick |
| Tastenkürzel | Text markieren → `Ctrl+Shift+T` |
| Kontextmenü | Text markieren → Rechtsklick → "Übersetzen" |
| Doppelklick | Wort doppelklicken (optional, in Einstellungen aktivierbar) |

### Seitenübersetzung

| Aktion | Tastenkürzel | Beschreibung |
|--------|--------------|--------------|
| Seite übersetzen | `Ctrl+Shift+P` | Ersetzt alle Texte durch Übersetzungen |
| Bilingual | - | Original bleibt sichtbar, Übersetzung darunter |
| Toggle | - | Wechselt zwischen Original und Übersetzung |
| Wiederherstellen | - | Stellt Originaltexte wieder her |

### Side Panel

Öffnen mit `Ctrl+Shift+S` oder über das Kontextmenü.

**Tabs:**

1. **Übersetzen** – Texteingabe mit Sprachauswahl, Seitenaktionen
2. **Verlauf** – Letzte 100 Übersetzungen, klickbar zum Wiederverwenden
3. **Cache** – Verwaltung gecachter Seiten mit Größenanzeige

---

## Caching-System

### Funktionsweise

Übersetzungen werden im LocalStorage des Browsers gespeichert, getrennt nach Seiten-URL. Beim erneuten Besuch einer bereits übersetzten Seite erscheint für 10 Sekunden ein Indikator oben rechts.

### Cache-Verwaltung

Über das Side Panel (Tab "Cache") oder Popup:

- Gesamtgröße in KB/MB einsehen
- Anzahl gecachter Seiten
- Einzelne Einträge löschen
- Gesamten Cache leeren

### Speicherort

```
LocalStorage Key: smt_cache_[base64-hash-der-url]
```

---

## Tooltip-Funktionen

Das Übersetzungs-Tooltip bietet folgende Aktionen:

| Button | Funktion |
|--------|----------|
| Pin | Tooltip anpinnen (bleibt sichtbar, verschiebbar) |
| Kopieren | Übersetzung in Zwischenablage |
| Vorlesen | Text-to-Speech (falls aktiviert) |
| Schließen | Tooltip entfernen |

Angepinnte Tooltips können per Drag & Drop verschoben werden.

---

## Hover-Funktion

Bei übersetzten Texten (nach Seitenübersetzung):

- Hover zeigt Originaltext als Tooltip
- Übersetzte Bereiche sind dezent hervorgehoben
- Umschaltung zwischen Original/Übersetzung über Toggle-Funktion

---

## Einstellungen

Erreichbar über Popup → "Einstellungen" oder Rechtsklick auf Extension-Icon.

### API-Konfiguration

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| Service-URL | `http://localhost:5000/translate` | LibreTranslate-Endpoint |
| API-Key | leer | Falls Server Authentifizierung erfordert |

### Sprachen

| Einstellung | Standard |
|-------------|----------|
| Quellsprache | Automatisch |
| Zielsprache | Deutsch |

### Auslöser

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| Auswahl-Icon anzeigen | An | Icon bei Textmarkierung |
| Icon-Verzögerung | 200ms | Zeit bis Icon erscheint |
| Doppelklick-Übersetzung | Aus | Wort per Doppelklick übersetzen |

### Anzeige

| Einstellung | Standard |
|-------------|----------|
| Original im Tooltip zeigen | An |
| Alternativen anzeigen | An |
| Auto-Ausblenden | An |
| Ausblende-Verzögerung | 5 Sekunden |
| Tooltip-Position | Unterhalb |

### Text-to-Speech

| Einstellung | Standard |
|-------------|----------|
| TTS aktivieren | Aus |
| Sprache | de-DE |

### Inhaltsfilter

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| Code-Blöcke überspringen | An | Übersetzt keine `<code>`, `<pre>`, `<kbd>` Elemente |
| Zitate überspringen | An | Übersetzt keine `<blockquote>` Elemente |

Die Code-Erkennung erfasst:
- HTML-Tags: `code`, `pre`, `kbd`, `samp`, `var`
- CSS-Klassen: `highlight`, `hljs`, `prism`, `codehilite`, `prettyprint`, `language-*`
- Code-Editoren: Monaco, Ace, CodeMirror
- Data-Attribute: `data-language`, `data-lang`, `data-code`

### Ausschlüsse

Liste von Domains, auf denen die Extension nicht aktiv sein soll (eine pro Zeile).

---

## Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| `Ctrl+Shift+T` | Markierten Text übersetzen |
| `Ctrl+Shift+P` | Gesamte Seite übersetzen |
| `Ctrl+Shift+S` | Side Panel öffnen |
| `Escape` | Tooltip/Icon schließen |

Auf macOS: `Cmd` statt `Ctrl`

Tastenkürzel können unter `chrome://extensions/shortcuts` angepasst werden.

---

## Technische Details

### Manifest

- Manifest Version: 3
- Permissions: `activeTab`, `storage`, `scripting`, `contextMenus`, `sidePanel`

### Architektur

```
background.js     Service Worker, API-Kommunikation, Kontextmenü
content.js        DOM-Manipulation, UI-Elemente, Cache-Verwaltung
popup.html/js     Kompaktes Popup-Interface
sidepanel.html/js Erweitertes Interface mit Verlauf und Cache
options.html/js   Einstellungsseite
styles.css        Material Design Styles
```

### Speicherung

| Typ | Verwendung | Limit |
|-----|------------|-------|
| `chrome.storage.sync` | Einstellungen | 100 KB |
| `chrome.storage.local` | Übersetzungsverlauf | 5 MB |
| `localStorage` | Seiten-Cache | ~5 MB pro Origin |

### API-Format

Request an LibreTranslate:

```json
{
  "q": "Text to translate",
  "source": "auto",
  "target": "de",
  "format": "text",
  "alternatives": 3
}
```

Response:

```json
{
  "translatedText": "Übersetzter Text",
  "alternatives": ["Alternative 1", "Alternative 2"],
  "detectedLanguage": { "language": "en", "confidence": 0.98 }
}
```

---

## Bekannte Einschränkungen

- Cache ist an Browser/Profil gebunden, nicht geräteübergreifend
- PDF-Export nutzt Browser-Druckfunktion
- Einige dynamisch geladene Inhalte werden nicht erfasst
- Text in iframes wird nicht übersetzt

---

## Changelog

### v2.2

- Code-Blöcke und Zitate werden standardmäßig nicht übersetzt
- Intelligente Erkennung von Syntax-Highlighting (Prism, Highlight.js, etc.)
- Neue Einstellungssektion "Inhaltsfilter"
- Verbesserte Dark Mode Farben
- PDF-Export mit besserer Code-Formatierung (Monospace)
- Print-Styles für Zitate verbessert

### v2.1

- Bugfix: Tooltip erscheint jetzt korrekt nach Icon-Klick
- Position wird vor Selection-Verlust gespeichert

### v2.0

- Material Design UI
- LocalStorage-Cache mit Verwaltung
- Pin-Funktion für Tooltips
- Hover zeigt Original bei übersetzten Texten
- Toggle zwischen Original/Übersetzung
- Side Panel mit Verlauf und Cache-Tab
- Cache-Indikator bei gecachten Seiten

### v1.0

- Initiale Version
- Textauswahl-Übersetzung
- Seitenübersetzung
- Kontextmenü-Integration
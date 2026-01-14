# Smart Web Translator v3.3

Browser-Erweiterung mit **Dual-API-System**: LibreTranslate + LM Studio (lokale LLMs)

## Neue Features in v3.3

### 🎨 Dark Mode Fixes
- **Button-Kontraste verbessert** – Action Cards und Result Actions jetzt besser lesbar
- **Icons in korrekter Farbe** – Blaue Icons auf dunklem Hintergrund
- **Text-Kontrast erhöht** – Alle Texte gut sichtbar im Dark Mode

### 🔔 Toast Notifications (Stack)
- **Einheitliches Notification-System** – Alle Meldungen erscheinen unten rechts
- **Toast-Stack** – Mehrere Meldungen stapeln sich
- **Animations-Verbesserungen** – Slide-In von rechts

### 🛡️ Cache-Validierung
- **Falsche Cache-Anzeige behoben** – Nur noch echte Übersetzungen werden angezeigt
- **Leere Cache-Einträge ignoriert** – Keine irreführenden "Cache vorhanden" Anzeigen mehr

## Features aus v3.1

### 🔄 Cache Auto-Load
- **Automatisches Laden** gecachter Übersetzungen beim Seitenaufruf
- Einstellbar in den Optionen (default: aus)

### 🌐 Domain Auto-Translate
- **Whitelist für Domains** die automatisch übersetzt werden
- Domain-Verwaltung in den Einstellungen

### 📊 Progress-Ring mit Token-Zähler
- **Minimierbare Progress-Anzeige** → halbtransparenter Ring
- **Token-Zähler** pro Anfrage + Gesamt (mit K/M/G Formatierung)
- **Abbrechen-Button** (optional, einstellbar)

### 🛡️ Erweiterte LLM-Optionen
- **Embedding-Modelle ausblenden** – zeigt nur Chat-Modelle
- **Fallback auf LibreTranslate** – automatisch wenn LM Studio nicht erreichbar
- Alle Optionen default aus, in Einstellungen aktivierbar

### 🗑️ Verbessertes Cache-Management
- **Einzelne Cache-Einträge löschen** (war vorher nur "Alles löschen")
- Bessere Übersicht im Sidepanel

### 🧹 Aufgeräumt
- Doppelklick-Übersetzung entfernt (war fehleranfällig)
- Auto-Hide-Timer entfernt (manuell schließen ist besser)
- Einheitliches Material Design Farbschema

## Installation

1. Chrome → `chrome://extensions`
2. "Entwicklermodus" aktivieren
3. "Entpackte Erweiterung laden"
4. Ordner `smart-translator` auswählen

## LM Studio Setup

1. **LM Studio starten** und ein Chat-Modell laden
2. **Server aktivieren**: Developer → Start Server
3. In der Erweiterung → Einstellungen:
   - API-Backend: "LM Studio (LLM)" auswählen
   - URL eingeben: `http://DEINE-IP:1234`
   - Modelle laden klicken
   - Gewünschtes Modell auswählen

**Tipp:** "Embedding-Modelle ausblenden" aktivieren um nur Chat-Modelle zu sehen.

## Empfohlene Modelle (Mac M4 Max 128GB)

| Modell | RAM | Beschreibung |
|--------|-----|--------------|
| **Qwen3-32B-Instruct MLX** | ~20GB | Beste Übersetzungsqualität |
| **Qwen3-30B-A3B MLX** | ~18GB | MoE, schnell & effizient |
| **Qwen3-14B-Instruct MLX** | ~10GB | Schnell für Echtzeit |
| **Llama-3.3-70B MLX** | ~45GB | Stark bei EU-Sprachen |

## Material Design Farben

```css
--md-primary:       #1565C0  /* Buttons, Progress, Links */
--md-primary-dark:  #0D47A1  /* Hover-States */
--md-primary-light: #E3F2FD  /* Hintergründe, Badges */
--md-accent:        #E64A19  /* Aktionen */
--md-success:       #2E7D32  /* Erfolg */
--md-error:         #C62828  /* Fehler, Löschen */
```

## Changelog

### v3.3
- ✅ Dark Mode Button-Kontraste (Action Cards, Result Actions)
- ✅ Toast Notifications unten rechts als Stack
- ✅ Cache-Validierung – nur echte Übersetzungen anzeigen
- ✅ smt-action Buttons im Content Script korrigiert
- ✅ Icon-Farben im Dark Mode

### v3.1
- ✅ Cache Auto-Load Option
- ✅ Domain Auto-Translate Whitelist
- ✅ Progress-Ring (minimierbar, halbtransparent)
- ✅ Token-Zähler mit K/M/G Formatierung
- ✅ Abbrechen-Button (optional)
- ✅ Embedding-Modelle Filter
- ✅ Fallback auf LibreTranslate
- ✅ Cache-Einträge einzeln löschen
- ❌ Doppelklick-Übersetzung entfernt
- ❌ Auto-Hide-Timer entfernt

### v3.0
- LM Studio API Integration
- Fachkontext System-Prompts
- Plain-Text & RFC Support

### v2.1
- LibreTranslate Integration
- Seitenübersetzung mit Cache
- PDF/Markdown/DOCX Export

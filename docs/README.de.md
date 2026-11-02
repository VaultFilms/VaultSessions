<p align="center"><img src="../VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions"></p>
<h1 align="center">VaultSessions</h1>

**Eine Open-Source-Besprechungs-App, in der Menschen ihre eigenen ChatGPT-, Gemini- und Claude-Assistenten mit bestehender Personalisierung und Präferenzen zusammenbringen, um gemeinsam zu denken, zu diskutieren und zusammenzuarbeiten.**

<p align="center">
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.id.md">Indonesia</a> |
  <a href="README.pt-BR.md">Português</a> |
  <a href="README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=AN_3TevWWRk">
    <img src="introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

## Funktionen

- **Die Persönlichkeit Ihrer gewohnten KI mitbringen.** Verbinden Sie die offiziellen Webchats, die Sie bereits nutzen, mit ihren bestehenden Unterhaltungen und Personalisierungen. Es werden keine KI-API-Schlüssel benötigt.
- **Natürliche Gruppendiskussionen.** Verbundene KIs sprechen abwechselnd, bringen neue Perspektiven ein und setzen aus, wenn sie nichts hinzuzufügen haben. Bei nur einer verbundenen KI gibt es eine einzelne Antwort.
- **Den ersten Antwortenden natürlich bestimmen.** Nutzen Sie `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude` oder `To Gemini`. Ohne Angabe wird die erste KI zufällig gewählt.
- **Visuellen Kontext teilen.** Hängen Sie bis zu vier Bilder an oder fügen Sie sie ein und besprechen Sie sie anhand ihrer Nummern.
- **Die aktuelle Seite teilen.** Stellen Sie bei Bedarf lesbaren Seitentext als Besprechungsreferenz bereit.
- **Zusammenfassen und kopieren.** Erstellen Sie eine Zusammenfassung zum Nachlesen oder für eine spätere Besprechung.
- **Seitenleiste und erweiterte Ansicht.** Wechseln Sie das Layout, blenden Sie Teilnehmersteuerungen aus und passen Sie die Protokollschriftgröße an.
- **Neun Oberflächensprachen.** Englisch, Japanisch, Französisch (Frankreich), Deutsch (Deutschland), Spanisch (USA), Italienisch, Indonesisch, Portugiesisch (Brasilien) und Hindi. Die erste Auswahl folgt den Browsereinstellungen, mit Englisch als Fallback. Manuelle Einstellungen werden gespeichert. Der Dunkelmodus folgt dem Browser bzw. Betriebssystem.

VaultSessions ist ein Machbarkeitsnachweis für eine Besprechungsoberfläche, die unterschiedliche KI-Kontexte, Persönlichkeiten und menschliche Perspektiven zusammenbringt. Das Projekt ist weder mit OpenAI, Google oder Anthropic verbunden noch von diesen Unternehmen empfohlen.

## Installation

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Diesen Ordner in Chrome laden
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Laden Sie dieses Repository herunter oder klonen Sie es in einen dauerhaft aufbewahrten Ordner.
2. Öffnen Sie `chrome://extensions/` und aktivieren Sie den **Entwicklermodus**.
3. Klicken Sie auf **Entpackte Erweiterung laden** und wählen Sie den inneren Ordner **`VaultSessions/`** mit `manifest.json`, nicht das Stammverzeichnis des Repositorys.
4. Öffnen Sie die offiziellen Websites von ChatGPT, Gemini und/oder Claude und melden Sie sich selbst an.
5. Klicken Sie in dem Tab, in dem die Besprechungsseitenleiste erscheinen soll, auf das VaultSessions-Erweiterungssymbol.

Verwenden Sie eine aktuelle Chrome-Version. Das Manifest verlangt mindestens Chrome 116; die Kompatibilität mit Browser-APIs und Anbieteroberflächen kann jedoch variieren. Für normale Besprechungen sind weder ein Build-Schritt noch ein Server nötig.

Laden Sie nach einem Update die Erweiterung, die offiziellen KI-Tabs und die Besprechungsansicht neu.

### Erweiterte Ansicht ohne Server

1. Aktivieren Sie in den **Details** der Erweiterung **Zugriff auf Datei-URLs zulassen**.
2. Öffnen Sie `VaultSessions/meeting.html` in Chrome.
3. Klicken Sie auf **Diese Besprechungsseite registrieren**, um ihre genaue lokale URL im lokalen Erweiterungsspeicher zu hinterlegen.
4. Wechseln Sie über die Kopfzeilensteuerung zwischen Seitenleiste und erweiterter Ansicht.

Nach dem Verschieben des Ordners müssen Sie die neue `meeting.html` öffnen und erneut registrieren. Beim Wechsel von der Seitenleiste wird der aktuelle Tab wiederverwendet; über Zurück gelangen Sie zur vorherigen Website. Das Protokoll wird übernommen, KI-Verbindungen müssen aber gegebenenfalls erneut hergestellt werden.

### Optionaler localhost-Modus

Manche KI-Browserseitenleisten können `file://`-Seiten nicht bedienen. Installieren Sie für solche Integrationen Python 3 und starten Sie den optionalen Loopback-Server:

| Plattform | Startdatei | Terminalbefehl im inneren Ordner `VaultSessions/` |
| --- | --- | --- |
| macOS | Doppelklick auf `VaultSessions/start.command` | `python3 serve.py` |
| Windows | Doppelklick auf `VaultSessions/start.bat` | `py -3 serve.py` oder `python serve.py` |

Falls die macOS-Startdatei ihr Ausführungsrecht verloren hat, verwenden Sie `chmod +x start.command` oder den obigen Terminalbefehl. Lassen Sie das Terminalfenster geöffnet; Ctrl+C beendet den Server. Port 8766 muss frei sein.

Klicken Sie in der dateibasierten Besprechung auf **?** und verwenden Sie im Hilfedialog die Schaltfläche zum Prüfen und Öffnen des Servers. Sie prüft den Server und speichert vor dem Wechsel das aktuelle Protokoll. Die Adresse lautet `http://127.0.0.1:8766/meeting.html`.

Der Server stellt Dateien aus dem inneren Ordner `VaultSessions/` ausschließlich über Loopback bereit. Speichern Sie dort keine Geheimnisse oder persönlichen Dateien. Die Erweiterung muss in beiden Modi aktiviert bleiben.

## Verwendung

### Eine Besprechung starten

Verfügbare KI-Tabs verbinden sich automatisch. Gibt es mehrere Tabs eines Anbieters, wählen Sie die gewünschte Unterhaltung. Sie können eine KI trennen, ohne ihren Tab zu schließen. Die automatische Wiederverbindung bleibt in dieser Ansicht ausgesetzt, bis Sie die KI wieder verbinden.

Geben Sie ein Thema ein und drücken Sie Enter. Umschalt+Enter fügt einen Zeilenumbruch ein; während einer IME-Komposition wird nicht gesendet. Bei mehreren verbundenen KIs folgen die übrigen Teilnehmer der ersten Antwort in festgelegter Reihenfolge. Die erste KI können Sie an beliebiger Stelle im Text adressieren. Groß- und Kleinschreibung wird ignoriert; die erste ausdrückliche Nennung zählt.

Die Standardgrenzen sind **3 Beiträge** und **6 Anfragen**. PASS zählt als Anfrage, nicht als Beitrag. Wenn alle verbundenen Teilnehmer nacheinander aussetzen, endet die Diskussion ebenfalls. **Diskussion stoppen** verhindert weitere Runden. Eine laufende Antwort muss möglicherweise noch abgerufen werden, bevor die Eingabe wieder freigegeben wird.

KI-Tabs werden beim Senden und Abrufen von Antworten in den Vordergrund geholt. Bearbeiten oder wechseln Sie währenddessen die betroffenen Unterhaltungen nicht. Ein Eingabeschutz hilft gegen versehentliche Tastatureingaben nach Fokuswechseln. Rollenanweisungen sind normale Chatnachrichten, keine Systemrollen. Der Erhalt der Persönlichkeit und das Befolgen der Anweisungen sind nicht garantiert.

### Bilder und Zusammenfassungen

Hängen Sie bis zu vier PNG-, JPEG- oder WebP-Bilder an: **jeweils 5 MB, insgesamt 10 MB**. Fügen Sie Bilder in das Nachrichtenfeld ein oder verwenden Sie die Anhangsschaltfläche. Enthalten eingefügte Daten ein Bild, hat dessen Verarbeitung Vorrang vor Text. Prüfen Sie die Vorschau und entfernen Sie unerwünschte Anhänge vor dem Senden.

VaultSessions übergibt Bilder innerhalb des Browsers an den offiziellen KI-Tab, ohne einen vom Projekt betriebenen Vermittlungsserver. Die offizielle Website lädt sie beim Senden zum Anbieter hoch. Die Bildnummerierung beginnt bei jeder neuen menschlichen Nachricht mit Bildern erneut.

**Diskussion zusammenfassen** wählt eine verfügbare verbundene KI zufällig aus. Dabei startet keine weitere Diskussionsrunde und die Empfehlung von 300 Zeichen entfällt. Bei Erfolg ersetzt die Zusammenfassung das angezeigte Protokoll und den regulären App-Verlauf. Kopieren Sie sie, wenn Sie sie behalten möchten. Bei Fehlern bleibt das vorherige Protokoll erhalten. Zusammenfassungen werden aus später von der App erzeugten Diskussionsverläufen und künftigen Zusammenfassungseingaben ausgeschlossen. Bereits gesendete Nachrichten verbleiben in der Unterhaltung beim Anbieter.

### Anzeige und temporäre Speicherung

Das Kopfzeilenmenü blendet Teilnehmer- und Einstellungssteuerungen aus. **A−**, **A＋** und **Standardgröße** ändern die Schriftgröße der Protokolltexte einschließlich Zusammenfassungen zwischen 75 % und 175 %. Die Einstellung gilt für beide Layouts und bleibt nach Browserneustarts erhalten.

Temporäre Schnappschüsse nutzen `chrome.storage.session` mit bis zu 500 angezeigten Einträgen und 500 regulären Verlaufseinträgen pro Speicherung. Die aktive Ansicht kann mehr enthalten. Dies ist kein dauerhaftes Archiv. Sprache, Schriftgröße, Seitenteilungspräferenz und registrierte Datei-URL werden im lokalen Browserspeicher abgelegt. Ausgewählte, noch nicht gesendete Bilder bleiben beim Ansichtswechsel nicht erhalten.

### Datenschutz, Berechtigungen und Kompatibilität

**Dies ist keine Offline- oder ausschließlich auf Loopback beschränkte Anwendung.** Die Erweiterungskoordination und Bildübergabe erfolgen im Browser. Die offiziellen KI-Websites senden jedoch Nachrichten, Bilder und geteilten Seitentext an ihre Dienste. VaultSessions verwendet keine KI-API-Endpunkte direkt und benötigt keinen vom Projekt betriebenen Vermittlungsserver.

Bei der statischen Quellcodeprüfung wurde ein expliziter `fetch` gefunden: die optionale Prüfung von `http://127.0.0.1:8766/meeting.html`. Es wurden kein separater Analyseclient, kein Lader für entfernte Skripte/CDNs und kein direkter externer KI-API-Client festgestellt. Dies ist eine Quellcodefeststellung, **keine Prüfung anhand aufgezeichneten Netzwerkverkehrs** und keine Aussage, dass keine externe Kommunikation stattfindet.

Geteilter Seitentext kann private Informationen angemeldeter Seiten enthalten. Deaktivieren Sie das Teilen auf Seiten, die Sie nicht weitergeben möchten. Das Entfernen von URL-Abfrageparametern entfernt keine privaten Daten aus dem Seitentext. Informationen zu Berechtigungen, Datenflüssen und Sicherheitsmeldungen finden Sie in [SECURITY.md](../SECURITY.md).

**VaultSessions automatisiert angemeldete offizielle KI-Websites. Dies kann gegen Nutzungsbedingungen oder Kontoregeln eines Anbieters verstoßen. Prüfen Sie die geltenden Bedingungen und nutzen Sie das Programm auf eigenes Risiko. Änderungen an Anbieteroberflächen, Browser-APIs, Funktionen oder Bedingungen können die Funktion beeinträchtigen oder eine Einstellung der Nutzung erforderlich machen.** CAPTCHA und Nutzungslimits werden nicht umgangen. Open Source bedeutet nicht, dass unabhängige Sicherheitsprüfungen stattgefunden haben oder das Programm grundsätzlich sicher ist.

### Mitwirken

Beiträge sind willkommen!

Forken Sie dieses Repository, verbessern Sie VaultSessions und reichen Sie einen Pull Request ein.

Entwickeln wir gemeinsam eine bessere Art, wie Menschen und KI miteinander denken.

Die interne Testsuite ist nicht Teil dieser Distribution. Beschreiben Sie bei Änderungen Ihre Prüfschritte, besonders für DOM-Adapter der Anbieter. Wie Sie eine Sprache hinzufügen, erfahren Sie in [VaultSessions/i18n/README.md](../VaultSessions/i18n/README.md).

## Lizenz

[MIT](../LICENSE) — Copyright (c) 2026 VaultFilms.

Die Software wird **WIE BESEHEN UND OHNE GEWÄHRLEISTUNG** bereitgestellt. Behalten Sie bei Weitergabe die Urheberrechts-, Erlaubnis- und Gewährleistungsausschlusshinweise bei. Die Lizenz erlaubt nicht, die Bedingungen von Drittanbieterdiensten zu ignorieren.

Erstellt von [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).

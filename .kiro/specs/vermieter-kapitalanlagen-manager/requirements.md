# Requirements Document

## Introduction

Der Vermieter Kapitalanlagen Manager ist eine Webanwendung zur strukturierten Verwaltung vermieteter Eigentumswohnungen als Kapitalanlage. Die Anwendung richtet sich an private Vermieter und ermöglicht die Erfassung und Auswertung von Einnahmen, Ausgaben, Finanzierung, Abschreibung (AfA) und steuerlich relevanten Daten. Alle UI-Texte und Kategorien sind auf Deutsch. Das Datenmodell ist von Beginn an mehrobjektfähig.

## Glossary

- **System**: Die Vermieter Kapitalanlagen Manager Webanwendung
- **Objekt**: Eine vermietete Eigentumswohnung oder Immobilie als Kapitalanlage
- **Buchung**: Ein finanzieller Vorgang (Einnahme, Ausgabe, nicht zahlungswirksam, Kaution, Umbuchung)
- **Buchungsteilung**: Ein Teilbetrag einer Buchung mit eigener Kategorie und Klassifikation
- **Kategorie**: Eine konfigurierbare Klassifikation für Buchungen mit Standardregeln
- **Regelwerk**: Konfigurierbare Standardregeln pro Kategorie (Umlagefähigkeit, Steuerlogik)
- **AfA**: Absetzung für Abnutzung – lineare Gebäudeabschreibung
- **AfA_Plan**: Jahresweise Berechnung der Abschreibung über die Restlaufzeit
- **Darlehen**: Ein Immobilienkredit mit Zins- und Tilgungskomponenten
- **Darlehenszahlung**: Eine einzelne Zahlung auf ein Darlehen (Zins, Tilgung, Gebühren)
- **Mietvertrag**: Vertrag zwischen Vermieter und Mieter mit Mietkonditionen
- **Sollstellung**: Automatisch generierte monatliche Mietforderung basierend auf dem Mietvertrag
- **Nebenkostenabrechnung**: Jährliche Abrechnung umlagefähiger Kosten gegenüber dem Mieter
- **Umlageschlüssel**: Verteilungsschlüssel für Nebenkosten (Fläche, Personen, Verbrauch, direkt, manuell)
- **Kaution**: Mietsicherheit, die getrennt von regulären Einnahmen geführt wird
- **Werbungskosten**: Steuerlich abzugsfähige Kosten im Zusammenhang mit Vermietung
- **Cashflow**: Differenz zwischen Einnahmen und Ausgaben in einem Zeitraum
- **Audit_Log**: Protokollierung von Änderungen an Klassifikationen
- **Benutzer**: Eine authentifizierte Person, die das System nutzt

## Requirements

### Anforderung 1: Authentifizierung

**User Story:** Als Benutzer möchte ich mich sicher anmelden können, damit nur ich auf meine Vermietungsdaten zugreifen kann.

#### Akzeptanzkriterien

1. WHEN ein Benutzer gültige E-Mail und Passwort übermittelt, THE System SHALL ein JWT-Token ausstellen und den Benutzer authentifizieren
2. WHEN ein Benutzer ungültige Anmeldedaten übermittelt, THE System SHALL eine Fehlermeldung „Ungültige Anmeldedaten" anzeigen ohne Details zur Fehlerursache preiszugeben
3. WHEN ein JWT-Token abgelaufen ist, THE System SHALL den Benutzer zur erneuten Anmeldung auffordern
4. THE System SHALL Passwörter ausschließlich als kryptografische Hashes speichern

### Anforderung 2: Objektverwaltung

**User Story:** Als Vermieter möchte ich meine Immobilienobjekte anlegen und verwalten, damit ich alle relevanten Stammdaten strukturiert erfasse.

#### Akzeptanzkriterien

1. THE System SHALL das Anlegen, Bearbeiten, Anzeigen und Löschen von Objekten ermöglichen
2. WHEN ein Objekt angelegt oder bearbeitet wird, THE System SHALL folgende Pflichtfelder validieren: Bezeichnung (maximal 100 Zeichen), Straße (maximal 150 Zeichen), PLZ (genau 5 Ziffern), Ort (maximal 100 Zeichen), Objekttyp (ein Wert aus: Wohnung, Haus, Gewerbe, Garage, Grundstück), Wohnfläche (numerisch, 1 bis 99.999 Quadratmeter)
3. THE System SHALL mindestens 100 Objekte pro Benutzer unterstützen
4. IF ein Objekt gelöscht werden soll, das verknüpfte Buchungen enthält, THEN THE System SHALL die Löschung verhindern und eine Fehlermeldung anzeigen, die den Grund der Verhinderung benennt
5. IF ein Pflichtfeld beim Anlegen oder Bearbeiten eines Objekts leer ist oder den Validierungsregeln nicht entspricht, THEN THE System SHALL die Speicherung verhindern und pro ungültigem Feld eine Fehlermeldung anzeigen, die das betroffene Feld und die Anforderung benennt

### Anforderung 3: Anschaffungsdaten und Kaufpreisaufteilung

**User Story:** Als Vermieter möchte ich die Anschaffungsdaten meiner Immobilie erfassen und den Kaufpreis in Gebäude- und Grundstücksanteil aufteilen, damit die AfA-Bemessungsgrundlage korrekt ermittelt wird.

#### Akzeptanzkriterien

1. WHEN ein Objekt angelegt wird, THE System SHALL die Erfassung folgender Felder ermöglichen: Kaufpreis (0,01 bis 99.999.999,99 EUR), Kaufdatum, Übergabedatum, sowie Nebenkosten aufgeschlüsselt nach Notar, Grunderwerbsteuer, Grundbuch und Makler (jeweils 0,00 bis 99.999.999,99 EUR)
2. WHEN der Benutzer Gebäudeanteil und Grund-und-Boden-Anteil eingibt, THE System SHALL validieren, dass die Summe beider Anteile dem eingegebenen Kaufpreis auf den Cent genau entspricht
3. IF die Summe aus Gebäudeanteil und Grund-und-Boden-Anteil nicht dem Kaufpreis entspricht, THEN THE System SHALL eine Fehlermeldung anzeigen, die auf die Abweichung hinweist, und die Eingabe zur Korrektur beibehalten
4. THE System SHALL die Nebenkosten im gleichen Verhältnis wie die Kaufpreisaufteilung (Gebäudeanteil zu Grund-und-Boden-Anteil) auf Gebäude und Grundstück aufteilen
5. THE System SHALL die AfA-Bemessungsgrundlage berechnen als Summe aus Gebäudeanteil des Kaufpreises und dem Gebäudeanteil der Nebenkosten (Notar, Grunderwerbsteuer, Grundbuch, Makler)
6. THE System SHALL den Grund-und-Boden-Anteil des Kaufpreises sowie den Grund-und-Boden-Anteil der Nebenkosten von der AfA-Bemessungsgrundlage ausschließen

### Anforderung 4: Mieterverwaltung

**User Story:** Als Vermieter möchte ich Mieter mit Kontaktdaten anlegen und verwalten, damit ich eine strukturierte Übersicht meiner Mieter habe.

#### Akzeptanzkriterien

1. THE System SHALL das Anlegen, Bearbeiten, Anzeigen und Löschen von Mietern ermöglichen
2. WHEN ein Mieter angelegt oder bearbeitet wird, THE System SHALL mindestens Vorname (1–50 Zeichen) und Nachname (1–50 Zeichen) als Pflichtfelder validieren sowie optional E-Mail-Adresse, Telefonnummer und Anschrift erfassen
3. IF die Validierung beim Anlegen oder Bearbeiten eines Mieters fehlschlägt, THEN THE System SHALL die Speicherung verhindern, die fehlerhaften Felder kennzeichnen und eine Fehlermeldung anzeigen, die den Validierungsfehler beschreibt
4. IF ein Mieter gelöscht werden soll, der einen aktiven Mietvertrag hat, THEN THE System SHALL die Löschung verhindern und eine Fehlermeldung anzeigen, die auf den bestehenden aktiven Mietvertrag hinweist

### Anforderung 5: Mietvertragsverwaltung

**User Story:** Als Vermieter möchte ich Mietverträge mit allen relevanten Konditionen erfassen, damit Sollstellungen automatisch generiert werden können.

#### Akzeptanzkriterien

1. THE System SHALL das Anlegen, Bearbeiten, Anzeigen und Beenden von Mietverträgen ermöglichen
2. WHEN ein Mietvertrag angelegt oder bearbeitet wird, THE System SHALL folgende Pflichtfelder validieren: Objekt, Mieter, Mietbeginn, Kaltmiete (Wertebereich 0,01 bis 99.999,99 EUR) und Fälligkeitstag (1 bis 28)
3. IF bei der Anlage oder Bearbeitung eines Mietvertrags ein Pflichtfeld fehlt oder einen ungültigen Wert enthält, THEN THE System SHALL das Speichern verhindern und je ungültigem Feld eine Fehlermeldung anzeigen, die den Grund der Ablehnung benennt
4. THE System SHALL bei der Vertragsanlage die Auswahl eines Mietmodells aus „konstant", „staffel", „index" und „manuell" ermöglichen, wobei das gewählte Modell die Berechnung zukünftiger Mietanpassungen steuert
5. WHILE ein Mietvertrag den Status „aktiv" hat, THE System SHALL spätestens 5 Tage vor dem Fälligkeitstag eine monatliche Sollstellung generieren, bestehend aus Kaltmiete, Betriebskostenvorauszahlung und Heizkostenvorauszahlung
6. WHEN ein Mietvertrag beendet wird, THE System SHALL keine weiteren Sollstellungen nach dem Mietende generieren und alle bereits generierten Sollstellungen mit Fälligkeitsdatum nach dem Mietende stornieren

### Anforderung 6: Kautionsverwaltung

**User Story:** Als Vermieter möchte ich Kautionen getrennt von regulären Mieteinnahmen verwalten, damit die Kaution korrekt als Mietsicherheit geführt wird.

#### Akzeptanzkriterien

1. THE System SHALL Kautionen in einem eigenen Bereich getrennt von regulären Mieteinnahmen erfassen und anzeigen, sodass Kautionsbuchungen nicht in der Liste der Mieteinnahmen erscheinen und umgekehrt
2. WHEN eine Kaution erfasst wird, THE System SHALL Betrag (0,01 bis 999.999,99 EUR), Eingangsdatum und Kontoreferenz (maximal 34 Zeichen) als Pflichtfelder validieren
3. IF bei der Kautionserfassung ein Pflichtfeld fehlt oder der Betrag außerhalb des gültigen Bereichs liegt, THEN THE System SHALL die Erfassung ablehnen und eine Fehlermeldung anzeigen, die das betroffene Feld benennt
4. THE System SHALL den Kautionsstatus verwalten und ausschließlich folgende Übergänge zulassen: von „hinterlegt" zu „teilweise zurückgezahlt" oder „vollständig zurückgezahlt" oder „verrechnet", und von „teilweise zurückgezahlt" zu „vollständig zurückgezahlt" oder „verrechnet"
5. WHEN eine teilweise Rückzahlung erfasst wird, THE System SHALL den zurückgezahlten Betrag und das Rückzahlungsdatum speichern und den verbleibenden Kautionsbetrag als Differenz aus Ursprungsbetrag und Summe aller bisherigen Rückzahlungen anzeigen
6. THE System SHALL Kautionseingänge nicht als regulären Mietertrag in Einnahmenberichten ausweisen

### Anforderung 7: Einnahmenerfassung und Soll/Ist-Vergleich

**User Story:** Als Vermieter möchte ich Mieteinnahmen erfassen und mit den Sollstellungen vergleichen, damit ich Zahlungsrückstände sofort erkenne.

#### Akzeptanzkriterien

1. THE System SHALL Einnahmen mit Buchungsdatum, Betrag (0,01 bis 999.999,99), Gegenpartei (maximal 100 Zeichen) und Kategorie erfassen, wobei alle Felder Pflichtfelder sind
2. THE System SHALL einen monatlichen Soll/Ist-Vergleich pro Mietvertrag anzeigen, der die Summe der Sollstellungen, die Summe der zugeordneten Zahlungen und die Differenz enthält
3. THE System SHALL den Zahlungsstatus pro Sollstellung führen: offen, bezahlt, teilbezahlt, überfällig
4. WHEN eine Zahlung einer Sollstellung zugeordnet wird und den Sollbetrag nicht vollständig deckt, THE System SHALL den Status auf „teilbezahlt" setzen und den offenen Restbetrag anzeigen
5. WHEN eine Sollstellung am Fälligkeitstag bis Tagesende (23:59 Uhr) nicht vollständig bezahlt ist, THE System SHALL den Status auf „überfällig" setzen
6. WHEN eine Zahlung den Sollbetrag einer Sollstellung übersteigt, THE System SHALL den Status auf „bezahlt" setzen und den überschüssigen Betrag als nicht zugeordnetes Guthaben ausweisen
7. IF bei der Einnahmenerfassung ein Pflichtfeld leer ist oder der Betrag außerhalb des gültigen Bereichs liegt, THEN THE System SHALL die Erfassung ablehnen und eine Fehlermeldung anzeigen, die das betroffene Feld benennt

### Anforderung 8: Ausgabenerfassung mit Split-Buchungen

**User Story:** Als Vermieter möchte ich Ausgaben erfassen und bei Bedarf in Teilbuchungen aufteilen, damit jede Kostenkomponente korrekt klassifiziert wird.

#### Akzeptanzkriterien

1. THE System SHALL Ausgaben mit Buchungsdatum, Betrag (0,01 bis 999.999.999,99), Gegenpartei (maximal 200 Zeichen), Kategorie und Beschreibung (maximal 500 Zeichen) erfassen
2. THE System SHALL das Aufteilen einer Buchung in mindestens 2 und höchstens 20 Teilbuchungen (Split) ermöglichen
3. WHEN eine Buchung in Teilbuchungen aufgeteilt wird, THE System SHALL validieren, dass die Summe aller Teilbeträge centgenau dem Gesamtbetrag der Buchung entspricht
4. THE System SHALL pro Teilbuchung eine eigene Kategorie und Klassifikations-Flags (umlagefähig, steuerlich abziehbar, aktivierungspflichtig, finanzierungsbezogen) ermöglichen
5. THE System SHALL den Upload von Belegen (PDF, JPEG, PNG; maximal 10 MB pro Datei, maximal 10 Belege pro Buchung) zu jeder Buchung ermöglichen
6. THE System SHALL Buchungen nach Jahr, Kategorie, Objekt und Klassifikations-Flags (umlagefähig, steuerlich abziehbar, aktivierungspflichtig, finanzierungsbezogen) filterbar machen
7. IF die Summe der Teilbeträge nicht dem Gesamtbetrag entspricht, THEN THE System SHALL das Speichern der Aufteilung verhindern und eine Fehlermeldung mit der Differenz zwischen Teilsumme und Gesamtbetrag anzeigen

### Anforderung 9: Kategorien und Regelwerk

**User Story:** Als Vermieter möchte ich ein konfigurierbares Regelwerk für Kategorien nutzen, damit Standardklassifikationen automatisch angewendet werden und ich sie bei Bedarf überschreiben kann.

#### Akzeptanzkriterien

1. THE System SHALL vorbefüllte Standardkategorien für Einnahmen und Ausgaben bereitstellen (gemäß deutschem Mietrecht), wobei jede Kategorie einen eindeutigen Namen mit maximal 100 Zeichen besitzt
2. THE System SHALL pro Kategorie konfigurierbare Standardregeln als boolesche Flags speichern: umlagefähig, steuerlich abziehbar, aktivierungspflichtig, finanzierungsbezogen
3. WHEN eine Buchung einer Kategorie zugeordnet wird, THE System SHALL die Standardregeln der Kategorie als Vorbelegung für die Klassifikations-Flags der Buchung übernehmen
4. THE System SHALL das manuelle Überschreiben jedes einzelnen Klassifikations-Flags pro Buchung ermöglichen, wobei manuell gesetzte Werte bei nachträglicher Änderung der Kategorie-Standardregeln erhalten bleiben
5. WHEN eine Klassifikation manuell geändert wird, THE System SHALL die Änderung im Audit_Log protokollieren mit Zeitstempel, Benutzer, betroffenem Flag, vorherigem Wert und neuem Wert
6. THE System SHALL das Anlegen, Bearbeiten und Deaktivieren benutzerdefinierter Kategorien ermöglichen, wobei maximal 50 benutzerdefinierte Kategorien pro Objekt angelegt werden können
7. IF eine Kategorie deaktiviert wird, THEN THE System SHALL bestehende Buchungen mit dieser Kategorie unverändert beibehalten und die deaktivierte Kategorie bei Neuzuordnungen nicht mehr zur Auswahl anbieten
8. IF beim Anlegen oder Bearbeiten einer Kategorie ein bereits existierender Name eingegeben wird, THEN THE System SHALL die Speicherung ablehnen und eine Fehlermeldung anzeigen, die auf den Namenskonflikt hinweist

### Anforderung 10: AfA-Berechnung

**User Story:** Als Vermieter möchte ich die jährliche Gebäudeabschreibung automatisch berechnen lassen, damit ich die steuerlich relevanten AfA-Beträge korrekt ausweise.

#### Akzeptanzkriterien

1. THE System SHALL die jährliche AfA nach der linearen Methode berechnen als Produkt aus AfA-Bemessungsgrundlage und AfA-Satz, wobei das Ergebnis auf zwei Nachkommastellen kaufmännisch gerundet wird
2. WHEN das Erstjahr der AfA nicht am 1. Januar beginnt, THE System SHALL die AfA pro rata temporis berechnen, wobei angefangene Monate als volle Monate zählen und der Jahresbetrag mit dem Faktor (verbleibende Monate / 12) multipliziert wird
3. THE System SHALL einen AfA-Plan über die gesamte Restlaufzeit generieren, der pro Jahr den AfA-Betrag, die kumulierte AfA und den Restwert (Bemessungsgrundlage minus kumulierte AfA) ausweist, bis der Restwert 0,00 EUR erreicht
4. THE System SHALL den Grund-und-Boden-Anteil, angegeben als prozentualer Anteil am Gesamtkaufpreis, von der AfA-Bemessungsgrundlage abziehen, sodass nur der Gebäudeanteil abgeschrieben wird
5. THE System SHALL AfA-Buchungen als nicht zahlungswirksam, aber steuerlich relevant kennzeichnen
6. IF die AfA-Bemessungsgrundlage kleiner oder gleich 0 ist oder der AfA-Satz außerhalb des Bereichs von 0,01 % bis 100 % liegt, THEN THE System SHALL die Berechnung ablehnen und eine Fehlermeldung anzeigen, die auf den ungültigen Eingabewert hinweist

### Anforderung 11: Darlehensverwaltung

**User Story:** Als Vermieter möchte ich meine Immobiliendarlehen mit allen Zahlungen verwalten, damit ich Zinsaufwand und Restschuld jederzeit nachvollziehen kann.

#### Akzeptanzkriterien

1. THE System SHALL Darlehensstammdaten erfassen: Darlehensgeber (max. 100 Zeichen), Vertragsnummer (max. 50 Zeichen), Darlehenssumme (0,01 bis 99.999.999,99 EUR), Zinssatz (0,00 % bis 99,99 %), Tilgungssatz (0,00 % bis 99,99 %), Startdatum, Enddatum, Sollzinsbindung in Monaten und Zuordnung zu einer Immobilie
2. IF bei der Erfassung von Darlehensstammdaten das Enddatum vor dem Startdatum liegt oder Pflichtfelder leer sind, THEN THE System SHALL die Speicherung verweigern und eine Fehlermeldung anzeigen, die das ungültige Feld benennt
3. THE System SHALL Darlehenszahlungen mit Datum und getrennter Erfassung von Zinsanteil, Tilgungsanteil, Gebührenanteil und Sondertilgung (jeweils 0,00 bis 99.999.999,99 EUR) ermöglichen
4. THE System SHALL die aktuelle Restschuld pro Darlehen berechnen als: Darlehenssumme abzüglich der Summe aller erfassten Tilgungsanteile und Sondertilgungen, und den zeitlichen Restschuldverlauf als Liste aller Zahlungen mit jeweiligem Restschuld-Stand anzeigen
5. WHEN eine Darlehenszahlung erfasst wird, THE System SHALL den Zinsanteil und den Gebührenanteil als Werbungskosten klassifizieren und den Tilgungsanteil sowie die Sondertilgung als steuerlich nicht abziehbar kennzeichnen

### Anforderung 12: Cashflow und Renditeberechnung

**User Story:** Als Vermieter möchte ich den Cashflow und die Rendite meiner Kapitalanlage einsehen, damit ich die wirtschaftliche Performance bewerten kann.

#### Akzeptanzkriterien

1. THE System SHALL den monatlichen und jährlichen Cashflow berechnen als Differenz von Mieteinnahmen und zahlungswirksamen Ausgaben (Zinsen, Hausgeld/Betriebskosten, Instandhaltungsrücklage, Verwaltungskosten und sonstige nicht umlagefähige Kosten), wobei Beträge auf zwei Dezimalstellen in Euro gerundet werden
2. THE System SHALL den Cashflow vor Tilgung (Einnahmen minus Ausgaben ohne Tilgungsanteil) und den Cashflow nach Tilgung (Einnahmen minus Ausgaben inklusive Tilgungsanteil) als jeweils separate Werte ausweisen
3. THE System SHALL die Bruttomietrendite berechnen als (Jahres-Kaltmiete ÷ Gesamtinvestitionskosten) × 100, wobei Gesamtinvestitionskosten die Summe aus Kaufpreis und Kaufnebenkosten (Grunderwerbsteuer, Notar, Makler) darstellen, und das Ergebnis als Prozentwert mit zwei Dezimalstellen anzeigen
4. THE System SHALL die Nettomietrendite berechnen als ((Jahres-Kaltmiete minus jährliche nicht umlagefähige Kosten) ÷ Gesamtinvestitionskosten) × 100 und das Ergebnis als Prozentwert mit zwei Dezimalstellen anzeigen
5. IF für die Berechnung erforderliche Eingabewerte fehlen oder die Gesamtinvestitionskosten den Wert null haben, THEN THE System SHALL anstelle des Ergebnisses einen Hinweis anzeigen, dass die Berechnung aufgrund fehlender Daten nicht möglich ist

### Anforderung 13: Nebenkostenabrechnung

**User Story:** Als Vermieter möchte ich eine Nebenkostenabrechnung für meine Mieter erstellen, damit ich umlagefähige Kosten korrekt abrechnen kann.

#### Akzeptanzkriterien

1. THE System SHALL die Auswahl eines Abrechnungszeitraums mit einem Start- und Enddatum ermöglichen, wobei der Zeitraum mindestens 1 Monat und höchstens 12 Monate betragen darf
2. THE System SHALL ausschließlich als umlagefähig klassifizierte Kosten in die Nebenkostenabrechnung aufnehmen und nicht umlagefähige Kosten ausschließen
3. THE System SHALL folgende Umlageschlüssel unterstützen und den Mieteranteil wie folgt berechnen: nach Fläche (anteilig zur Wohnfläche des Mieters an der Gesamtfläche), nach Personen (anteilig zur Personenzahl im Haushalt an der Gesamtpersonenzahl), nach Verbrauch (anteilig zum individuellen Verbrauch am Gesamtverbrauch), direkt (Kosten vollständig einem Mieter zugeordnet), manuell (Vermieter gibt einen prozentualen Anteil zwischen 0,01 % und 100 % ein)
4. THE System SHALL die Vorauszahlungen des Mieters im Abrechnungszeitraum den auf ihn entfallenden tatsächlichen Kosten gegenüberstellen und die Differenz als Guthaben (Vorauszahlungen höher als Kosten) oder Nachzahlung (Kosten höher als Vorauszahlungen) auf zwei Dezimalstellen in Euro berechnen
5. IF für eine Kostenposition mit Umlageschlüssel „Verbrauch" keine Verbrauchsdaten vorliegen, THEN THE System SHALL diese Kostenposition in der Abrechnung als unvollständig kennzeichnen und den Vermieter darauf hinweisen
6. THE System SHALL einen Nebenkostenabrechnungsentwurf als PDF exportieren, der mindestens folgende Angaben enthält: Abrechnungszeitraum, Auflistung aller umlagefähigen Kostenpositionen mit Gesamtbetrag und Mieteranteil, angewandter Umlageschlüssel pro Kostenposition, Summe der Vorauszahlungen und resultierende Gutschrift oder Nachzahlung
7. IF für den gewählten Abrechnungszeitraum keine Vorauszahlungen des Mieters erfasst sind, THEN THE System SHALL die Berechnung mit einem Vorauszahlungsbetrag von 0,00 EUR durchführen und den Vermieter mit einem Hinweis darauf aufmerksam machen

### Anforderung 14: Dokumentenverwaltung

**User Story:** Als Vermieter möchte ich Dokumente hochladen und mit Objekten, Buchungen oder Verträgen verknüpfen, damit ich alle Belege zentral und auffindbar ablege.

#### Akzeptanzkriterien

1. THE System SHALL den Upload von Dokumenten der Typen PDF, JPEG und PNG mit einer maximalen Dateigröße von 20 MB ermöglichen und dabei Dateiname (maximal 255 Zeichen), Dateityp und Hochladedatum automatisch erfassen
2. THE System SHALL die Verknüpfung eines Dokuments mit mindestens einem und bis zu 10 Objekten, Buchungen, Darlehen oder Mietverträgen gleichzeitig ermöglichen
3. WHEN der Benutzer eine Suche mit einem Suchbegriff ausführt, THE System SHALL alle Dokumente zurückgeben, deren Schlagwörter oder Dokumenttyp den Suchbegriff als Teilzeichenkette enthalten, wobei pro Dokument maximal 10 Schlagwörter mit jeweils maximal 50 Zeichen vergeben werden können
4. THE System SHALL hochgeladene Dokumente im lokalen Filesystem oder S3-kompatiblem Speicher ablegen
5. IF eine hochgeladene Datei einen nicht unterstützten Dateityp hat oder die maximale Dateigröße von 20 MB überschreitet, THEN THE System SHALL den Upload ablehnen und eine Fehlermeldung anzeigen, die den Ablehnungsgrund benennt

### Anforderung 15: Erinnerungen

**User Story:** Als Vermieter möchte ich Erinnerungen für wichtige Termine und Aufgaben anlegen, damit ich keine Fristen verpasse.

#### Akzeptanzkriterien

1. THE System SHALL einmalige und wiederkehrende Erinnerungen mit Titel (maximal 100 Zeichen), Fälligkeitsdatum, optionaler Notiz und Priorität (hoch, mittel, niedrig) ermöglichen, wobei wiederkehrende Erinnerungen die Intervalle täglich, wöchentlich, monatlich und jährlich unterstützen
2. THE System SHALL Erinnerungen mit einem Objekt oder einem anderen Bezugsobjekt (Mietvertrag, Darlehen) verknüpfen können
3. WHILE Erinnerungen mit Status „offen" das Fälligkeitsdatum erreicht oder überschritten haben, THE System SHALL diese im Dashboard-Widget ohne Scrollen sichtbar anzeigen, sortiert nach Priorität (hoch vor mittel vor niedrig) und aufsteigendem Fälligkeitsdatum
4. THE System SHALL den Erinnerungsstatus verwalten: offen, erledigt, verschoben — wobei der Übergang zu „verschoben" die Angabe eines neuen Fälligkeitsdatums erfordert, das nach dem aktuellen Datum liegt
5. IF der Benutzer eine Erinnerung ohne Titel oder mit einem Fälligkeitsdatum in der Vergangenheit anlegt, THEN THE System SHALL die Speicherung ablehnen und eine Fehlermeldung anzeigen, die das fehlende oder ungültige Feld benennt
6. WHEN eine wiederkehrende Erinnerung als „erledigt" markiert wird, THE System SHALL automatisch die nächste Erinnerung gemäß dem definierten Intervall mit Status „offen" erzeugen

### Anforderung 16: Berichte und Exporte

**User Story:** Als Vermieter möchte ich steuerliche Jahresberichte und Übersichten generieren und exportieren, damit ich meine Steuererklärung vorbereiten kann.

#### Akzeptanzkriterien

1. THE System SHALL folgende Berichte generieren: Jahresübersicht steuerlich, Werbungskosten, AfA-Plan, Zins-/Tilgungsübersicht, Mieteingangsstatus, Belegvollständigkeit
2. THE System SHALL Berichte in den Formaten CSV, Excel und PDF exportieren
3. THE System SHALL Berichte nach Objekt und Jahr filterbar machen
4. THE System SHALL aktivierungspflichtige Kosten nicht im laufenden Werbungskostenbericht ausweisen, sondern separat darstellen
5. THE System SHALL einen Hinweis anzeigen, dass die Berichte keine rechtsverbindliche Steueraussage darstellen, sondern der Vorbereitung dienen
6. IF für den gewählten Berichtszeitraum keine Buchungen vorhanden sind, THEN THE System SHALL den Bericht mit Nullwerten generieren und einen Hinweis anzeigen, dass keine Daten für den Zeitraum vorliegen

### Anforderung 17: Dashboard

**User Story:** Als Vermieter möchte ich auf einen Blick die wichtigsten Kennzahlen meiner Kapitalanlage sehen, damit ich den aktuellen Status schnell erfasse.

#### Akzeptanzkriterien

1. THE System SHALL auf der Startseite Karten mit folgenden Kennzahlen anzeigen: Mieteingänge offen/bezahlt (Anzahl und Summe in Euro), Einnahmen YTD, Ausgaben YTD, Werbungskosten YTD, AfA YTD, Zinsen YTD, Cashflow YTD — wobei alle Beträge in Euro mit zwei Dezimalstellen dargestellt werden
2. THE System SHALL offene Erinnerungen, fehlende Belege und ungeklärte Buchungen im Dashboard jeweils mit einer Zähleranzeige in einem separaten Bereich „Handlungsbedarf" darstellen, sodass der Benutzer die Anzahl offener Punkte pro Kategorie ablesen kann
3. IF der Benutzer mehrere Objekte verwaltet, THEN THE System SHALL einen Objektfilter im Dashboard anzeigen, der standardmäßig „Alle Objekte" (aggregiert) zeigt und die Auswahl einzelner Objekte ermöglicht
4. IF keine Transaktionen oder Buchungen für den gewählten Zeitraum vorliegen, THEN THE System SHALL die Kennzahlen mit dem Wert 0,00 € anzeigen und im Bereich „Handlungsbedarf" den Hinweis darstellen, dass keine offenen Punkte vorhanden sind
5. WHEN der Benutzer das Dashboard öffnet, THE System SHALL die Kennzahlen innerhalb von 3 Sekunden nach Seitenaufruf vollständig laden und anzeigen

### Anforderung 18: Einstellungen

**User Story:** Als Vermieter möchte ich Anwendungseinstellungen konfigurieren, damit ich das System an meine Bedürfnisse anpassen kann.

#### Akzeptanzkriterien

1. THE System SHALL die Konfiguration von Benutzerprofil-Daten (Name, E-Mail) ermöglichen, wobei Name maximal 100 Zeichen lang sein darf und E-Mail einem gültigen E-Mail-Format entsprechen muss
2. WHEN der Benutzer Profildaten erfolgreich ändert, THE System SHALL die aktualisierten Daten speichern und eine Bestätigungsmeldung anzeigen
3. THE System SHALL die Passwortänderung mit Eingabe des aktuellen Passworts und eines neuen Passworts mit mindestens 8 Zeichen ermöglichen
4. IF das eingegebene aktuelle Passwort nicht korrekt ist, THEN THE System SHALL die Passwortänderung ablehnen und eine Fehlermeldung anzeigen, die auf ein falsches aktuelles Passwort hinweist
5. THE System SHALL die Verwaltung der Standardkategorien und des Regelwerks über einen Navigationsbereich innerhalb der Einstellungen zugänglich machen

### Anforderung 19: Buchungsvalidierung und Integritätsregeln

**User Story:** Als Vermieter möchte ich, dass das System fachliche Integritätsregeln durchsetzt, damit keine fehlerhaften Daten entstehen.

#### Akzeptanzkriterien

1. WHEN der Benutzer eine Buchung speichert, THE System SHALL validieren, dass der Buchung mindestens eine Kategorie zugeordnet ist, und IF keine Kategorie zugeordnet ist, THEN THE System SHALL das Speichern verhindern und eine Fehlermeldung anzeigen, die auf die fehlende Kategorie hinweist
2. WHEN eine Buchung in Teilbuchungen aufgeteilt wird, THE System SHALL validieren, dass die Summe der Teilbeträge centgenau dem Gesamtbetrag entspricht, und IF die Summe abweicht, THEN THE System SHALL das Speichern verhindern und die Differenz in der Fehlermeldung ausweisen
3. WHEN eine Darlehenszahlung erfasst wird, THE System SHALL die Eingabe von Zinsanteil und Tilgungsanteil als getrennte Pflichtfelder verlangen und validieren, dass deren Summe dem Gesamtbetrag der Zahlung entspricht
4. WHEN eine AfA-Buchung erstellt wird, THE System SHALL diese automatisch als nicht zahlungswirksam kennzeichnen, sodass sie in Liquiditätsberechnungen nicht berücksichtigt wird
5. WHEN Kosten erfasst werden, deren Einzelbetrag den steuerlichen Schwellenwert für sofort abziehbare Werbungskosten übersteigt, THE System SHALL den Benutzer auffordern zu entscheiden, ob die Kosten als aktivierungspflichtig (Abschreibung über Nutzungsdauer) oder als laufende Werbungskosten behandelt werden sollen
6. WHEN eine Kautionszahlung erfasst wird, THE System SHALL diese als durchlaufenden Posten in einem separaten Kautionskonto führen und von den regulären Mieteinnahmen ausschließen
7. IF eine Integritätsvalidierung fehlschlägt, THEN THE System SHALL die betroffenen Eingabefelder visuell hervorheben, die ursprünglichen Eingabedaten beibehalten und das Speichern der Buchung verhindern, bis alle Validierungsregeln erfüllt sind

### Anforderung 20: Audit-Log

**User Story:** Als Vermieter möchte ich nachvollziehen können, wann und warum Klassifikationen geändert wurden, damit ich eine revisionssichere Dokumentation habe.

#### Akzeptanzkriterien

1. WHEN eine Klassifikation (umlagefähig, steuerlich abziehbar, aktivierungspflichtig) manuell geändert wird, THE System SHALL einen Audit_Log-Eintrag mit Zeitstempel (ISO 8601, Sekundengenauigkeit), Benutzerkennung, vorherigem Wert, neuem Wert und einem vom Benutzer eingegebenen Änderungsgrund (maximal 500 Zeichen) erstellen
2. IF das Erstellen eines Audit_Log-Eintrags fehlschlägt, THEN THE System SHALL die zugehörige Klassifikationsänderung abbrechen und eine Fehlermeldung anzeigen, die darauf hinweist, dass die Änderung nicht gespeichert werden konnte
3. THE System SHALL den Audit_Log pro Buchung und pro Teilbuchung als chronologisch sortierte Liste anzeigen, filterbar nach Zeitraum und Änderungstyp, mit einer Anzeige von maximal 50 Einträgen pro Seite
4. THE System SHALL Audit_Log-Einträge unveränderlich speichern, sodass kein Benutzer – unabhängig von seiner Rolle – Einträge bearbeiten oder löschen kann
5. THE System SHALL Audit_Log-Einträge für mindestens 10 Jahre aufbewahren

### Anforderung 21: Deutsche Benutzeroberfläche

**User Story:** Als deutschsprachiger Vermieter möchte ich die gesamte Anwendung auf Deutsch nutzen, damit ich alle Begriffe im steuerlichen und mietrechtlichen Kontext sofort verstehe.

#### Akzeptanzkriterien

1. THE System SHALL alle UI-Texte, Menüpunkte, Formularlabels, Fehlermeldungen und Tooltips auf Deutsch anzeigen
2. THE System SHALL deutsche Zahlenformate verwenden (Komma als Dezimaltrennzeichen, Punkt als Tausendertrennzeichen) und Währungsbeträge mit genau 2 Dezimalstellen darstellen
3. THE System SHALL deutsche Datumsformate verwenden (TT.MM.JJJJ) für alle angezeigten Datumswerte
4. THE System SHALL die Hauptnavigation in folgender Reihenfolge anzeigen: Dashboard, Objekt, Mieter und Mietvertrag, Einnahmen, Ausgaben, Darlehen, AfA, Nebenkosten, Dokumente, Berichte, Erinnerungen, Einstellungen
5. WHEN der Benutzer einen numerischen Wert oder ein Datum in ein Eingabefeld eingibt, THE System SHALL die Eingabe im deutschen Format (Komma als Dezimaltrennzeichen, TT.MM.JJJJ für Datum) akzeptieren und verarbeiten
6. IF der Benutzer einen Wert eingibt der nicht dem erwarteten deutschen Format entspricht, THEN THE System SHALL eine Fehlermeldung anzeigen die das erwartete Format beschreibt und die Eingabe nicht übernehmen

### Anforderung 22: Mehrobjektfähigkeit

**User Story:** Als Vermieter mit mehreren Immobilien möchte ich alle Objekte in einer Anwendung verwalten, damit ich eine konsolidierte Übersicht habe.

#### Akzeptanzkriterien

1. THE System SHALL ein mehrobjektfähiges Datenmodell verwenden, bei dem jede Buchung, jeder Mietvertrag, jedes Darlehen und jeder Kontakt genau einem Objekt zugeordnet ist, sodass keine Entität ohne Objektzuordnung existieren kann
2. THE System SHALL alle Listen und Berichte über einen Objektfilter filterbar machen, wobei der Filter die Auswahl eines einzelnen Objekts oder aller Objekte gleichzeitig ermöglicht und standardmäßig alle Objekte anzeigt
3. THE System SHALL im Dashboard eine objektübergreifende Gesamtansicht als Standardansicht anzeigen, die aggregierte Kennzahlen über alle Objekte darstellt, sowie über eine Objektauswahl den Wechsel zu einer objektspezifischen Ansicht mit den Kennzahlen des gewählten Objekts ermöglichen
4. THE System SHALL maximal 100 Objekte pro Benutzer unterstützen, und IF ein Benutzer versucht ein weiteres Objekt über diesem Limit anzulegen, THEN THE System SHALL die Anlage verhindern und eine Fehlermeldung anzeigen, die auf das erreichte Maximum hinweist
5. IF ein Objekt gelöscht wird, THEN THE System SHALL die Löschung nur zulassen, wenn dem Objekt keine aktiven Mietverträge oder offenen Buchungen zugeordnet sind, und andernfalls eine Fehlermeldung anzeigen, die die noch vorhandenen Zuordnungen benennt

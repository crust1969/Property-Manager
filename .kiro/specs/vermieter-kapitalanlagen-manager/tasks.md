# Implementation Plan: Vermieter Kapitalanlagen Manager

## Overview

Schrittweise Implementierung des Vermieter Kapitalanlagen Managers als modulare Webanwendung mit React/TypeScript-Frontend, Fastify-Backend und SQLite-Datenbank. Die Reihenfolge folgt der Domänenlogik: Zuerst Infrastruktur und Auth, dann Stammdaten, dann Geschäftslogik, dann Auswertungen und Reports.

## Tasks

- [x] 1. Projekt-Setup (Frontend, Backend, DB-Schema, Auth)
  - [x] 1.1 Backend-Projekt initialisieren mit Fastify, TypeScript, Vitest und fast-check
    - Erstelle `backend/` mit `package.json`, `tsconfig.json`, Fastify-Server-Einstiegspunkt
    - Installiere Abhängigkeiten: fastify, better-sqlite3, uuid, bcrypt, jsonwebtoken, zod, vitest, fast-check
    - Erstelle Plugin-Struktur für Fastify (CORS, JWT-Verify, Error-Handler)
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Frontend-Projekt initialisieren mit React, TypeScript und TailwindCSS
    - Erstelle `frontend/` mit Vite, React 18, TypeScript, TailwindCSS
    - Konfiguriere Routing (React Router), API-Client (fetch-wrapper mit JWT-Header)
    - Erstelle `shared/components/` Basis (Button, Input, Modal, Card, Table)
    - Erstelle `i18n/de.ts` mit deutschen UI-Texten
    - _Requirements: 21.1, 21.4_

  - [x] 1.3 Datenbank-Schema und Migrations erstellen
    - Erstelle SQLite-Migrationssystem (sequenzielle SQL-Dateien)
    - Implementiere alle Tabellen gemäß Design: users, properties, acquisitions, tenants, leases, receivables, deposits, bookings, booking_splits, categories, loans, loan_payments, documents, document_links, reminders, audit_log, utility_billings, utility_billing_items
    - Erstelle Seed-Skript für Standardkategorien (deutsche Mietrecht-Kategorien)
    - _Requirements: 9.1, 22.1_

  - [x] 1.4 Auth-Modul implementieren (Register, Login, JWT, Middleware)
    - Implementiere `POST /api/v1/auth/register` mit Passwort-Hashing (bcrypt)
    - Implementiere `POST /api/v1/auth/login` mit JWT-Ausgabe (Access + Refresh Token)
    - Implementiere `POST /api/v1/auth/refresh` für Token-Erneuerung
    - Erstelle Auth-Middleware zur JWT-Validierung an geschützten Routen
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.5 Property-Tests für Auth schreiben
    - **Property 26: JWT-Token-Validierung** — Token wird akzeptiert gdw. nicht abgelaufen und gültige Signatur
    - **Property 27: Passwort-Hashing** — Hash ≠ Klartext, Verifikation gegen Hash liefert true
    - **Validates: Requirements 1.3, 1.4**

  - [x] 1.6 Frontend Auth-Flow implementieren (Login-Seite, Token-Handling)
    - Erstelle Login-Formular mit E-Mail/Passwort
    - Implementiere AuthProvider/Context mit Token-Speicherung (localStorage)
    - Implementiere automatische Token-Erneuerung und Redirect bei 401
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.7 Docker-Compose Setup
    - Erstelle `docker-compose.yml` mit Frontend (Nginx), Backend (Node), Volumes für DB + Dateien
    - Erstelle Dockerfiles für Frontend und Backend
    - _Requirements: Deployment-Architektur_

- [x] 2. Checkpoint — Projekt-Setup verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Objekt + Anschaffung
  - [x] 3.1 Backend: Property-CRUD implementieren (Routes, Service, Repository)
    - Implementiere `GET/POST/PUT/DELETE /api/v1/properties` und `GET /api/v1/properties/:id`
    - Validierung: Bezeichnung (1–100), Straße (1–150), PLZ (5 Ziffern), Ort (1–100), Objekttyp (Enum), Wohnfläche (1–99999)
    - Löschverhinderung bei verknüpften Buchungen/Verträgen
    - Limit 100 Objekte pro Benutzer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 22.4, 22.5_

  - [ ]* 3.2 Property-Test für Objekt-Validierung
    - **Property 3: Objekt-Validierung — Feldregeln**
    - **Validates: Requirements 2.2, 2.5**

  - [x] 3.3 Backend: Anschaffungsdaten und Kaufpreisaufteilung implementieren
    - Implementiere `GET/PUT /api/v1/properties/:id/acquisition`
    - Validierung: Kaufpreis (0,01–99.999.999,99), Nebenkosten je 0,00–99.999.999,99
    - Kaufpreisaufteilung: building_share + land_share == purchase_price (centgenau)
    - Nebenkostenverteilung proportional zur Kaufpreisaufteilung
    - AfA-Bemessungsgrundlage berechnen
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.4 Property-Tests für Kaufpreisaufteilung und AfA-Basis
    - **Property 1: Kaufpreisaufteilung — Summe der Anteile** (building_share + land_share == purchase_price)
    - **Property 2: Nebenkostenverteilung proportional zur Kaufpreisaufteilung** (AfA-Basis = B + Gebäudeanteil Nebenkosten)
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 3.5 Frontend: Objekt-Verwaltung UI
    - Objektliste mit Filtermöglichkeit
    - Erstellen/Bearbeiten-Formular mit allen Pflichtfeldern
    - Anschaffungsdaten-Formular mit Kaufpreisaufteilung und Live-Validierung
    - Anzeige der berechneten AfA-Bemessungsgrundlage
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 4. Mieter + Mietvertrag + Sollstellung
  - [x] 4.1 Backend: Mieter-CRUD implementieren
    - Implementiere `GET/POST/PUT/DELETE /api/v1/tenants`
    - Validierung: Vorname (1–50), Nachname (1–50), optionale Felder
    - Löschverhinderung bei aktivem Mietvertrag
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 Property-Test für Mieter-Validierung
    - **Property 4: Mieter-Validierung** (Vorname/Nachname 1–50 Zeichen)
    - **Validates: Requirements 4.2, 4.3**

  - [x] 4.3 Backend: Mietvertrag-Verwaltung und Sollstellungs-Generierung
    - Implementiere `GET/POST/PUT /api/v1/leases`, `POST /api/v1/leases/:id/terminate`
    - Validierung: Objekt, Mieter, Mietbeginn, Kaltmiete (0,01–99.999,99), Fälligkeitstag (1–28)
    - Mietmodell-Auswahl (konstant, staffel, index, manuell)
    - Sollstellungs-Generierung: monatlich spätestens 5 Tage vor Fälligkeitstag
    - Bei Vertragsbeendigung: keine weiteren Sollstellungen, Stornierung nach Mietende
    - Implementiere `GET /api/v1/leases/:id/receivables`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.4 Property-Test für Sollstellungs-Generierung
    - **Property 5: Sollstellungs-Generierung innerhalb Vertragslaufzeit** — Sollstellungen nur für Monate innerhalb aktiver Laufzeit, Betrag = Kaltmiete + BK-Vorauszahlung + HK-Vorauszahlung
    - **Validates: Requirements 5.5, 5.6**

  - [x] 4.5 Frontend: Mieter- und Mietvertrags-Verwaltung UI
    - Mieterliste und CRUD-Formulare
    - Mietvertragsliste mit Status-Anzeige, Anlage-/Bearbeitungsformular
    - Sollstellungsübersicht pro Vertrag
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.4_

- [x] 5. Checkpoint — Stammdaten verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Kategorien-Stammdaten + Regelwerk
  - [x] 6.1 Backend: Kategorien-CRUD und Regelwerk implementieren
    - Implementiere `GET/POST/PUT /api/v1/categories`, `POST /api/v1/categories/:id/deactivate`
    - Standardkategorien (System) mit booleschen Flags: umlagefähig, steuerlich abziehbar, aktivierungspflichtig, finanzierungsbezogen
    - Benutzerdefinierte Kategorien (max 50 pro Objekt)
    - Namens-Eindeutigkeit pro Objekt/Typ validieren
    - Deaktivierte Kategorien: bestehende Buchungen bleiben, keine Neuzuordnung möglich
    - _Requirements: 9.1, 9.2, 9.6, 9.7, 9.8_

  - [x] 6.2 Backend: Regel-Vorbelegung und manuelle Überschreibung
    - Bei Buchungszuordnung: Kategorie-Flags als Vorbelegung übernehmen
    - Manuelle Überschreibung einzelner Flags pro Buchung/Split
    - Überschriebene Flags bleiben bei Kategorie-Regeländerung erhalten
    - Audit-Log bei manueller Flag-Änderung (Zeitstempel, Benutzer, Flag, alt/neu)
    - _Requirements: 9.3, 9.4, 9.5_

  - [ ]* 6.3 Property-Tests für Kategorien-Regelwerk
    - **Property 10: Kategorie-Regeln als Vorbelegung** — Neuer Split erbt Kategorie-Flags
    - **Property 11: Manuelle Flag-Überschreibung bleibt bei Regeländerung erhalten**
    - **Validates: Requirements 9.3, 9.4**

  - [x] 6.4 Frontend: Kategorien-Verwaltung UI
    - Kategorieliste mit System-/Benutzerkategorien
    - Erstellen/Bearbeiten-Formular mit Flag-Toggles
    - Deaktivieren-Funktion
    - _Requirements: 9.1, 9.6, 9.7, 9.8_

- [x] 7. Ausgaben + Split + Belegupload
  - [x] 7.1 Backend: Ausgaben-CRUD mit Split-Buchungen
    - Implementiere `GET/POST/PUT/DELETE /api/v1/expenses`
    - Implementiere `POST/PUT /api/v1/expenses/:id/split`
    - Validierung: Datum, Betrag (0,01–999.999.999,99), Gegenpartei (max 200), Kategorie, Beschreibung (max 500)
    - Split: 2–20 Teilbuchungen, Summeninvariante centgenau
    - Pro Split: eigene Kategorie + Klassifikations-Flags
    - Filterung nach Jahr, Kategorie, Objekt, Flags
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 19.1, 19.2_

  - [ ]* 7.2 Property-Test für Split-Buchung Summeninvariante
    - **Property 9: Split-Buchung — Summeninvariante** — sum(splits) == total, 2 ≤ n ≤ 20, Fehlermeldung mit Differenz
    - **Validates: Requirements 8.3, 8.7, 19.2**

  - [x] 7.3 Backend: Dokumenten-Upload und -Verknüpfung
    - Implementiere `POST /api/v1/documents/upload` (PDF, JPEG, PNG; max 20 MB)
    - Implementiere `GET/DELETE /api/v1/documents`, `POST /api/v1/documents/:id/link`
    - Speicherung im lokalen Filesystem oder S3 (konfigurierbar)
    - Verknüpfung mit 1–10 Entitäten (property, booking, loan, lease)
    - Schlagwortsuche (max 10 Schlagwörter à 50 Zeichen)
    - Belege pro Buchung: max 10, max 10 MB pro Datei
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 8.5_

  - [x] 7.4 Frontend: Ausgaben-Verwaltung und Belegupload UI
    - Ausgabenliste mit Filtern (Jahr, Kategorie, Objekt, Flags)
    - Ausgaben-Formular mit optionalem Split-Modus
    - Split-Editor: dynamische Zeilen mit Betrag, Kategorie, Flags
    - Beleg-Upload mit Drag & Drop
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

- [x] 8. Einnahmen + Soll/Ist
  - [x] 8.1 Backend: Einnahmen-CRUD und Soll/Ist-Vergleich
    - Implementiere `GET/POST/PUT/DELETE /api/v1/income`
    - Implementiere `GET /api/v1/income/comparison?leaseId=&year=&month=`
    - Validierung: Buchungsdatum, Betrag (0,01–999.999,99), Gegenpartei (max 100), Kategorie
    - Zahlungszuordnung zu Sollstellungen
    - Soll/Ist-Vergleich: Soll-Summe, Ist-Summe, Differenz pro Monat
    - _Requirements: 7.1, 7.2, 7.7_

  - [x] 8.2 Backend: Zahlungsstatus-Logik implementieren
    - Status offen → bezahlt bei P ≥ T
    - Status offen → teilbezahlt bei 0 < P < T und nicht überfällig
    - Status → überfällig bei P < T und Fälligkeitstag überschritten (23:59)
    - Überzahlung: Status bezahlt + nicht zugeordnetes Guthaben
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

  - [ ]* 8.3 Property-Tests für Zahlungsstatus und Soll/Ist
    - **Property 8: Zahlungsstatus-Bestimmung** — Status korrekt basierend auf Betrag und Datum
    - **Property 25: Soll/Ist-Vergleich** — Soll = Summe Receivables, Ist = Summe Zahlungen, Differenz = Soll - Ist
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

  - [x] 8.4 Backend: Kautionsverwaltung implementieren
    - Implementiere `GET/POST /api/v1/deposits`, `POST /api/v1/deposits/:id/refund`
    - Validierung: Betrag (0,01–999.999,99), Eingangsdatum, Kontoreferenz (max 34)
    - State Machine: hinterlegt → teilweise/vollständig/verrechnet
    - Restbetrag-Berechnung: Original - Summe(Rückzahlungen)
    - Trennung von regulären Mieteinnahmen
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 19.6_

  - [ ]* 8.5 Property-Tests für Kautionsverwaltung
    - **Property 6: Kautionsstatus-Übergänge (State Machine)** — Nur erlaubte Transitionen akzeptiert
    - **Property 7: Kautionsrest-Berechnung** — Restbetrag = Original - Summe(Teilrückzahlungen)
    - **Validates: Requirements 6.4, 6.5**

  - [x] 8.6 Frontend: Einnahmen und Kaution UI
    - Einnahmenliste mit Soll/Ist-Vergleich-Ansicht
    - Zahlungszuordnung zu Sollstellungen
    - Kautionsverwaltung in separatem Bereich
    - Statusanzeige und Rückzahlungsdialog
    - _Requirements: 7.1, 7.2, 7.3, 6.1, 6.4_

- [x] 9. Checkpoint — Buchungslogik verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Darlehen + Zahlungen
  - [x] 10.1 Backend: Darlehen-CRUD und Zahlungen
    - Implementiere `GET/POST/PUT/DELETE /api/v1/loans`
    - Implementiere `POST/GET /api/v1/loans/:id/payments`, `GET /api/v1/loans/:id/balance`
    - Stammdaten: Darlehensgeber (max 100), Vertragsnummer (max 50), Summe, Zinssatz (0–99,99%), Tilgungssatz, Start/Enddatum, Sollzinsbindung
    - Validierung: Enddatum nach Startdatum
    - Zahlungen: Zinsanteil, Tilgung, Gebühren, Sondertilgung (je 0,00–99.999.999,99)
    - Restschuld = Darlehenssumme - Summe(Tilgung + Sondertilgung)
    - Zins + Gebühren → Werbungskosten, Tilgung → nicht abziehbar
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 19.3_

  - [ ]* 10.2 Property-Tests für Darlehen
    - **Property 14: Darlehens-Restschuld** — Restschuld = L - Summe(Tilgung) - Summe(Sondertilgung)
    - **Property 15: Darlehenszahlung — Steuerliche Klassifikation** — Zins/Gebühren = Werbungskosten, Tilgung = nicht abziehbar
    - **Property 21: Darlehenszahlung — Komponentensumme** — Gesamtbetrag = Zins + Tilgung + Gebühren + Sondertilgung
    - **Validates: Requirements 11.4, 11.5, 19.3**

  - [x] 10.3 Frontend: Darlehen-Verwaltung UI
    - Darlehensliste pro Objekt
    - Darlehen-Formular mit Stammdaten
    - Zahlungserfassung (Zins/Tilgung/Gebühren/Sondertilgung)
    - Restschuldverlauf-Anzeige
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 11. AfA-Berechnung
  - [x] 11.1 Backend: AfA-Berechnung und Plan-Generierung
    - Implementiere `GET/PUT /api/v1/depreciation/:propertyId`, `GET /api/v1/depreciation/:propertyId/plan`
    - Lineare Methode: Jahres-AfA = round(Basis × Satz, 2)
    - Pro-rata-temporis im Erstjahr: Faktor = verbleibende Monate / 12 (angefangene Monate = voll)
    - AfA-Plan: Jahr, Jahresbetrag, kumuliert, Restwert bis Restwert = 0
    - AfA-Buchungen als nicht zahlungswirksam + steuerlich relevant
    - Validierung: Basis > 0, Satz 0,01%–100%
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 19.4_

  - [ ]* 11.2 Property-Tests für AfA
    - **Property 12: AfA-Berechnung — Lineare Methode** — Jahres-AfA = round(Basis × Satz), pro-rata im Erstjahr
    - **Property 13: AfA-Plan — Invarianten** — Summe aller Jahresbeträge = Basis, Restwerte streng fallend, letzter Restwert = 0
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x] 11.3 Frontend: AfA-Anzeige UI
    - AfA-Parameter-Anzeige pro Objekt (aus Anschaffungsdaten abgeleitet)
    - AfA-Plan als Tabelle: Jahr, Betrag, kumuliert, Restwert
    - _Requirements: 10.3, 10.5_

- [x] 12. Dashboard + Kennzahlen
  - [x] 12.1 Backend: Cashflow und Rendite-Berechnung
    - Implementiere `GET /api/v1/cashflow?propertyId=&year=`
    - Implementiere `GET /api/v1/yield?propertyId=`
    - Monatlicher/jährlicher Cashflow: Einnahmen - zahlungswirksame Ausgaben (ohne AfA)
    - Cashflow vor Tilgung und nach Tilgung separat
    - Bruttomietrendite = (Jahres-Kaltmiete / Gesamtinvestition) × 100
    - Nettomietrendite = ((Jahres-Kaltmiete - nicht umlagefähige Kosten) / Gesamtinvestition) × 100
    - Fehlende Daten: Hinweis statt Berechnung
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 12.2 Property-Tests für Cashflow und Rendite
    - **Property 16: Cashflow-Berechnung** — Cashflow vor/nach Tilgung korrekt, AfA ausgeschlossen
    - **Property 17: Rendite-Berechnung** — Brutto/Netto-Rendite mit korrekten Formeln
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

  - [x] 12.3 Backend: Dashboard-KPI-Aggregation
    - Implementiere `GET /api/v1/dashboard?propertyId=`
    - Kennzahlen: Mieteingänge offen/bezahlt (Anzahl + Summe), Einnahmen YTD, Ausgaben YTD, Werbungskosten YTD, AfA YTD, Zinsen YTD, Cashflow YTD
    - Handlungsbedarf: offene Erinnerungen, fehlende Belege, ungeklärte Buchungen (jeweils Anzahl)
    - Objektfilter: "Alle Objekte" (aggregiert) oder einzelnes Objekt
    - Bei fehlenden Daten: 0,00 € anzeigen
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 12.4 Frontend: Dashboard UI
    - Kennzahlen-Karten mit Euro-Werten (2 Dezimalstellen, deutsches Format)
    - Bereich "Handlungsbedarf" mit Zähleranzeigen
    - Objektfilter-Dropdown
    - Performance: Laden innerhalb 3 Sekunden
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 13. Checkpoint — Kernberechnungen verifizieren
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Berichte + Exporte
  - [x] 14.1 Backend: Berichtsgenerierung und Export
    - Implementiere `GET /api/v1/reports/:type?propertyId=&year=&format=`
    - Berichtstypen: Jahresübersicht steuerlich, Werbungskosten, AfA-Plan, Zins-/Tilgungsübersicht, Mieteingangsstatus, Belegvollständigkeit
    - Exportformate: CSV, Excel (xlsx), PDF
    - Filter nach Objekt und Jahr
    - Aktivierungspflichtige Kosten separat, nicht im Werbungskostenbericht
    - Hinweis: keine rechtsverbindliche Steueraussage
    - Bei leerem Zeitraum: Nullwerte + Hinweis
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 14.2 Frontend: Berichte-Seite UI
    - Berichtstyp-Auswahl, Objekt-/Jahrfilter
    - Vorschau und Download in gewünschtem Format
    - Hinweis-Banner zur steuerlichen Unverbindlichkeit
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

- [ ] 15. Nebenkostenabrechnung
  - [x] 15.1 Backend: Nebenkostenabrechnung implementieren
    - Implementiere `POST/GET /api/v1/utility-billing`, `GET /api/v1/utility-billing/:id/pdf`
    - Abrechnungszeitraum: 1–12 Monate
    - Nur umlagefähige Kosten einbeziehen
    - Umlageschlüssel: Fläche, Personen, Verbrauch, direkt, manuell (0,01%–100%)
    - Saldo: Mieteranteil - Vorauszahlungen (positiv = Nachzahlung, negativ = Guthaben)
    - Bei fehlenden Verbrauchsdaten: Kostenposition als unvollständig markieren
    - Bei fehlenden Vorauszahlungen: 0,00 EUR + Hinweis
    - PDF-Export mit Abrechnungszeitraum, Kostenpositionen, Umlageschlüssel, Vorauszahlungen, Saldo
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 15.2 Property-Tests für Nebenkostenabrechnung
    - **Property 18: Nebenkostenabrechnung — nur umlagefähige Kosten** — nur is_allocable=true Splits einbezogen
    - **Property 19: Umlageschlüssel-Berechnung** — Fläche, Personen, Verbrauch, direkt, manuell korrekt berechnet
    - **Property 20: Nebenkostenabrechnung — Saldo** — Balance = Mieteranteil - Vorauszahlungen
    - **Validates: Requirements 13.2, 13.3, 13.4**

  - [x] 15.3 Frontend: Nebenkostenabrechnung UI
    - Abrechnungszeitraum-Auswahl
    - Kostenpositionen mit Umlageschlüssel-Zuordnung
    - Saldo-Anzeige (Guthaben/Nachzahlung)
    - PDF-Download
    - _Requirements: 13.1, 13.3, 13.6_

- [x] 16. Erinnerungen
  - [x] 16.1 Backend: Erinnerungs-Verwaltung
    - Implementiere `GET/POST/PUT /api/v1/reminders`, `POST /api/v1/reminders/:id/complete`, `POST /api/v1/reminders/:id/postpone`
    - Einmalig und wiederkehrend (täglich, wöchentlich, monatlich, jährlich)
    - Felder: Titel (max 100), Fälligkeitsdatum, Notiz, Priorität (hoch/mittel/niedrig)
    - Verknüpfung mit Objekt/Mietvertrag/Darlehen
    - Status: offen, erledigt, verschoben (Verschieben erfordert neues Datum in Zukunft)
    - Bei wiederkehrender Erinnerung "erledigt": nächste automatisch erzeugen
    - Validierung: Titel erforderlich, Fälligkeitsdatum nicht in Vergangenheit
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 16.2 Frontend: Erinnerungen UI
    - Erinnerungsliste mit Status und Priorität
    - Erstellen/Bearbeiten-Formular
    - Dashboard-Widget: offene/überfällige Erinnerungen sortiert nach Priorität + Datum
    - Aktionen: Erledigen, Verschieben
    - _Requirements: 15.1, 15.3, 15.4_

- [x] 17. Einstellungen + Audit-Log
  - [x] 17.1 Backend: Einstellungen und Passwortänderung
    - Implementiere `GET/PUT /api/v1/settings/profile`, `POST /api/v1/settings/password`
    - Profil: Name (max 100), E-Mail (gültiges Format)
    - Passwortänderung: aktuelles Passwort prüfen, neues min. 8 Zeichen
    - Zugang zur Kategorien-/Regelwerk-Verwaltung über Navigation
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 17.2 Backend: Audit-Log implementieren
    - Implementiere `GET /api/v1/audit-log?bookingId=&from=&to=&type=&page=&limit=`
    - Eintrag: Zeitstempel (ISO 8601), Benutzer, Flag, alter Wert, neuer Wert, Änderungsgrund (max 500)
    - Unveränderliche Speicherung (kein UPDATE/DELETE auf audit_log-Tabelle)
    - Bei Audit-Log-Fehler: Klassifikationsänderung abbrechen (transaktional)
    - Chronologische Anzeige, filterbar nach Zeitraum und Typ, max 50 pro Seite
    - Aufbewahrung mindestens 10 Jahre
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 17.3 Frontend: Einstellungen und Audit-Log UI
    - Profil-Bearbeitung mit Bestätigungsmeldung
    - Passwortänderung mit altem/neuem Passwort
    - Audit-Log-Ansicht pro Buchung/Split (chronologisch, paginiert)
    - _Requirements: 18.1, 18.2, 18.3, 20.3_

- [x] 18. Übergreifende Funktionalität
  - [x] 18.1 Deutsches Zahlen-/Datumsformat implementieren
    - Formatierungsfunktionen: Euro-Beträge mit Komma als Dezimaltrennzeichen, Punkt als Tausender
    - Parsing: deutsches Format → numerischer Wert (Eingabe akzeptieren)
    - Datumsformat TT.MM.JJJJ für Anzeige und Eingabe
    - Fehlermeldung bei ungültigem Format
    - _Requirements: 21.2, 21.3, 21.5, 21.6_

  - [ ]* 18.2 Property-Tests für Formatierung
    - **Property 22: Deutsches Zahlenformat — Round-Trip** — Format → Parse → Original
    - **Property 23: Deutsches Datumsformat — Round-Trip** — Format → Parse → Original
    - **Validates: Requirements 21.2, 21.3, 21.5**

  - [x] 18.3 Mehrobjektfähigkeit und Objektfilter fertigstellen
    - Alle Listen/Berichte mit Objektfilter versehen
    - Standard: "Alle Objekte" (aggregiert)
    - Keine Entität ohne Objektzuordnung möglich (DB-Constraints)
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ]* 18.4 Property-Test für Objektfilter
    - **Property 24: Objektfilter — Datenpartitionierung** — Filter liefert nur Entitäten mit passender property_id
    - **Validates: Requirements 22.2**

  - [x] 18.5 Buchungsvalidierung und Integritätsregeln finalisieren
    - Kategorie-Pflicht bei Buchung
    - Schwellenwert-Abfrage für Aktivierungspflicht
    - Kautionszahlungen als durchlaufende Posten im separaten Kautionskonto
    - Visuelle Hervorhebung bei Validierungsfehler, Eingabedaten beibehalten
    - _Requirements: 19.1, 19.4, 19.5, 19.6, 19.7_

- [x] 19. Finaler Checkpoint — Gesamtsystem verifizieren
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks mit `*` sind optional und können für ein schnelleres MVP übersprungen werden
- Jeder Task referenziert spezifische Anforderungen für Traceability
- Checkpoints sichern inkrementelle Validierung ab
- Property-Tests validieren universelle Korrektheitseigenschaften (fast-check mit min. 100 Iterationen)
- Unit-Tests validieren spezifische Szenarien und Grenzfälle (Vitest)
- Alle Geldbeträge intern als Integer in Cents, Formatierung nur in der Präsentationsschicht
- Deutsche UI-Texte durchgehend, konfiguriert über `i18n/de.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.7"] },
    { "id": 2, "tasks": ["1.4", "1.6"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["3.1", "6.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "6.2"] },
    { "id": 6, "tasks": ["3.4", "3.5", "6.3", "6.4"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2", "4.3"] },
    { "id": 9, "tasks": ["4.4", "4.5"] },
    { "id": 10, "tasks": ["7.1", "8.1"] },
    { "id": 11, "tasks": ["7.2", "7.3", "8.2", "8.4"] },
    { "id": 12, "tasks": ["7.4", "8.3", "8.5", "8.6"] },
    { "id": 13, "tasks": ["10.1", "11.1"] },
    { "id": 14, "tasks": ["10.2", "10.3", "11.2", "11.3"] },
    { "id": 15, "tasks": ["12.1", "12.3"] },
    { "id": 16, "tasks": ["12.2", "12.4"] },
    { "id": 17, "tasks": ["14.1", "15.1", "16.1"] },
    { "id": 18, "tasks": ["14.2", "15.2", "15.3", "16.2"] },
    { "id": 19, "tasks": ["17.1", "17.2", "18.1"] },
    { "id": 20, "tasks": ["17.3", "18.2", "18.3"] },
    { "id": 21, "tasks": ["18.4", "18.5"] }
  ]
}
```

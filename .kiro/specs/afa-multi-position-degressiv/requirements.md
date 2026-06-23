# Requirements Document

## Introduction

Erweiterung des bestehenden AfA-Moduls (Absetzung für Abnutzung) um die Unterstützung mehrerer AfA-Positionen pro Immobilie sowie die degressive Abschreibungsmethode. Bisher wird nur eine einzelne lineare AfA auf das Gebäude unterstützt. Mit diesem Feature können Vermieter zusätzliche abschreibbare Gegenstände (z.B. Einbauküche, Möblierung) mit individuellen Parametern und Methoden (linear oder degressiv) verwalten.

## Glossary

- **AfA_Position**: Ein einzelner abschreibbarer Gegenstand oder Anteil innerhalb eines Objekts (z.B. Gebäude, Einbauküche, Möblierung), mit eigenen Abschreibungsparametern.
- **AfA_System**: Das Gesamtmodul zur Verwaltung und Berechnung von Abschreibungen über alle Positionen eines Objekts.
- **Lineare_Methode**: Abschreibungsmethode, bei der jedes Jahr ein konstanter Betrag (Basis × Satz) abgeschrieben wird, bis der Restwert 0 erreicht.
- **Degressive_Methode**: Abschreibungsmethode, bei der jedes Jahr ein fester Prozentsatz vom aktuellen Restwert abgeschrieben wird. Der jährliche Betrag sinkt von Jahr zu Jahr.
- **Bemessungsgrundlage**: Der Ausgangsbetrag in Cents, auf den die Abschreibung berechnet wird.
- **AfA_Satz**: Der Prozentsatz für die Abschreibungsberechnung (z.B. 0.02 für 2%).
- **Restwert**: Der nach Abzug der bisherigen Abschreibungen verbleibende Wert einer AfA_Position in Cents.
- **Pro_Rata_Temporis**: Zeitanteilige Berechnung der AfA im ersten Jahr, basierend auf dem Startmonat.
- **Positions_Typ**: Eine frei wählbare Bezeichnung für die Art der AfA_Position (z.B. "Gebäude", "Einbauküche", "Möblierung", "Außenanlage").

## Requirements

### Requirement 1: Verwaltung mehrerer AfA-Positionen

**User Story:** Als Vermieter möchte ich mehrere AfA-Positionen pro Objekt anlegen können, damit ich verschiedene abschreibbare Bestandteile (Gebäude, Einbauküche, Möblierung) separat verwalten kann.

#### Acceptance Criteria

1. THE AfA_System SHALL allow creation of multiple AfA_Position records per property.
2. WHEN a new AfA_Position is created, THE AfA_System SHALL store the position name, depreciation method, basis amount, rate, and start date.
3. THE AfA_System SHALL support a minimum of 1 and a maximum of 20 AfA_Position records per property.
4. WHEN an AfA_Position is deleted, THE AfA_System SHALL remove the position and its associated plan data from the system.
5. THE AfA_System SHALL require each AfA_Position within a property to have a unique position name.
6. WHEN the list of AfA_Position records for a property is requested, THE AfA_System SHALL return all positions belonging to that property sorted by creation date.

### Requirement 2: Degressive Abschreibungsmethode

**User Story:** Als Vermieter möchte ich die degressive Abschreibungsmethode wählen können, damit ich Gegenstände mit einem festen Prozentsatz vom Restwert abschreiben kann (z.B. 5% vom Restwert pro Jahr).

#### Acceptance Criteria

1. THE AfA_System SHALL support two depreciation methods for each AfA_Position: "linear" and "degressiv".
2. WHEN the degressive method is selected, THE AfA_System SHALL calculate the annual depreciation as the AfA_Satz multiplied by the current Restwert of the AfA_Position.
3. WHEN the degressive method is used, THE AfA_System SHALL apply Pro_Rata_Temporis in the first year based on the start month.
4. WHILE the degressive method is active, THE AfA_System SHALL continue generating plan entries until the Restwert falls below 1 cent (rounded to 0).
5. WHEN the degressive method produces an annual amount less than 1 cent, THE AfA_System SHALL set the annual amount to the remaining Restwert and terminate the plan.

### Requirement 3: Konfigurierbare Parameter pro Position

**User Story:** Als Vermieter möchte ich für jede AfA-Position individuelle Parameter konfigurieren können, damit verschiedene Positionen mit unterschiedlichen Methoden und Sätzen berechnet werden.

#### Acceptance Criteria

1. THE AfA_System SHALL accept the following parameters for each AfA_Position: position name (Positions_Typ), depreciation method, Bemessungsgrundlage, AfA_Satz, and start date.
2. WHEN the linear method is selected, THE AfA_System SHALL accept the AfA_Satz either as a direct percentage (e.g., 0.02 for 2%) or as a duration in years (e.g., 10 years resulting in 10% per year).
3. WHEN a duration in years is provided, THE AfA_System SHALL calculate the AfA_Satz as 1 divided by the number of years.
4. THE AfA_System SHALL validate that the Bemessungsgrundlage is greater than 0.
5. THE AfA_System SHALL validate that the AfA_Satz is between 0.0001 (0.01%) and 1.0 (100%).
6. THE AfA_System SHALL validate that the start date is a valid date in ISO 8601 format (YYYY-MM-DD).
7. WHEN a duration in years is provided for the linear method, THE AfA_System SHALL validate that the duration is between 1 and 100 years.
8. THE AfA_System SHALL store all monetary values (Bemessungsgrundlage, annual amounts, Restwert) as integers in Cents.

### Requirement 4: AfA-Plan-Generierung pro Position

**User Story:** Als Vermieter möchte ich für jede AfA-Position einen individuellen Abschreibungsplan sehen können, damit ich die jährlichen Beträge und Restwerte nachvollziehen kann.

#### Acceptance Criteria

1. WHEN an AfA plan is requested for an AfA_Position with the linear method, THE AfA_System SHALL generate a plan where each year's amount equals round(Bemessungsgrundlage × AfA_Satz) except for the first and last year.
2. WHEN an AfA plan is requested for an AfA_Position with the degressive method, THE AfA_System SHALL generate a plan where each year's amount equals round(current Restwert × AfA_Satz).
3. THE AfA_System SHALL include in each plan entry: year, annual amount, cumulative amount, and Restwert.
4. WHEN the start date is not January 1st, THE AfA_System SHALL calculate the first year's amount using Pro_Rata_Temporis (annual amount × remaining months / 12, where the start month counts as a full month).
5. FOR the linear method, THE AfA_System SHALL ensure that the sum of all annual amounts equals the Bemessungsgrundlage exactly.
6. FOR the linear method, THE AfA_System SHALL cap the final year's amount to not exceed the remaining Restwert.
7. FOR the degressive method, THE AfA_System SHALL ensure that cumulative amounts are strictly increasing and Restwert values are strictly decreasing.

### Requirement 5: Gesamt-AfA-Übersicht pro Objekt

**User Story:** Als Vermieter möchte ich eine Gesamtübersicht der AfA aller Positionen pro Jahr sehen, damit ich den steuerlich absetzbaren Gesamtbetrag kenne.

#### Acceptance Criteria

1. WHEN a combined AfA overview is requested for a property, THE AfA_System SHALL return the sum of all AfA_Position annual amounts per year.
2. THE AfA_System SHALL include each individual AfA_Position's contribution in the combined overview.
3. WHEN an AfA_Position has not yet started in a given year, THE AfA_System SHALL contribute 0 for that position in that year.
4. WHEN an AfA_Position's plan has ended (Restwert = 0), THE AfA_System SHALL contribute 0 for that position in subsequent years.

### Requirement 6: API-Endpunkte für Multi-Position AfA

**User Story:** Als Entwickler möchte ich RESTful API-Endpunkte für die CRUD-Operationen auf AfA-Positionen nutzen, damit das Frontend die neue Funktionalität anbinden kann.

#### Acceptance Criteria

1. THE AfA_System SHALL provide a GET endpoint to list all AfA_Position records for a property.
2. THE AfA_System SHALL provide a POST endpoint to create a new AfA_Position for a property.
3. THE AfA_System SHALL provide a PUT endpoint to update an existing AfA_Position.
4. THE AfA_System SHALL provide a DELETE endpoint to remove an AfA_Position.
5. THE AfA_System SHALL provide a GET endpoint to retrieve the AfA plan for a single AfA_Position.
6. THE AfA_System SHALL provide a GET endpoint to retrieve the combined AfA overview for a property.
7. WHEN a request targets a property that does not belong to the authenticated user, THE AfA_System SHALL return a 403 Forbidden response.
8. IF a referenced AfA_Position does not exist, THEN THE AfA_System SHALL return a 404 Not Found response.

### Requirement 7: Migration bestehender AfA-Daten

**User Story:** Als Vermieter mit bestehenden AfA-Einstellungen möchte ich, dass meine vorhandenen Daten automatisch in das neue Multi-Positions-Format überführt werden, damit ich keine Daten verliere.

#### Acceptance Criteria

1. WHEN the system is updated, THE AfA_System SHALL migrate existing AfA data from the acquisitions table into a new AfA_Position record with the name "Gebäude" and the method "linear".
2. THE AfA_System SHALL preserve the existing Bemessungsgrundlage (afa_basis), AfA_Satz (afa_rate), and start date (afa_start_date) during migration.
3. IF existing AfA data has no afa_rate or no afa_start_date set, THEN THE AfA_System SHALL create the AfA_Position with the available data and mark the missing fields as null.
4. WHEN migration is complete, THE AfA_System SHALL maintain backward compatibility by continuing to serve the existing depreciation API endpoints using the migrated "Gebäude" position.

### Requirement 8: Eingabevalidierung

**User Story:** Als Vermieter möchte ich klare Fehlermeldungen erhalten, wenn ich ungültige Daten eingebe, damit ich meine Eingaben korrigieren kann.

#### Acceptance Criteria

1. IF the position name is empty or exceeds 100 characters, THEN THE AfA_System SHALL return a validation error with a descriptive message.
2. IF the depreciation method is not "linear" or "degressiv", THEN THE AfA_System SHALL return a validation error.
3. IF the Bemessungsgrundlage is 0 or negative, THEN THE AfA_System SHALL return a validation error.
4. IF the AfA_Satz is outside the range 0.0001 to 1.0, THEN THE AfA_System SHALL return a validation error.
5. IF the start date format does not match YYYY-MM-DD, THEN THE AfA_System SHALL return a validation error.
6. IF a duplicate position name is provided within the same property, THEN THE AfA_System SHALL return a validation error indicating that the name is already in use.
7. IF the duration in years (for linear method) is less than 1 or greater than 100, THEN THE AfA_System SHALL return a validation error.

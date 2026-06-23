# Implementation Plan: AfA Multi-Position & Degressive Abschreibung

## Overview

Extends the existing single-position linear depreciation module into a multi-position system with degressive method support. Implementation follows the architecture: Database Migration → Calculator → Repository → Service → API Routes → Frontend → Property Tests.

## Tasks

- [x] 1. Database migration and data migration
  - [x] 1.1 Create migration file `002_afa_positions.sql`
    - Create `afa_positions` table with columns: id, property_id, name, method, basis, rate, duration_years, start_date, created_at, updated_at
    - Add UNIQUE constraint on (property_id, name)
    - Add CHECK constraints for method, basis, rate, duration_years, name length
    - Add index on property_id
    - Migrate existing data from `acquisitions` table into `afa_positions` as "Gebäude" positions with method "linear"
    - Handle cases where afa_rate or afa_start_date is NULL using COALESCE
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Calculator extension (degressive method + unified entry point)
  - [x] 2.1 Implement `durationToRate` function in `afa.calculator.ts`
    - Add function that converts duration in years to rate: `1 / durationYears`
    - _Requirements: 3.2, 3.3_

  - [x] 2.2 Implement `generateDegressiveAfaPlan` function in `afa.calculator.ts`
    - Each year: amount = round(currentResidual × rate)
    - First year: apply pro rata temporis based on start month
    - Terminate when residual rounds to 0
    - If annual amount < 1 cent, set amount to remaining residual and terminate
    - Export the `DepreciationMethod` type
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 4.7_

  - [x] 2.3 Implement `generateAfaPlanByMethod` unified entry point in `afa.calculator.ts`
    - Dispatch to `generateAfaPlan` for linear or `generateDegressiveAfaPlan` for degressiv
    - _Requirements: 2.1_

  - [ ]* 2.4 Write unit tests for degressive calculator functions
    - Test `durationToRate` with known values (10 years → 0.1, 50 years → 0.02)
    - Test `generateDegressiveAfaPlan` with known inputs and verify plan entries
    - Test pro rata temporis for degressive method (start month not January)
    - Test termination when amount < 1 cent
    - Test `generateAfaPlanByMethod` dispatches correctly
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.3_

- [x] 3. Checkpoint - Ensure calculator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Repository (CRUD for afa_positions)
  - [x] 4.1 Create `position.repository.ts` with `PositionRepository` class
    - Implement `findAllByPropertyId` (sorted by created_at)
    - Implement `findById`
    - Implement `countByPropertyId`
    - Implement `nameExistsForProperty` (with optional excludeId for updates)
    - Implement `create` (generate UUID, set timestamps)
    - Implement `update` (set updated_at)
    - Implement `delete`
    - Define and export `AfaPositionRecord`, `CreatePositionInput`, `UpdatePositionInput` interfaces
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ]* 4.2 Write unit tests for `PositionRepository`
    - Test CRUD operations with in-memory SQLite database
    - Test unique name constraint
    - Test count returns correct numbers
    - Test sorting by creation date
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

- [x] 5. Service extension (multi-position methods + combined overview)
  - [x] 5.1 Create `depreciation.validators.ts` with Zod schemas
    - Implement `createPositionSchema` with all field validations
    - Implement `updatePositionSchema` as partial of create schema
    - Add refinement: either rate or duration_years (for linear) must be provided
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.2 Extend `depreciation.service.ts` with multi-position methods
    - Add `listPositions(propertyId, userId)` — verify property ownership, return all positions
    - Add `createPosition(propertyId, userId, input)` — validate max 20 positions, validate unique name, convert duration_years to rate if provided, create position
    - Add `updatePosition(positionId, userId, input)` — verify ownership via property, validate unique name (excluding self), update
    - Add `deletePosition(positionId, userId)` — verify ownership, delete position
    - Add `getPositionPlan(positionId, userId)` — get position, generate plan via `generateAfaPlanByMethod`
    - Add `getCombinedOverview(propertyId, userId)` — get all positions, generate plans, aggregate by year
    - Keep legacy methods working by proxying to "Gebäude" position
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 6.7, 6.8, 7.4_

  - [ ]* 5.3 Write unit tests for multi-position service methods
    - Test listPositions returns all positions for a property
    - Test createPosition with valid input
    - Test createPosition rejects when 20 positions exist
    - Test createPosition rejects duplicate name
    - Test updatePosition with valid input
    - Test deletePosition removes position
    - Test getPositionPlan generates correct plan for both methods
    - Test getCombinedOverview aggregates correctly
    - Test legacy methods still work via "Gebäude" position
    - Test 403 for unauthorized property access
    - Test 404 for non-existent position
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 5.2, 6.7, 6.8, 7.4_

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. API routes (new endpoints + backward compatibility)
  - [x] 7.1 Extend `depreciation.routes.ts` with new position endpoints
    - GET `/:propertyId/positions` — list all positions
    - POST `/:propertyId/positions` — create position (validate body with Zod schema)
    - PUT `/:propertyId/positions/:positionId` — update position
    - DELETE `/:propertyId/positions/:positionId` — delete position
    - GET `/:propertyId/positions/:positionId/plan` — get plan for single position
    - GET `/:propertyId/combined` — get combined overview
    - Keep existing GET/PUT `/:propertyId` and GET `/:propertyId/plan` endpoints for backward compat
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.4_

  - [ ]* 7.2 Write integration tests for new API endpoints
    - Test full CRUD flow: create, list, update, delete positions
    - Test plan generation endpoint for linear and degressive
    - Test combined overview endpoint
    - Test 403 for unauthorized access
    - Test 404 for non-existent position
    - Test validation error responses (400) for invalid inputs
    - Test backward compatibility of legacy endpoints
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Frontend — Position list and form
  - [x] 8.1 Create AfA position TypeScript types and API client functions
    - Define `AfaPosition`, `AfaPlanEntry`, `CombinedAfaOverview` types
    - Implement API functions: `listPositions`, `createPosition`, `updatePosition`, `deletePosition`, `getPositionPlan`, `getCombinedOverview`
    - _Requirements: 1.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.2 Create `PositionForm` component
    - Form fields: name (text), method (select: linear/degressiv), basis (number in EUR, convert to cents), rate (percentage) or duration_years (for linear), start_date (date picker)
    - Client-side validation matching backend Zod schema
    - Support both create and edit modes
    - Display validation errors with German messages
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

  - [x] 8.3 Create `PositionList` component
    - Display all AfA positions for a property in a table/card list
    - Show name, method, basis (formatted as EUR), rate, start date
    - Add button to create new position
    - Edit and delete actions per position
    - Confirm dialog before deletion
    - _Requirements: 1.1, 1.4, 1.6_

  - [x] 8.4 Create `PositionPlanView` component
    - Display AfA plan as a table: year, annual amount, cumulative amount, residual value
    - Format all monetary values as EUR
    - Indicate depreciation method in header
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 8.5 Create `CombinedOverview` component
    - Display combined yearly overview as a table
    - Show total per year and breakdown by position
    - Show years from earliest start to latest end across all positions
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.6 Integrate AfA components into the property detail page
    - Add navigation/tab for AfA multi-position view
    - Wire `PositionList`, `PositionForm`, `PositionPlanView`, `CombinedOverview` together
    - Handle loading, error, and empty states
    - _Requirements: 1.1, 5.1_

- [x] 9. Checkpoint - Verify full feature works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Property-based tests
  - [ ]* 10.1 Write property test: Duration to rate conversion (Property 3)
    - **Property 3: Duration to rate conversion**
    - For any duration in [1, 100], `durationToRate(n)` produces `1/n`
    - Use `fc.integer({min: 1, max: 100})` generator
    - **Validates: Requirements 3.3**

  - [ ]* 10.2 Write property test: Linear plan middle years consistency (Property 4)
    - **Property 4: Linear plan — middle years amount consistency**
    - For any valid basis/rate/startDate, all middle-year entries have annualAmount = round(basis × rate)
    - Use `arbBasis`, `arbRate`, `arbStartDate` generators
    - **Validates: Requirements 4.1**

  - [ ]* 10.3 Write property test: Linear plan total equals basis (Property 5)
    - **Property 5: Linear plan — total sum equals basis**
    - For any valid basis/rate/startDate, sum of all annualAmounts = basis
    - **Validates: Requirements 4.5**

  - [ ]* 10.4 Write property test: Pro-rata temporis first year (Property 6)
    - **Property 6: Pro-rata temporis first year (both methods)**
    - For any valid inputs with startMonth ≠ 1, first year amount = round(fullYearAmount × remainingMonths / 12)
    - **Validates: Requirements 2.3, 4.4**

  - [ ]* 10.5 Write property test: Degressive annual amount formula (Property 7)
    - **Property 7: Degressive plan — annual amount formula**
    - For any valid basis/rate/startDate, each entry after year 1 has annualAmount = round(prevResidual × rate)
    - **Validates: Requirements 2.2, 4.2**

  - [ ]* 10.6 Write property test: Degressive plan terminates at zero (Property 8)
    - **Property 8: Degressive plan — terminates at zero**
    - For any valid basis/rate/startDate, the last entry has residualValue = 0
    - **Validates: Requirements 2.4**

  - [ ]* 10.7 Write property test: Degressive strict monotonicity (Property 9)
    - **Property 9: Degressive plan — strict monotonicity**
    - For any valid inputs, cumulativeAmount is strictly increasing and residualValue strictly decreasing
    - **Validates: Requirements 4.7**

  - [ ]* 10.8 Write property test: Combined overview total equals sum (Property 10)
    - **Property 10: Combined overview — total equals sum of positions**
    - For any set of positions, each year's totalAmount = sum of individual position amounts
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 10.9 Write property test: Zero contribution outside active range (Property 11)
    - **Property 11: Combined overview — zero contribution outside active range**
    - Position contributes 0 before start year and after plan ends
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 10.10 Write property test: Name length validation (Property 12)
    - **Property 12: Name length validation**
    - Empty names and names > 100 chars are rejected with validation error
    - Use `fc.string({minLength: 101})` and `fc.constant('')` generators
    - **Validates: Requirements 8.1**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All monetary values stored as integer cents; frontend converts to/from EUR for display
- Existing legacy endpoints remain functional throughout — backward compatibility via "Gebäude" position proxy
- Test file for property tests: `backend/src/modules/depreciation/afa.calculator.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "4.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.2"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 8, "tasks": ["8.6"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10"] }
  ]
}
```

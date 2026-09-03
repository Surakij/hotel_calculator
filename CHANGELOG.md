# Changelog

## 1.4.1

- Removed the duplicate hotel "H" marker from the stay details card.

## 1.4.0

- Added Appearance settings with light/dark theme selection and local color customization.

## 1.3.4

- Made the hotel picker alphabet fit in one compact vertical column.

## 1.3.3

- Removed the "with Club Benefits" suffix from InterContinental room categories.

## 1.3.2

- Kept full-stay meals after split room date blocks in Short Share output.

## 1.3.1

- Fixed Short Share ordering so gala dinners and transfers stay after dated room, extra, and meal rows.

## 1.3.0

- Added local-only rate memory for saved base rates without SPO or discounts.
- Added an Auto-fill rates toggle so saved rates are only applied when explicitly enabled.

## 1.2.3

- Added Jawakara Islands Maldives as a separate resort entry with room categories and meal plans.

## 1.2.2

- Reserved initial table and summary layout space before app startup to reduce CLS.

## 1.2.1

- Removed repository screenshots with real quotation data and anonymized the social preview.

## 1.2.0

- Added a Maldives-inspired animated brand mark and matching favicon.

## 1.1.12

- Kept the calculation table full-width while assigning extra space to the item column instead of discounts.

## 1.1.11

- Filled the empty delete-column header so the calculation table bar ends evenly on both sides.

## 1.1.10

- Set calculation table headers to an exact pixel height to avoid subpixel header edges.

## 1.1.9

- Matched the calculation table width to the exact sum of visible columns.

## 1.1.8

- Matched the discount column width exactly to the active discount controls.

## 1.1.7

- Smoothed the calculation table header so column edges render as one continuous bar.

## 1.1.6

- Removed the small discount column overflow at the edge of the table header.

## 1.1.5

- Restored discount controls to grow from a stable left-aligned starting position.

## 1.1.4

- Polished table spacing for discount controls, quantity steppers, and row delete actions.

## 1.1.3

- Fixed discount controls so multiple discounts stay inside the Discounts column.
- Updated hotel-specific meal-plan references to cover all 177 Maldives resorts in the app dataset.
- Added LinkedIn/social preview metadata and image.
- Added portfolio screenshots and refreshed README dataset wording.
- Reserved footer height to reduce layout shift during page load.

## 1.1.0

- Added EBO date checker for SPO deadline checks.
- Added undo and redo for calculation edits.
- Improved saved history grouping and restored saved discounts correctly.
- Refined number stepper controls and reservation workflow UI polish.

## 1.0.0

- Added saved calculation history with search, open, copy, delete, export, and import.
- Added optional Google Drive sync plumbing for saved calculation history.
- Added draft autosave so the current calculation survives accidental refreshes.
- Added validation hints for incomplete dates, empty rates, zero quantities, and dinner dates outside the stay.
- Added app version display in the footer.
- Added branded SVG logo and favicon.

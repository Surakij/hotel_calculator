# Hotel Calculation

A lightweight browser-based hotel quotation and calculation tool for travel and hospitality workflows.

**Live app:** https://surakij.github.io/hotel_calculator/

## Development

The app is static and can be opened directly from `index.html`. Runtime code is split into:

- `assets/core.js` - pure date, pricing, discount, and share-text logic.
- `assets/storage.js` - saved calculations, draft autosave, and JSON backup storage.
- `assets/app.js` - DOM, table rows, calendar, clipboard, and download behavior.
- `assets/hotelReselect.js` - hotel picker with search and alphabet navigation.
- `assets/styles.css` - layout and visual styling.

Key workflows:

- Save completed calculations into browser history.
- Search saved calculations by hotel, dates, SPO, or total.
- Export/import history as a JSON backup file.
- Restore an autosaved draft after accidental refreshes.

Run local checks with:

```powershell
npm run lint
npm test
```

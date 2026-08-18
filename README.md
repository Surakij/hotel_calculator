# Hotel Calculation

A lightweight browser-based hotel quotation and calculation tool for travel and hospitality workflows.

**Live app:** https://surakij.github.io/hotel_calculator/

## Development

The app is static and can be opened directly from `index.html`. Runtime code is split into:

- `assets/core.js` - pure date, pricing, discount, and share-text logic.
- `assets/app.js` - DOM, table rows, calendar, clipboard, and download behavior.
- `assets/styles.css` - layout and visual styling.

Run local checks with:

```powershell
npm run lint
npm test
```

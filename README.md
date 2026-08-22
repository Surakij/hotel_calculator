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
- Optionally sync saved history to each user's private Google Drive app data.
- Restore an autosaved draft after accidental refreshes.

## Optional Google Drive sync

Google Drive sync is disabled until a browser OAuth client ID is added in `assets/googleConfig.js`.

To enable it:

1. Create a Google Cloud project.
2. Configure the OAuth consent screen.
3. Enable the Google Drive API.
4. Create an OAuth client ID for a web application.
5. Add `https://surakij.github.io` to authorized JavaScript origins.
6. Put the client ID into `assets/googleConfig.js`.

The app requests only the `https://www.googleapis.com/auth/drive.appdata` scope and stores a hidden `hotel_calculator_history.json` file in each user's private Drive application data folder.

Run local checks with:

```powershell
npm run lint
npm test
```

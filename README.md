# Maldives Hotel Quotation & Reservation Calculator

A browser-based workflow automation tool designed for Maldives resort quotation and reservation pricing.

**Live app:** https://surakij.github.io/hotel_calculator/

## Overview

The Maldives Hotel Quotation & Reservation Calculator is a browser-based workflow automation tool created specifically for Maldives resort reservations.

Maldives quotations can involve multiple room categories and stay periods, adult and child meal supplements, seaplane/domestic/speedboat transfers, Green Tax, special offers and several sequential discounts.

The calculator brings these components into one structured calculation and produces a compact share-ready quotation for reservation workflows.

## Why Maldives?

Maldives resort reservations have a particularly complex pricing structure. A single booking may include multiple accommodation periods, different meal supplements, age-based charges, transfer types, taxes, gala dinners, extras and several promotional discounts.

The project was created to make this workflow faster, more consistent and easier to verify.

## Workflow Coverage

The calculator is based on real Maldives reservation workflow patterns, including:

- Maldives resorts and room categories.
- Split stays between room categories or rate periods.
- Different rates across stay periods.
- Resort meal plans.
- Adult and child supplements.
- Seaplane, domestic flight and speedboat transfers.
- One-way transfer pricing.
- Green Tax.
- Gala dinners and extras.
- Sequential SPO / discount calculations.
- Share-ready quotation output for reservation workflows.

## Maldives Reference Dataset

The hotel selector includes a Maldives resort, room-category and meal-plan reference dataset to speed up manual quotation work.

Current project data includes room categories and hotel-specific meal-plan references for 177 Maldives resorts.

The dataset is intended as an operational reference for selecting resort and room-category names. It is not described as an official Maldives government database, and the public repository does not include hotel rates or commercial contract data.

## Privacy & Analytics

The public app uses Cloudflare Web Analytics to understand aggregate website traffic.

Analytics are used only for privacy-friendly traffic measurement. Reservation details, quotation contents, prices, hotel selections, saved calculations and other data entered into the calculator are not sent to the analytics service.

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

## Copyright

© 2026 Sergei Kazhaev. All rights reserved.

The Maldives Hotel Quotation Calculator is publicly available for use. The source code is not released under an open-source license and may not be redistributed, republished, or used to create derivative commercial products without permission.

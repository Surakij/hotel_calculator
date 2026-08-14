# Hotel Calculation

A lightweight browser-based hotel quotation and calculation tool for travel and hospitality workflows.

**Live app:** https://surakij.github.io/hotel_calculator/

## Overview

Hotel Calculation is a single-page calculator for building hotel and travel cost breakdowns. It is designed around a simple rule: **one row = one charge / rate period**.

The current version supports hotel stays, meals, transfers, gala dinners and extra charges, with multiple discount stages and automatic net calculation.

## Features

- Hotel, check-in and check-out details
- Automatic night calculation
- Guest counts for adults, children and infants
- Child age field
- SPO code field
- Rate periods split across multiple rows
- Room, meal, transfer, dinner and extra charge types
- Automatic quantity for adult/child/infant items where applicable
- Up to four sequential discount fields per charge
- Automatic net calculation
- Grand total and total net display
- Short shareable calculation text
- Copy-to-clipboard sharing
- Downloadable `.txt` calculation
- Responsive layout
- No external JavaScript framework or backend required

## Calculation logic

For a charge with a stay period:

`Base = Nights × Quantity × Rate`

Discounts are applied sequentially. For example, with a base of 1,000 and discounts of 10% and 5%:

`1,000 × 90% × 95% = 855`

For same-day charges, the calculator treats the charge as one unit rather than multiplying it by zero nights.

## Typical workflow

1. Enter the hotel and booking dates.
2. Enter adults, children, infants and child ages.
3. Add one row for each room/rate period or other charge.
4. Select the charge type and enter the item, dates, quantity and rate.
5. Enter discounts from left to right in the order they should be applied.
6. Review the calculated net amount and grand total.
7. Use **COPY SHARE** or **DOWNLOAD SHARE** to send the calculation to a colleague or client.

## Technology

This is a static web application built with:

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub Pages for hosting
- GitHub Actions for repository automation

There are currently no runtime dependencies or package manager requirements.

## Project structure

```text
hotel_calculator/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
├── index.html
├── .gitignore
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── README.md
└── SECURITY.md
```

## Local development

No build step is required.

Clone the repository and open `index.html` in a browser, or serve the directory with any static HTTP server.

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

The production site is published through GitHub Pages from the `main` branch.

Changes pushed to `main` can trigger the repository's GitHub Actions workflows and the Pages deployment.

## Contributing

Bug reports, improvements and feature suggestions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the project workflow.

## Security

This application is a client-side calculator and does not require a server-side database. Please see [SECURITY.md](SECURITY.md) for reporting security issues.

## License

No open-source license has been declared for this repository yet. Until a license is added, the default copyright rules apply.

<!-- workflow trigger -->

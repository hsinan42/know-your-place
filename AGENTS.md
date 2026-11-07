# Know Your Place development rules

- Backend: .NET 10, PostgreSQL persistence, read-only SQLite import; frontend: React, TypeScript, Tailwind v4, shadcn/ui.
- This is a manual-entry personal finance app. No bank, SMS, mailbox or live Sheets integrations.
- Read docs/architecture.md before changing financial calculations. Use decimal money and date-only dates.
- Never count statement payments as a second expense. Borrowing is not earned income.
- Actual assets start at zero. Carry every recorded cash movement across months/years; salary plans never create actual cash. Keep cash, debt and purchase-based projections separate.
- New payments capture amount/date; retain compatibility with legacy estimates and surface missing information. Preserve live records during deployment.
- Identify cards, plans and payments by stable IDs; changing the report period must never mutate payments.
- Keep personal spreadsheet snapshots in ignored private/; never embed them in frontend bundles or container images.
- Run dotnet run --project tests/Finance.Tests and frontend typecheck/build before delivery.
- Authenticated access is mandatory. Use HTTPS in production. PWA installation needs HTTPS.

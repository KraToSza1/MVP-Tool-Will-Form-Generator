# Staff Calendar, Availability, and Reports Setup

## Database

Run this migration in Supabase SQL Editor:

`supabase/migrations/20260424000000_staff_calendar_and_availability.sql`

It creates:

- `staff_calendar_connections` — metadata only, no Microsoft tokens.
- `staff_availability_rules` — each staff member's working hours and booking rules.

## Microsoft Entra

In the same Azure app registration used for Supabase sign-in, add delegated Microsoft Graph permissions:

- `User.Read`
- `Calendars.ReadBasic`
- `offline_access`

Grant admin consent for the tenant if user consent is disabled.

The Will Tool still uses Supabase Azure OAuth. The normal staff sign-in stays lightweight; the Calendar and Availability screens have their own **Connect Microsoft calendar** action that requests calendar consent.

## Token Handling

The frontend uses the current Supabase OAuth provider token to call Microsoft Graph. It stores only calendar connection metadata in Supabase:

- staff profile ID
- Microsoft provider user ID where available
- calendar email
- display name
- connected/check timestamps

It does not store Microsoft access or refresh tokens in Supabase tables.

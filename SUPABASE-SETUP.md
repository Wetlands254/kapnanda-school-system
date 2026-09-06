# Kapnanda V2 — Supabase Connection Setup

This build adds a real Supabase connection to the existing GitHub Pages application.

## 1. Create/open your Supabase project
In Supabase, open your project and copy:
- Project URL
- Publishable key (or legacy `anon` key)

Do **not** use the `service_role` key in `index.html`.

## 2. Run the database SQL
Open **SQL Editor** in Supabase and run the complete `supabase-schema.sql` included in this folder.

The script creates the relational school tables plus `public.school_state`, which is the cloud record used by this V2 frontend.

## 3. Create the administrator account
In **Authentication → Users**, create an email/password user for the school administrator.

The email/password is now the production login when Supabase is configured.

## 4. Configure the website
Open the Tinet website. On the login page choose **Configure Supabase** and paste:
- Project URL
- Publishable/anon key

The values are stored in the browser's local storage. The key must be a publishable/anon key, never a service-role secret.

## 5. First cloud login
Sign in with the Supabase Auth email/password.

- If the cloud school record does not exist, the current browser V2 data is uploaded to Supabase.
- If the cloud record already exists, it is downloaded into the browser.
- Changes made while signed in are synchronized to Supabase.
- Backup also requests a cloud sync before downloading the JSON backup.

## Important
This build deliberately keeps the existing V2 UI and local data model intact while adding authenticated cloud persistence. The relational schema is also included so the application can be migrated feature-by-feature to fully relational reads/writes later.

For production, keep RLS enabled and review Auth settings, backups, and staff roles before storing sensitive school data.

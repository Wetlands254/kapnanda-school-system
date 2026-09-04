# Production hardening notes

This release is deployment-ready in structure, but a real school rollout should complete these controls before collecting sensitive learner data:

1. Move SQLite to PostgreSQL when concurrent usage grows.
2. Add password-change/reset screens and disable the default password.
3. Add per-teacher class/subject permissions.
4. Add CSRF protection and rate limiting.
5. Store uploaded logos/files outside the application filesystem.
6. Encrypt/secure backups.
7. Add automated database backups.
8. Add audit review tools for administrators.
9. Configure secure cookies behind HTTPS.
10. Test restore procedures.
11. Confirm the school's final CBC/KJSEA grading and report requirements.
12. Verify all fee categories, payment methods and receipt numbering with the school office.

## Current grading
41–50 EE1
36–40 EE2
31–35 ME1
25–30 ME2
21–24.9 AE1
15–20 AE2
6–14 BE1
0–5 BE2

# GridGuardian Pro — Power Station Maintenance System (PSMS)

A locally runnable starter project inspired by the supplied GridGuardian Pro page and the PSMS use-case diagram. It is a **re-created implementation**, not the original Lovable source code.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: PHP (REST-style JSON API)
- Database: MySQL / MariaDB through XAMPP

## Features
- Dashboard summary cards
- Equipment list and add-equipment form
- Alarm monitoring and acknowledge/resolve action
- Maintenance scheduling
- Repair/work-order assignment and status updates
- Spare-parts inventory
- Maintenance history
- Reports summary
- User management (starter/demo screen)

## Run locally
1. Install and open XAMPP.
2. Start **Apache** and **MySQL**.
3. Copy the `PSMS_GridGuardian_Project` folder into `C:\\xampp\\htdocs\\`.
4. Open phpMyAdmin at `http://localhost/phpmyadmin`.
5. Import `database/psms.sql`.
6. If needed, edit database credentials in `api/config.php` (default XAMPP is user `root`, blank password).
7. Open `http://localhost/PSMS_GridGuardian_Project/public/`.

## Important
- This is a student-project starter, not a production safety-control system.
- Demo login is client-side only. Do not use it for real authentication or operational power-plant control.
- Before deployment, add secure password hashing, server-side authentication/authorization, validation, CSRF protection, audit logging, backups, and HTTPS.
- API is designed for local XAMPP use. Keep `public/` and `api/` within the project folder as provided.

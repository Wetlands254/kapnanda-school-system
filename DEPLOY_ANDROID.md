# Deploy Kapnanda from an Android phone

The easiest reliable route is to use GitHub + a Node-compatible cloud server. A computer is not required if you use GitHub's mobile website and your host's dashboard.

## 1. Create a GitHub repository
Create a private repository named `kapnanda-school-system`.

Upload ALL files and folders from this project, including:
- server.js
- package.json
- public/
- Dockerfile
- docker-compose.yml
- .env.example

Do not upload a real `.env` file or database containing real learner information.

## 2. Deploy
Use a Node/Docker-compatible host. Create a new service from the GitHub repository.

If the host supports Docker, use the included Dockerfile.

If it uses a Node build:
Build command: `npm install`
Start command: `npm start`

Set:
PORT=3000
SESSION_SECRET=<a long random secret>

## 3. Persistent storage
This application uses SQLite. The database MUST be on persistent storage/volume. Do not deploy it on an ephemeral filesystem.

For Docker, the included compose file mounts `/app/data`, but server.js should be configured to place `kapnanda.db` inside that directory for a production deployment.

For a larger school, migrate the database to PostgreSQL before scaling to many simultaneous users.

## 4. HTTPS
Turn on the host's HTTPS/TLS certificate. Do not expose the system over plain HTTP for real learner or fee data.

## 5. First login
Username: `admin`
Password: `Admin@123`

Immediately change the default administrator password before entering real data.

## 6. Backups
Use the in-app Backup button regularly and also configure server/database backups. Keep encrypted copies in a secure location.

## 7. Custom domain
After deployment, you can connect a domain such as:
`school.yourdomain.co.ke`

## Production checklist
- Change admin password
- Change SESSION_SECRET
- HTTPS enabled
- Persistent database storage
- Automated backups
- Restricted admin accounts
- Test learner/marks/fees/report workflows
- Do not put real learner data into a public GitHub repository

# CodeCraft Academy — Full Stack Java Learning Website

A responsive learning portal with a login/register flow, a Node.js + Express backend, SQLite persistence, and the existing curriculum dashboard.

## Requirements
- Node.js 18 or newer
- npm
- Internet connection for the first dependency installation

## Run locally
1. Extract the ZIP.
2. Open a terminal in the extracted `CodeCraft_Full_Stack_Java_Learning_Website` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set a long, random `JWT_SECRET` (recommended even for local work).
5. Run `npm start`.
6. Open `http://localhost:3000/login`.
7. Create an account and log in. The dashboard and course pages require authentication.

## Pages
- `/login` — login
- `/register` — account creation
- `/` — overview and searchable curriculum
- `/courses` — course tracks and recommended learning order
- `/notes` — searchable revision-note links
- `/projects` — project plans and practice checklists
- `/profile` — account details and saved progress

## API
- `GET /api/health` — service health
- `POST /api/auth/register` — create an account
- `POST /api/auth/login` — authenticate
- `POST /api/auth/logout` — clear the login cookie
- `GET /api/auth/me` — current account (protected)
- `GET /api/progress` — current user's saved module progress (protected)
- `PUT /api/progress/:moduleId` — update a module's completion (protected)

## Data and security notes
- SQLite database is created automatically at `backend/data/codecraft.sqlite`.
- Passwords are hashed with bcrypt; passwords are never stored in plaintext.
- Login uses a signed JWT in an HttpOnly cookie; the cookie is Secure in production.
- Each user's progress is stored against their own user ID.
- Before deployment, set `NODE_ENV=production`, use HTTPS, configure a strong `JWT_SECRET`, and add rate limiting, backups, and a proper deployment process. This starter is not a substitute for a production security review.

## Content note
The notes page links to searches for third-party revision PDFs; this package does not claim ownership of third-party PDFs or include actual PDFs. The projects page contains project blueprints rather than prebuilt project source ZIPs.

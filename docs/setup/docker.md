# Docker Setup

This baseline runs the Veyra frontend and backend in containers while keeping PostgreSQL hosted in Supabase.

## Required Environment

Create `apps/server/.env` from `apps/server/.env.example` and fill in the real values:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
JWT_EXPIRES_IN=1d
AUTH_COOKIE_NAME=veyra_access_token
```

Do not add real secrets to Git.

## Run With Docker

From the repository root:

```sh
docker compose up --build
```

The app will be available at:

- Frontend: http://localhost:5173
- Backend health: http://localhost:5000/api/health
- Backend database health: http://localhost:5000/api/health/db

## Notes

- No local PostgreSQL container is included. The backend connects to hosted Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The frontend image builds with `VITE_API_BASE_URL=http://localhost:5000/api`, so browser requests still go to the backend through localhost.
- HTTP-only auth cookies continue to work locally because the browser talks to `localhost:5173` and `localhost:5000`, with credentialed CORS allowed by `CLIENT_URL`.
- The frontend is served by Nginx only as static file hosting with SPA fallback. It is not acting as a backend reverse proxy.

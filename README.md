# Make My Marriage

Make My Marriage is a wedding planning and guest experience application. The repository is an npm-workspaces monorepo with an Angular frontend and an Express API.

## Applications

- `apps/web` — Angular application. Public guest routes and management routes are separate route groups.
- `apps/api` — TypeScript and Express modular monolith with a basic health endpoint at `/api/health`.
- `docs` — Product and architecture source documents. These documents remain at their existing paths.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Setup

From the repository root, install workspace dependencies:

```sh
npm install
```

Copy `apps/api/.env.example` to `apps/api/.env` for local API settings. The scaffold does not connect to MongoDB or external providers yet.

## Development

```sh
npm run dev:api
npm run dev:web
```

The API listens on port 3000 by default. Angular runs through its development server, normally on port 4200.

## Build and type check

```sh
npm run build
npm run typecheck
```

## Scaffold scope

This repository currently contains application shells, route group structure, and a health endpoint. Product workflows, authentication, persistence models, authorization, and external-provider integrations are intentionally not implemented yet.

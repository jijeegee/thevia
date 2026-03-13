# TheVIA - Community-Enhanced VIA Keyboard Configurator

A fork of [VIA](https://usevia.app) that adds community-driven keyboard definition sharing, so unrecognized keyboards can be configured without manual JSON hunting.

## Key Features

- **Community JSON Matching** - Automatically finds and applies keyboard definitions uploaded by the community when VIA doesn't recognize a device
- **Trust & Voting System** - Community definitions are ranked by trust scores and user votes to surface reliable configs
- **Definition Upload** - Users can contribute their working keyboard definitions back to the community
- **Full VIA Compatibility** - All original VIA features (keymap, macros, lighting, RGB) work unchanged

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Redux Toolkit, styled-components, Vite, TypeScript |
| Backend | Fastify, Drizzle ORM, PostgreSQL, Zod |
| Infra | Cloudflare Pages (frontend), Fly.io / Docker (backend) |

## Quick Start

### Frontend

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

### Backend

```bash
cd server
npm install
cp .env.example .env   # Edit with your database URL
npm run db:migrate
npm run dev
# API at http://localhost:3001
```

### Environment Variables

Copy `.env.example` to `.env` in the project root for frontend config. See `server/.env.example` for backend config.

## Documentation

See [docs/](docs/) for detailed plans:
- [Product Plan](docs/PRODUCT_PLAN.md)
- [Development Plan](docs/DEV_PLAN.md)

## License

GPL-3.0

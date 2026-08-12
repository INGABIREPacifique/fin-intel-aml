# FIN-INTEL AML — Institutional Intelligence System

AI-driven AML / financial-crimes intelligence platform bridging traditional banking and capital markets.

## Stack
- **Frontend:** React + Vite + Tailwind CSS (design tokens cloned exactly from `docs/DESIGN.md`)
- **Backend:** Supabase (Postgres + Auth) — to be added
- **Routing:** react-router-dom

## Structure
- `src/pages/` — one file per screen (Login, Onboarding, Dashboard, Risk Engine, etc.)
- `src/components/` — shared UI pieces (nav bars, badges, cards)
- `src/lib/` — Supabase client, helpers
- `docs/DESIGN.md` — design system reference (colors, type, spacing)

## Build order
1. Project scaffold + design tokens (this commit)
2. Data model + Supabase auth
3. First vertical slice: Login -> Dashboard (real, working)
4. Remaining screens, one phase at a time (Onboarding -> Detection -> Forensics -> Collaboration -> SAR Filing)

## Status
See project tracker for current phase and next step.

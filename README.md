
# Audit King — Full App

This is the complete React + TypeScript app with Tailwind, ready to deploy on Vercel.

## Run locally

```bash
npm install
npm run dev -- --host
```

## Deploy on Vercel

- Build command: `npm run build`
- Output directory: `dist`

(Optional) Add environment variables for Supabase auth:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then add your deployed URL in Supabase → Authentication → URL Configuration.

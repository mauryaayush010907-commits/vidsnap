# Video Downloader — Production notes

Deployment target: Vercel

Required environment variables (set in Vercel Dashboard):

- `DATABASE_URL` or `MONGODB_URI`: MongoDB connection string
- `MONGODB_DB` (optional): database name (defaults to `videosnap`)
- `YTDLP_BINARY` (optional): path to a yt-dlp binary if running on a host that supports spawning binaries
- `INSTAGRAM_COOKIES_PATH` (optional): path to cookies file for Instagram downloads
- Any API keys or secrets used by other services

Important production considerations:

- Vercel serverless functions have limitations when spawning native binaries (yt-dlp). For reliable downloads, run the downloader on a separate worker or server (e.g., a small VPS or Lambda with layers) and call it from this app.
- Keep secrets only in Vercel Environment Variables — do NOT commit `.env` files.
- Configure monitoring (Sentry, Logflare) for error tracking and observability.
- Add CI to run `npm run build`, `npm run lint`, and `npm run typecheck` on PRs.

Quick deploy steps:

1. Push to GitHub.
2. Import the repo into Vercel and set the environment variables above.
3. Ensure the project uses Node 18+ on Vercel if relying on modern APIs.

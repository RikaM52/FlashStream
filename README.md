\# ◈ FlashStream — Global Streaming Discovery Platform



> Find what to watch tonight. Filter by mood, platform, language, and more — across 50+ streaming services worldwide.



\---



\## What Is FlashStream?



FlashStream is a \*\*free, privacy-first streaming discovery platform\*\* built with:



\- \*\*No account required\*\* — everything works instantly

\- \*\*Local-first data\*\* — your watchlist lives on your device, never uploaded

\- \*\*60+ filter dimensions\*\* — mood, genre, language, platform, runtime, certification, keywords, and more

\- \*\*Global content\*\* — Korean drama, Japanese anime, Indian Bollywood, French cinema, and more

\- \*\*Wellbeing tools\*\* — session timer, break reminders, content trigger warnings

\- \*\*PWA\*\* — installable on any device, works offline



\---



\## Tech Stack



| Layer | Technology |

|-------|------------|

| Frontend | HTML5 + Tailwind CSS + Vanilla JS |

| Hosting | Cloudflare Pages |

| Backend API | Cloudflare Workers |

| Database | Cloudflare D1 (SQLite) |

| Movie Data | TMDB API |

| Bot Protection | Cloudflare Turnstile |



\---



\## Project Structure

flashstream/

├── worker/

│ └── worker.js ← Cloudflare Worker – all API routes

├── public/ ← Cloudflare Pages build output

│ ├── index.html ← Homepage

│ ├── discover.html ← Browse + filter (60+ dimensions)

│ ├── movie-detail.html ← Movie / TV / Person detail (5 tabs)

│ ├── watchlist.html ← Watchlist manager

│ ├── community.html ← Rate, tips, wellbeing

│ ├── settings.html ← All preferences

│ ├── about.html ← About page

│ ├── privacy.html ← Privacy policy

│ ├── terms.html ← Terms of service

│ ├── leaving-soon.html ← Expiring content tracker

│ ├── coming-soon.html ← Upcoming releases

│ ├── collection.html ← Franchise / collection page

│ ├── offline.html ← PWA offline fallback

│ ├── manifest.json ← PWA manifest

│ ├── sw.js ← Service worker

│ ├── sitemap.xml ← Static sitemap

│ ├── robots.txt ← Crawler rules

│ ├── \_headers ← Security headers

│ ├── \_redirects ← URL routing rules

│ ├── data/

│ │ └── leaving-soon.json ← Weekly-updated leaving soon data

│ ├── blog/ ← Programmatic SEO content

│ └── icons/ ← PWA icons

├── schema.sql ← D1 database schema

├── wrangler.toml ← Cloudflare Worker config

└── .github/workflows/ ← CI/CD (optional)


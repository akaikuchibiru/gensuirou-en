# Gensuirou · Multilingual Mirror (JA / EN / 中文)

高級温泉旅館「源翠瓏」(https://gensuirou.com/) の 3 言語ミラーサイト。

Static HTML + CSS + JS, no build step. Deployed on Cloudflare Pages.

## Structure

| Page | Route |
|------|-------|
| Home (hero video, 12 rooms, reservation form) | `/` |
| Rooms — 12 villas + 紫 Shiori detail | `/rooms.html` |
| Cuisine — French–Japanese menu + prices | `/cuisine.html` |
| Onsen — mineral analysis + effects | `/onsen.html` |
| Facilities — sauna, body care | `/facilities.html` |
| Access — routes + map | `/access.html` |
| FAQ | `/faq.html` |
| Wedding | `/wedding.html` |

## Shared components

- `assets/site.css` — full styling (palette, typography, layout, animations)
- `assets/site.js` — i18n switcher, header/footer injection, lightbox, form
- `assets/imgs/`, `assets/imgs_rooms/`, `assets/imgs_1080_570/`, `assets/movie/` — mirrored source assets

## Local preview

```bash
open index.html
```

## Deploy

```bash
npx wrangler pages deploy . --project-name=gensuirou-en
```

## Status

Commissioned by the ryokan — this site takes **real reservation enquiries**.

The enquiry form is **not wired yet**. Until `/api/enquiry` exists, the `#reserve`
band on `index.html` shows the telephone instead of a form: a form that accepts
input it cannot deliver loses real bookings. Restore the form markup from
`git show 70174bb:index.html` when the endpoint is live.

Outstanding before launch: own domain, Email Routing (`info@`), Email Sending
(SPF/DKIM), Turnstile, D1 storage, per-language URLs + hreflang, 301 from
`gensuirou.tas-quest.com`.

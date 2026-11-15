# مومن کا ہتھیار — PWA

React + Vite + Tailwind CSS v4 + vite-plugin-pwa. Works offline on Android and iOS.

## Run
    npm install
    npm run dev        # http://localhost:5173
    npm run build      # output in dist/  → upload to Netlify / Vercel / Firebase Hosting (HTTPS required for PWA)

## Content (text, not images)
- src/data/index.json  — the فہرست (menu) of the whole book with page numbers
- src/data/*.json      — one file per chapter (all 17 chapters, whole book)

Block types inside each item: ar (Arabic), ur (ترجمہ), fz (فضیلت), note, lbl (sub-heading), ref (حوالہ), asma.


## Before publishing
Have the Arabic text proofread by a hafiz/alim, and take permission from the publisher.

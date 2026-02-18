# Prosjekt 2026 (PWA)

En mobilvennlig treningsapp med:
- daglig øktplan og logging
- autosave i localStorage
- streak + beste streak + 7-dagers historikk
- ukesmål (1–7) med progresjonsindikator
- dagsform (1–5) og smerte/ømhet (0–10) ved fullføring
- backup/restore av data (JSON)
- PWA-støtte (Netlify-vennlig)

## Lokal kjøring

Du kan åpne `index.html` direkte i nettleser, eller kjøre en enkel lokal server:

```bash
python3 -m http.server 4173
```

Gå til `http://localhost:4173`.

## Hosting (Netlify)

Denne appen fungerer som statisk side. Last opp repoet direkte i Netlify og bruk standard deploy.

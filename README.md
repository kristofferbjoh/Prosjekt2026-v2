# Prosjekt 2026 v2

Mobiltilpasset PWA for dagsplan, kosthold, trening og fremgang.

## Innhold

- Automatisk kaloriramme: 1 800–2 100 kcal mandag–torsdag og 2 400–2 800 kcal fredag–søndag.
- Egen fotballdagsramme og proteinmål på 150–170 gram.
- Hurtiglogging av vanlige måltider og manuell måltidslogg.
- Poengbasert dagsscore der 70 poeng holder streaken i live.
- Treningsfase 1, 2 og forhåndsbygd fase 3 for estetikk.
- Kroppssjekk for energi, akilles, ankel og rygg.
- Lagring av vekt, reps og følelse per øvelse.
- Vekttrend, 7-dagers snitt, midjemål og historikk.
- Eksport og import av backup.
- Kalenderpåminnelser og PWA/offline-støtte.

## Netlify

Netlify kan publisere repoets rotmappe direkte:

- Production branch: `main`
- Build command: tomt
- Publish directory: `.`

Når en pull request flettes inn i `main`, publiserer Netlify automatisk dersom repoet er koblet til prosjektet.

## Påminnelser

En ren PWA kan ikke garantere egendefinerte, tidsstyrte varsler når appen er helt lukket uten en push-tjeneste. Appen tilbyr derfor en nedlastbar kalenderfil med gjentakende morgen- og kveldspåminnelser.

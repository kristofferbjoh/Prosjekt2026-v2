# Prosjekt 2026 v3.1.0

En mobiltilpasset og offlineklar styrkelogg for Prosjekt 2026 med matt sort, varm hvit og dempet gull som visuell identitet. Appen er statisk, gratis å drifte og lagrer brukerdata lokalt på enheten.

## Hovedfunksjoner

- Fokusert startside med neste økt fra en redigerbar treningsrotasjon.
- Rask settlogging med kilo, reps, RIR og smerte per øvelse.
- Utkast lagres underveis, slik at en påbegynt økt tåler navigasjon og oppdatering.
- Økter, maler og øvelser kan redigeres direkte i appen.
- Historikk per økt og øvelse med tidligere belastning som referanse.
- Backup, gjenoppretting og import av eldre Prosjekt 2026-data.

## Data og oppdatering

Lagringsnøkkelen \`p2026_v2_state\` er beholdt. Eksisterende dagslogger, matdata, målinger og treningshistorikk blir liggende selv om v3-grensesnittet fokuserer på styrketrening. Import valideres før skriving, og sammenslåing beholder eksisterende poster ved konflikt.

Service workeren bruker en versjonert offlinepakke. En installert PWA viser et oppdateringsbanner og aktiverer ny versjon etter at åpne utkast er lagret. Versjonskontrollen i byggesteget krever at npm-metadata, HTML-ressurser og offlinepakken bruker samme versjon.

## Utvikling og Netlify

Node 22 eller nyere:

\`\`\`sh
npm ci
npm run build
\`\`\`

Bygget kjører tester og filkontroll før 11 offentlige filer kopieres til \`dist\`. Netlify bruker \`npm run build\` og publiserer \`dist\`. Produksjonen har ingen npm-avhengigheter eller betalte tjenester.

Behold samme Netlify-site og domene for at nettleseren skal finne eksisterende lokale data. Deploy Preview brukes som byggesjekk før endringer slås sammen til produksjonsgrenen \`main\`.

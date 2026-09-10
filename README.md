# Prosjekt 2026 v2.1.1

Personlig, mobiltilpasset trenings- og matcoach. Statisk PWA uten konto, sporing, server eller betalte API-er. Brukerdata lagres på enheten og sendes ikke til GitHub eller Netlify.

## Daglig bruk

- Innsjekk med energi, smerte, hevelse, søvn og reaksjon siden forrige økt. Rådene er forsiktige regler, ikke medisinsk klarering.
- Redigerbar ukeplan med tirsdagsfotball og valgfri søndagsøkt. Eksisterende dagsplaner beholdes. Fase 1 og 2 videreføres.
- Full økt og minimumsmodus. Utkast lagres ved hver endring; bare avkryssede sett lagres som gjennomført. Reps og følelse arves ikke automatisk.
- Progresjonsforslag krever to sammenlignbare, komplette økter, minst to reps i reserve og vurdert toleranse. Ingen automatisk økning av belastningen.
- Mat per porsjon eller 100 gram, desimalkomma, redigering, favoritter med mengde, datovalg og angre sletting. Kopiering legger til; den overskriver aldri dagens mat.
- Kalorivurdering åpnes når hele matdagen er logget. Dagsscore er innsats og kontinuitet, ikke en helsemåling. Hvile teller som plan.
- Vekttrend med faktiske datoavstander og tydelig datagrunnlag. Gamle målinger presenteres ikke som siste ukes snitt.

## Data og oppdatering

Beholder lagringsnøkkelen `p2026_v2_state`. Dataskjema 3 er en additiv oppdatering av v2. Ukjente felt beholdes. Original v2 lagres før migrering i `p2026_v2_state_before_v3`; eldre `p2026_*` nøkler slettes ikke. Treningsutkast, alternativ trening og tidligere beste streak tas med fra den gamle appen.

Import valideres før skriving. Rå `p2026v2_*`-backup fra den første v2-appen gjenkjennes og konverteres med originaldataene bevart. Standard er å legge til manglende poster; ved samme dato/ID beholdes eksisterende. Full gjenoppretting krever bekreftelse og lager en lokal gjenopprettingskopi. Eksporter egen backup før bytte av enhet/nettadresse eller sletting av nettleserdata. Data synkroniseres **ikke** mellom enheter eller domener.

Lagringsfeil vises permanent, og korrupt lagring overskrives ikke med en tom app. Stale skrivinger fra andre faner avvises. Ved konflikt: eksporter åpne utkast og last siden på nytt. Bruk helst én fane. LocalStorage er fortsatt begrenset av nettleserens kvote; lokal gjenopprettingskopi beskytter ikke mot sletting av all nettleserdata.

Service worker installerer en hel, versjonert pakke og venter på at brukeren velger oppdatering. Ingen automatisk reload midt i en økt. Ukjente ressurser og tredjepartsforespørsler blir ikke lagret i appens cache. Eksisterende PWA-startadresse/identitet beholdes.

## Utvikling og Netlify

Node 22 eller nyere:

```sh
npm ci
npm run build
```

Byggingen kjører regresjonstester og filkontroll før de 11 offentlige filene kopieres til `dist`. Produksjonen har ingen npm-avhengigheter; jsdom brukes bare i tester.

`netlify.toml` setter bygg til `npm run build` og publiseringsmappe til `dist`. Behold **samme Netlify-site og domene** for å bevare tilgangen til eksisterende lokale data. `main` er produksjonsgren når Netlify er koblet til repoet. PR-grener kan brukes til Deploy Preview, men preview-domenet har separat, tom lagring.

Ingen produksjonsdeploy skal betegnes som bekreftet uten terminal deploy-status og riktig URL. Testene dekker logikk og DOM-hendelser i jsdom samt service-worker-hendelser med simulerte nettverks-/cacheobjekter. De erstatter ikke testing av installasjon, Safari/iOS-lagring, visuell layout og offlineoppdatering på en fysisk telefon.

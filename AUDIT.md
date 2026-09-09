# Gjennomgang – 9. september 2026

Utgangspunkt: `89dfc2511bac09cf1b6c87b1dc0f682276af24d1` på main.

| Område | Funn i utgangspunktet | Endring |
|---|---|---|
| Arkitektur | UI, data, medisinske signaler og beregninger i én lukket funksjon | Separate programdata, ren regelmotor og lagringsadapter. Ingen runtime-avhengigheter |
| Lagring | Lesefeil ble en tom app som straks ble lagret; skrivefeil skjult i minne | Original beholdes, sikkerhetskopi før migrering, tydelig feil og eksport |
| Historikk | Ny økt samme dag erstattet annen økt med samme nøkkel | Økt-ID; samme utkast oppdateres idempotent, nytt utkast gir separat økt |
| Øktflyt | Tabbytte mistet redigeringer; tidligere reps/følelse så utført ut | Umiddelbare utkast per dato/fase/økt/modus, tomme reps, eksplisitt utført |
| Progresjon | Ett utfylt sett kunne gi økningsforslag | To komplette økter i samme fase, alle sett, reps, RIR, toleranse og nylig beinbelastning |
| Mat | Kopiering overskrev dagen, redigering brukte fire prompts | Additiv kopiering, vanlig redigeringsskjema, gram, datovalg og angre |
| Readiness | Prosent og «grønt lys» kunne oppleves som medisinsk godkjenning | Kvalitative signaler, hevelse og neste-dag-reaksjon; ingen diagnose |
| Dagsscore | Ufullstendig matlogg vurdert som kaloriinntak; lagret score ble utdatert | Komplettmarkering og oppdatering ved endringer; historiske mål bevares |
| Fremgang | Gammel sisteuke vist som aktuell; jevne x-avstander uansett dato | Faktisk siste 7 dager, antall målinger, datoavstand i graf |
| PWA | Aktivert umiddelbart, alle cacher slettet, feilsvar cachet | Versjonert hel pakke, brukerinitiert aktivering, kun egne ressurser |
| Mobil | Små tekster/knapper, svakt merkede settfelt | Større treffområder, feltetiketter, fokusmarkering og redusert bevegelse |

## Bevarte rammer

Fase 2 videreføres; ingen automatisk fase 3. Oppgitt kaloriramme/proteinmål/målvekt beholdes og kan redigeres. Ingen nye personopplysninger eller private logger er lagt i repoet. Søndagsfotball håndteres som valgfritt; ukeplanen kan tilpasses. Ingen flytting til nytt domene eller betalt backend.

## Verifikasjon og avgrensninger

Testene bruker syntetiske data, ikke brukerens faktiske nettleserlagring. De dekker v2-migrering, legacy-notater/utkast, mat og import, reps/progresjon, datoer, score, skrivefeil og service-worker-hendelser. `npm run build` stanser ved feil.

Fysisk iOS/Android-installering, visuell QA i en ekte nettleser og live Netlify-status er ikke verifisert i det lokale testmiljøet. De originale ikonfilene er begge 1024×1024; manifestet oppgir nå faktisk størrelse, men eksakte 192/512-varianter er fortsatt en anbefalt forbedring for plattformkompatibilitet. Gamle shell-cacher beholdes for åpne gamle faner; de inneholder appfiler, ikke helse-/treningslogger.

LocalStorage er en bevisst gratis/offline-løsning, ikke en skyløsning. Stale-write-sjekken reduserer fanekonflikter, men er ikke en atomisk database med samtidige skribenter. Bruk én fane ved logging. Første migrering stoppes dersom originalkopien ikke kan lagres. Lag ekstern backup regelmessig.

Den fullstendige MR-beskrivelsen var ikke tilgjengelig i gjenfunnet kontekst. Derfor legges ingen antatt MR-diagnose eller ny spesifikk rehabiliteringsprotokoll inn. Fysioterapeutens individuelle plan går foran appens generelle øvelsesliste.

## Regelgrunnlag

Appens poenggrenser og progresjonsporter er produktregler, ikke klinisk validerte terskler.

- [NHS: ankelplager, symptomer og vurdering](https://www.nhs.uk/symptoms/foot-pain/ankle-pain/)
- [ACSM: oppdaterte styrketreningsråd 2026](https://acsm.org/resistance-training-guidelines-update-2026/)
- [MDN: service-worker-livssyklus](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN: lagringskvoter og sletting](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: PWA-identitet og startadresse](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)

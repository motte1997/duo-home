# Duo Home – Haushalts-App für zwei

Installierbare Web-App (PWA) für iPhone: Aufgaben fair verteilen, Punkte sammeln, Statistiken & Streaks, Push-Erinnerungen.
Kosten: **0 €** (Supabase Free + Cloudflare/GitHub Pages, kein Apple-Developer-Account, kein Mac).

**Stack:** React + TypeScript + Vite · Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron) · Web Push (VAPID)

```
src/            React-App (Screens, Store, Statistik-Logik, SVG-Charts)
public/         manifest, Service Worker (Offline-Shell + Push), Icons
supabase/
  schema.sql    Tabellen, RLS, Trigger, RPC-Funktionen (Erledigen, Rückgängig, Überspringen, …)
  cron.sql      Zeitplan für Erinnerungen (alle 15 Minuten)
  functions/send-push/index.ts   Edge Function für Push
```

---

## Einrichtung (ca. 30 Minuten, Windows)

Voraussetzung: [Node.js LTS](https://nodejs.org) installiert. Alle Befehle in PowerShell im Projektordner.

### 1. Supabase-Projekt anlegen
1. Auf <https://supabase.com> kostenlos registrieren → **New project** (Region: Frankfurt).
2. **SQL Editor → New query**: Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. **Authentication → Providers → Email**: „Confirm email“ **ausschalten** (einfachster Weg für 2 Personen; sonst müsst ihr den Link per Mail bestätigen).
4. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.

### 2. Lokale Konfiguration
```powershell
npm install
copy .env.example .env
npm run vapid          # erzeugt Public/Private VAPID-Key – beide notieren
```
In `.env` eintragen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.

Lokal testen: `npm run dev` → <http://localhost:5173> (Push geht nur über HTTPS/Installation, siehe Schritt 5).

### 3. Push-Funktion deployen
```powershell
npm i -g supabase            # oder: npx supabase ...
supabase login
supabase link --project-ref DEIN-PROJEKT-REF
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:du@beispiel.de CRON_SECRET=ein-langes-zufälliges-geheimnis
supabase functions deploy send-push --no-verify-jwt
```
(`--no-verify-jwt` ist nötig, weil die Funktion den Nutzer bzw. das Cron-Secret selbst prüft.)

### 4. Erinnerungen aktivieren
In `supabase/cron.sql` `DEIN-PROJEKT-REF` und `DEIN-CRON-SECRET` ersetzen (dasselbe Secret wie oben), im SQL Editor ausführen.
Danach prüft Supabase alle 15 Minuten: fällige Aufgaben (zur eingestellten Erinnerungszeit, Standard 08:00) und überfällige (ab 09:00, einmal pro Tag).

### 5. Veröffentlichen (kostenlos)
```powershell
npm run build
```
Den Ordner `dist/` auf **Cloudflare Pages** (Direct Upload) oder GitHub Pages hochladen. Beim Hosting-Dienst die beiden `VITE_…`-Variablen **vor dem Build** setzen bzw. den Build lokal mit gefüllter `.env` erzeugen (Anon-Key ist öffentlich vorgesehen; Schutz erfolgt über Row Level Security).

### 6. Auf dem iPhone installieren
1. URL in **Safari** öffnen → Teilen ⬆︎ → **Zum Home-Bildschirm**.
2. App vom Home-Bildschirm öffnen → registrieren → Haushalt erstellen.
3. **Einstellungen → Push aktivieren** (nur in der installierten App möglich, iOS 16.4+).
4. Partner registriert sich, wählt **Beitreten** und gibt den Einladungscode ein.

---

## Funktionsüberblick

| Bereich | Umfang |
|---|---|
| Aufgaben | einmalig; täglich, wöchentlich (mit Wochentagen, alle N Wochen), alle X Tage, monatlich (Tag im Monat), individuell (N Tage/Wochen/Monate); „Fester Takt“ oder „Ab Erledigung“; Enddatum; Erinnerungszeit; Verschieben, Überspringen, Archivieren |
| Zuweisung | Person A / B, Offen (wer zuerst), **Abwechselnd** (Wechsel nach jeder Erledigung) |
| Punkte | frei wählbar je Aufgabe; Ledger (`point_events`); Rückgängig; Rangliste Woche/Monat/Gesamt; Historie |
| Dashboard | Punktestand, Wochenfortschritt, Offen/Heute/Woche, Überfällig, „Heute erledigt“ |
| Statistik | Aufgaben pro Woche/Monat (blätterbar), Punkteentwicklung, Aufgabenteilung in %, „Wer macht was“, Streaks (pro Person + „Beide aktiv“) |
| Push | fällig, überfällig, Partner hat erledigt |
| Sonstiges | Dark/Light/System, Realtime-Sync, Offline-Ansicht (gecachte Daten), JSON-Export |

## Bekannte Grenzen
- **Offline** ist nur lesend (letzter Stand wird angezeigt); Änderungen brauchen Verbindung.
- Push auf iOS funktioniert nur in der **installierten** App (iOS 16.4+) und kann bei sehr restriktiven Energiespar-Einstellungen verzögert eintreffen.
- Supabase Free pausiert Projekte nach 7 Tagen ohne Aktivität (bei täglicher Nutzung kein Thema; ggf. im Dashboard „Restore“).
- Kein Haushalt-Verlassen/Löschen in der UI (Daten bei Bedarf im Supabase-Dashboard bearbeiten).

## Tests
`supabase/schema.sql` wurde gegen eine Postgres-Instanz geprüft (Wiederholungslogik inkl. Monatsende, Wechsel-Zuweisung, Punkte/Rückgängig, Archivieren, 2-Personen-Limit, Erinnerungs-Deduplizierung). Frontend: `npm run build` (TypeScript strict) läuft fehlerfrei.

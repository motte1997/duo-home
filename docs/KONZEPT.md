# Duo Home – Konzept

## Technologieentscheidung
PWA (React/TypeScript) + Supabase Free. Gründe: kein Mac und kein Apple-Developer-Account (99 €/Jahr) nötig, Push auf iOS ab 16.4 über Web Push, ein Codebase für iOS und später Android, Postgres/SQL für Statistik, Open Source (Supabase, React, Vite). Spätere Native-Hülle via Capacitor möglich.

## Architektur
```
iPhone A / B (PWA)
 ├─ React + TS + Vite, iOS-Design (HIG), Dark/Light
 ├─ Store (Context) + Realtime-Reload, Cache in localStorage (Offline lesen)
 ├─ Service Worker: App-Shell-Cache + Push
 └─ supabase-js ─► Supabase
                    ├─ Auth (E-Mail/Passwort)
                    ├─ Postgres + RLS (Zugriff nur auf eigenen Haushalt)
                    ├─ RPC: complete/undo/skip_occurrence, create/join_household
                    ├─ Realtime (Partner-Änderungen live)
                    ├─ Edge Function send-push (VAPID)
                    └─ pg_cron (15 min) ─► send-push ─► get_due_notifications()
```

## Datenmodell
- `households` (Zeitzone, Einladungscode) 1 : max. 2 `profiles`
- `tasks` = Vorlage (Punkte, Zuweisung, Wiederholung, Erinnerungszeit)
- `task_occurrences` = konkrete Instanz (Fälligkeit, Zuständiger, Status)
- `point_events` = unveränderliches Punkte-Ledger mit Titel-Schnappschuss (Historie bleibt nach Löschen erhalten)
- `push_subscriptions`, `notification_log` (Dedupe)

Erledigen ist eine Transaktion: Punkte buchen → Folgeinstanz erzeugen (fester Takt oder ab Erledigung, verpasste Termine werden übersprungen) → bei „Abwechselnd“ Zuständigkeit wechseln.

## Screens & Navigation
Tab-Bar: **Heute** · **Aufgaben** · **Statistik** · **Einstellungen**; Detailseite (Push-Navigation), Rangliste (Push), Aufgaben-Formular (Bottom Sheet), Onboarding/Login vor dem Tab-Bar-Flow. Push-Nachrichten öffnen per Deep Link (`#/task/<id>`) die Aufgabe.

## MVP (umgesetzt)
Alle Anforderungen aus dem Briefing: Aufgaben (einmalig/wiederkehrend mit flexiblen Intervallen), Zuweisung, Fälligkeit, Erinnerungen, Punkte/Historie/Rangliste, Statistiken & Streaks, Dashboard, Push (fällig, überfällig, Partner erledigt), Dark/Light.

## Roadmap
1. v1.1 Kategorien/Räume, Unteraufgaben, Vorlagenbibliothek, Kommentare, Offline-Schreibwarteschlange, Wisch-Aktionen
2. v1.2 Belohnungen (Punkte einlösen), Wochenziele, Abzeichen, wöchentlicher Fairness-Report per Push
3. v1.3 Einkaufsliste, Haushaltskasse
4. v2 Capacitor-Hülle (Widgets, Haptik, App-Store), ICS-Kalenderexport, Siri-Kurzbefehle, Android-Feinschliff

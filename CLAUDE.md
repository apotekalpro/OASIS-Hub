# OASIS Hub — Developer Guide

## Overview
OASIS Hub is an internal team & task management system inspired by Lark and Nimbly.
Built with Next.js 14 (App Router), Supabase, Tailwind CSS, Zustand.

## Architecture

```
src/
├── app/
│   ├── (auth)/          # login, change-password (no layout wrapping)
│   ├── (dashboard)/     # main app — sidebar layout, auth-gated
│   ├── (admin)/         # admin panel — role-gated (dept_head+)
│   └── api/             # REST endpoints (notifications, reminders, users)
├── components/
│   ├── ui/              # base components (button, input, card, badge, avatar)
│   ├── layout/          # sidebar, profile-provider
│   ├── notifications/   # realtime notification provider
│   └── admin/           # user-management-client, dept-management-client
├── lib/
│   ├── supabase/        # client.ts (browser), server.ts (SSR + admin)
│   ├── auth/            # actions.ts (server actions), permissions.ts
│   ├── email/           # send.ts (Resend), templates.ts
│   └── utils/           # cn, formatDate, parseCSV, etc.
├── store/               # Zustand: auth.ts, notifications.ts
├── types/               # database.ts (all types)
└── middleware.ts         # route protection + role gates
supabase/
└── migrations/
    ├── 001_initial_schema.sql   # all tables
    ├── 002_rls_policies.sql     # row-level security
    ├── 003_functions_and_triggers.sql
    └── 004_seed_superadmin.sql
```

## Role Hierarchy
```
super_admin (100) → org_admin (80) → dept_head (60) → team_leader (40) → auditor (35) → member (20) → viewer (10)
```
- Department Head is at same level as HR functions (merged)
- No public registration — SuperAdmin/OrgAdmin creates all users
- Default first-time password: `Alpro@123` (set in .env.local as DEFAULT_USER_PASSWORD)
- Users are forced to change password on first login

## Environment Setup
Copy `.env.local` and fill:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY (for email)
- CRON_SECRET (for reminder cron endpoint)

## Supabase Setup
1. Run migrations in order: 001 → 002 → 003 → 004
2. Enable Realtime for the `notifications` table
3. Create the Super Admin user via Supabase Auth Dashboard, then update their profile.role = 'super_admin'

## Reminder/Notification Cron
Call `POST /api/reminders/process` with header `x-cron-secret: <CRON_SECRET>` every 5 minutes.
Use Netlify Scheduled Functions, Vercel Cron, or an external scheduler.

## Build Phases
| Phase | Status |
|---|---|
| 1 — Auth, Org, Roles, Users | ✅ Framework done |
| 2 — Departments, Teams, Directory | 🔜 |
| 3 — Task Management | 🔜 |
| 4 — Messaging / Channels | 🔜 |
| 5 — Inspection Forms | 🔜 |
| 6 — Analytics & Reports | 🔜 |
| 7 — Calendar, Files, Polish | 🔜 |

## Commands
```bash
npm run dev       # start dev server
npm run build     # production build
npm run lint      # ESLint
```

-- ============================================================
-- OASIS Hub — Inspection / Outlet Audit Module
-- Inspired by Nimbly: outlets, checklist templates, scheduled
-- sessions, per-question responses, issue management & escalation
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type outlet_status as enum ('active', 'inactive', 'suspended');

create type question_type as enum (
  'yes_no',           -- Pass/Fail with optional note
  'multiple_choice',  -- Pick one from options list
  'multi_select',     -- Pick many from options list
  'text',             -- Free-text answer
  'numeric',          -- Number with optional min/max/threshold
  'photo',            -- One or more photos required
  'file',             -- Document upload
  'rating',           -- 1-5 star score
  'signature',        -- Signature capture
  'datetime',         -- Date/time picker
  'barcode'           -- Barcode / QR scan result
);

create type schedule_frequency as enum (
  'once',
  'daily',
  'weekly',
  'fortnightly',
  'monthly'
);

create type session_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'approved',
  'rejected'
);

create type issue_severity as enum ('low', 'medium', 'high', 'critical');
create type issue_status as enum ('open', 'in_progress', 'resolved', 'closed', 'escalated');

-- ============================================================
-- OUTLETS  (stores / pharmacies / sites)
-- ============================================================

create table outlets (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete cascade,
  dept_id       uuid references departments(id) on delete set null,
  name          text not null,
  code          text,                       -- e.g. "PJ-001"
  address       text,
  city          text,
  state         text,
  country       text default 'Malaysia',
  lat           numeric(10,7),
  lng           numeric(10,7),
  phone         text,
  manager_id    uuid references profiles(id) on delete set null,
  status        outlet_status default 'active',
  metadata      jsonb default '{}'::jsonb,  -- custom fields (store type, size, etc.)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Staff assigned to outlets (many-to-many)
create table outlet_staff (
  outlet_id   uuid references outlets(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  is_primary  boolean default false,       -- primary assignee for this outlet
  assigned_at timestamptz default now(),
  primary key (outlet_id, user_id)
);

-- ============================================================
-- INSPECTION TEMPLATES  (questionnaire definitions)
-- ============================================================

create table inspection_templates (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  dept_id          uuid references departments(id) on delete set null,
  title            text not null,
  description      text,
  category         text,                   -- e.g. "Daily Ops", "Mystery Shopper", "FDA Audit"
  is_mystery_shopper boolean default false,
  passing_score    numeric(5,2),           -- minimum % to pass (null = no scoring)
  version          integer default 1,
  is_active        boolean default true,
  created_by       uuid references profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Sections group related questions within a template
create table template_sections (
  id           uuid primary key default uuid_generate_v4(),
  template_id  uuid not null references inspection_templates(id) on delete cascade,
  title        text not null,
  description  text,
  position     integer not null default 0,
  created_at   timestamptz default now()
);

-- Individual questions inside a section
create table template_questions (
  id                     uuid primary key default uuid_generate_v4(),
  section_id             uuid not null references template_sections(id) on delete cascade,
  template_id            uuid not null references inspection_templates(id) on delete cascade,
  question_text          text not null,
  hint_text              text,              -- helper shown beneath question
  question_type          question_type not null,
  options                jsonb,             -- for multiple_choice / multi_select: ["Option A","Option B"]
  is_required            boolean default true,
  score_weight           numeric(5,2) default 1, -- points this question is worth
  -- Numeric question config
  numeric_min            numeric,
  numeric_max            numeric,
  numeric_threshold      numeric,           -- value below which issue is auto-raised
  -- Flagging
  flags_issue_on         text,              -- "no" | "fail" | "below_threshold" | null
  issue_severity         issue_severity default 'medium',
  -- Conditional display
  depends_on_question_id uuid references template_questions(id) on delete set null,
  depends_on_value       text,             -- show this question only when parent = this value
  -- Reference material
  reference_image_url    text,
  reference_note         text,
  position               integer not null default 0,
  created_at             timestamptz default now()
);

-- ============================================================
-- INSPECTION SCHEDULES  (template assigned to outlet on cadence)
-- ============================================================

create table inspection_schedules (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  template_id     uuid not null references inspection_templates(id) on delete cascade,
  outlet_id       uuid not null references outlets(id) on delete cascade,
  assigned_to     uuid references profiles(id) on delete set null,   -- specific user override
  frequency       schedule_frequency not null default 'daily',
  scheduled_time  time,                    -- e.g. 09:00 for 9 AM daily
  day_of_week     integer,                 -- 0=Sun, 1=Mon … 6=Sat (for weekly)
  day_of_month    integer,                 -- 1-28 (for monthly)
  starts_at       date not null default current_date,
  ends_at         date,
  is_active       boolean default true,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  unique (template_id, outlet_id, frequency, scheduled_time)
);

-- ============================================================
-- INSPECTION SESSIONS  (one execution of a checklist at an outlet)
-- ============================================================

create table inspection_sessions (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  schedule_id     uuid references inspection_schedules(id) on delete set null,
  template_id     uuid not null references inspection_templates(id),
  outlet_id       uuid not null references outlets(id),
  conducted_by    uuid not null references profiles(id),
  status          session_status default 'not_started',
  score           numeric(5,2),            -- calculated on submit (0-100)
  score_max       numeric(5,2),            -- max possible score
  pass_fail       boolean,                 -- null until submitted
  started_at      timestamptz,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  approved_by     uuid references profiles(id),
  rejection_note  text,
  notes           text,                    -- overall session notes
  location_lat    numeric(10,7),           -- GPS at session start
  location_lng    numeric(10,7),
  scheduled_for   timestamptz,             -- when it was supposed to happen
  created_at      timestamptz default now()
);

-- Per-question responses within a session
create table session_responses (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references inspection_sessions(id) on delete cascade,
  question_id     uuid not null references template_questions(id),
  -- Answer payload (only relevant fields will be populated)
  answer_text     text,                    -- yes_no, text, barcode
  answer_numeric  numeric,                 -- numeric, rating
  answer_options  text[],                  -- multiple_choice, multi_select (selected values)
  answer_boolean  boolean,                 -- yes_no: true=yes/pass, false=no/fail
  photo_urls      text[] default '{}',     -- uploaded photo URLs
  file_urls       text[] default '{}',     -- uploaded file URLs
  -- Meta
  note            text,                    -- optional per-question comment
  flagged         boolean default false,   -- auto-set if answer triggers issue
  responded_at    timestamptz default now(),
  unique (session_id, question_id)
);

-- ============================================================
-- INSPECTION ISSUES  (problems raised during or after sessions)
-- ============================================================

create table inspection_issues (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  session_id       uuid references inspection_sessions(id) on delete set null,
  question_id      uuid references template_questions(id) on delete set null,
  response_id      uuid references session_responses(id) on delete set null,
  outlet_id        uuid not null references outlets(id),
  title            text not null,
  description      text,
  severity         issue_severity default 'medium',
  status           issue_status default 'open',
  raised_by        uuid not null references profiles(id),
  assigned_to      uuid references profiles(id),
  photo_urls       text[] default '{}',
  resolution_note  text,
  resolved_by      uuid references profiles(id),
  resolved_at      timestamptz,
  due_at           timestamptz,            -- SLA deadline
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Escalation log (automated SLA escalations)
create table issue_escalations (
  id            uuid primary key default uuid_generate_v4(),
  issue_id      uuid not null references inspection_issues(id) on delete cascade,
  escalated_to  uuid not null references profiles(id),
  level         integer not null,          -- 1, 2, 3 …
  reason        text,
  escalated_at  timestamptz default now()
);

-- Issue comments / activity log
create table issue_comments (
  id          uuid primary key default uuid_generate_v4(),
  issue_id    uuid not null references inspection_issues(id) on delete cascade,
  user_id     uuid not null references profiles(id),
  content     text not null,
  photo_urls  text[] default '{}',
  created_at  timestamptz default now()
);

-- ============================================================
-- ESCALATION RULES  (per-org SLA config)
-- ============================================================

create table escalation_rules (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organizations(id) on delete cascade,
  severity        issue_severity not null,
  level           integer not null,        -- 1, 2, 3
  escalate_after_hours integer not null,   -- hours before escalating to this level
  escalate_to_role user_role,              -- role that gets notified
  escalate_to_user uuid references profiles(id),
  created_at      timestamptz default now(),
  unique (org_id, severity, level)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_outlets_org on outlets(org_id);
create index idx_outlet_staff_user on outlet_staff(user_id);
create index idx_outlet_staff_outlet on outlet_staff(outlet_id);

create index idx_inspection_templates_org on inspection_templates(org_id);
create index idx_template_sections_template on template_sections(template_id);
create index idx_template_questions_section on template_questions(section_id);
create index idx_template_questions_template on template_questions(template_id);

create index idx_inspection_schedules_org on inspection_schedules(org_id);
create index idx_inspection_schedules_outlet on inspection_schedules(outlet_id);
create index idx_inspection_schedules_template on inspection_schedules(template_id);

create index idx_inspection_sessions_org on inspection_sessions(org_id);
create index idx_inspection_sessions_outlet on inspection_sessions(outlet_id);
create index idx_inspection_sessions_user on inspection_sessions(conducted_by);
create index idx_inspection_sessions_status on inspection_sessions(status);
create index idx_inspection_sessions_scheduled on inspection_sessions(scheduled_for);

create index idx_session_responses_session on session_responses(session_id);
create index idx_session_responses_flagged on session_responses(flagged) where flagged = true;

create index idx_inspection_issues_org on inspection_issues(org_id);
create index idx_inspection_issues_outlet on inspection_issues(outlet_id);
create index idx_inspection_issues_status on inspection_issues(status);
create index idx_inspection_issues_severity on inspection_issues(severity);
create index idx_inspection_issues_assigned on inspection_issues(assigned_to);

create index idx_issue_comments_issue on issue_comments(issue_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger set_outlets_updated_at before update on outlets
  for each row execute function update_updated_at();

create trigger set_inspection_templates_updated_at before update on inspection_templates
  for each row execute function update_updated_at();

create trigger set_inspection_issues_updated_at before update on inspection_issues
  for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE ISSUE FROM FLAGGED RESPONSE
-- Fires when a session_response is inserted/updated with flagged=true
-- ============================================================

create or replace function auto_raise_inspection_issue()
returns trigger as $$
declare
  v_outlet_id uuid;
  v_org_id    uuid;
  v_question  record;
  v_session   record;
begin
  if new.flagged = false then
    return new;
  end if;

  select s.outlet_id, s.org_id, s.conducted_by
    into v_session
    from inspection_sessions s
   where s.id = new.session_id;

  select q.question_text, q.issue_severity
    into v_question
    from template_questions q
   where q.id = new.question_id;

  -- Only create if not already exists for this response
  if not exists (
    select 1 from inspection_issues
     where response_id = new.id
  ) then
    insert into inspection_issues (
      org_id, session_id, question_id, response_id,
      outlet_id, title, description, severity,
      status, raised_by, photo_urls
    ) values (
      v_session.org_id,
      new.session_id,
      new.question_id,
      new.id,
      v_session.outlet_id,
      'Issue: ' || v_question.question_text,
      new.note,
      coalesce(v_question.issue_severity, 'medium'),
      'open',
      v_session.conducted_by,
      new.photo_urls
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger auto_raise_issue_on_flagged_response
  after insert or update of flagged
  on session_responses
  for each row
  when (new.flagged = true)
  execute function auto_raise_inspection_issue();

-- ============================================================
-- AUTO-CALCULATE SESSION SCORE ON SUBMIT
-- ============================================================

create or replace function calculate_session_score(p_session_id uuid)
returns void as $$
declare
  v_total_weight numeric := 0;
  v_earned_weight numeric := 0;
  v_score numeric;
  v_template_id uuid;
  v_passing_score numeric;
begin
  select template_id into v_template_id
    from inspection_sessions where id = p_session_id;

  select passing_score into v_passing_score
    from inspection_templates where id = v_template_id;

  -- Sum weights for all questions that were answered pass/yes
  select
    sum(q.score_weight),
    sum(case
      when r.answer_boolean = true then q.score_weight
      when r.answer_text is not null and r.flagged = false then q.score_weight
      when r.answer_numeric is not null and r.flagged = false then q.score_weight
      else 0
    end)
  into v_total_weight, v_earned_weight
  from session_responses r
  join template_questions q on q.id = r.question_id
  where r.session_id = p_session_id;

  if v_total_weight > 0 then
    v_score := round((v_earned_weight / v_total_weight) * 100, 2);
  else
    v_score := null;
  end if;

  update inspection_sessions set
    score = v_score,
    score_max = v_total_weight,
    pass_fail = case
      when v_score is null then null
      when v_passing_score is null then null
      else v_score >= v_passing_score
    end,
    status = 'submitted',
    submitted_at = now()
  where id = p_session_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- NOTIFY ASSIGNED USER WHEN ISSUE IS RAISED
-- ============================================================

create or replace function notify_on_inspection_issue()
returns trigger as $$
declare
  v_outlet_name text;
begin
  select name into v_outlet_name from outlets where id = new.outlet_id;

  insert into notifications (
    org_id, user_id, type, title, body, metadata
  )
  select
    new.org_id,
    p.id,
    'system',
    'New inspection issue at ' || v_outlet_name,
    new.title,
    jsonb_build_object('issue_id', new.id, 'outlet_id', new.outlet_id, 'severity', new.severity)
  from profiles p
  where p.org_id = new.org_id
    and (
      p.id = new.assigned_to
      or p.role in ('org_admin', 'super_admin', 'dept_head')
    )
    and p.is_active = true;

  return new;
end;
$$ language plpgsql security definer;

create trigger notify_on_issue_created
  after insert on inspection_issues
  for each row execute function notify_on_inspection_issue();

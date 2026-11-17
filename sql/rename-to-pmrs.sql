-- ============================================================================
--  Rename the public brand from ORBIT to PMRS.
--
--  This touches CONTENT ONLY. It must never touch students, teams, sessions,
--  registrations or admin credentials: those reference rows by id, several have
--  foreign keys into the tables below, and a careless UPDATE there logs people
--  out or orphans a team.
--
--  Safe to run more than once.
--
--  Run against the live database with either:
--    psql "$DATABASE_URL" -f sql/rename-to-pmrs.sql
--  or paste it into the Supabase SQL editor.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- settings
-- Branding and copy live as one JSON document per section, so the rename is a
-- jsonb merge rather than a column update. `||` on jsonb replaces top-level keys.
UPDATE settings
SET value = value || jsonb_build_object(
      'name', 'PMRS',
      'fullName', 'Peshawar Model Robotics Society',
      'tagline', 'Innovate · Build · Compete',
      'description', 'The student robotics and engineering society of Peshawar Model School — where students design, build and compete with machines they made themselves.',
      'footerNote', 'Run by students, for students.',
      'logoMark', 'P',
      'metaDescription', 'Peshawar Model Robotics Society — a student robotics and engineering society in Peshawar. Register your team, choose a field of entry and present the machine you built.'
    ),
    updated_at = now()
WHERE key = 'site';

-- Event prose: the intro paragraph and the about body both name the old brand.
UPDATE settings
SET value = value
      || jsonb_build_object(
           'intro', replace(coalesce(value ->> 'intro', ''), 'ORBIT', 'PMRS'),
           'aboutBody', replace(coalesce(value ->> 'aboutBody', ''), 'ORBIT', 'PMRS')
         ),
    updated_at = now()
WHERE key = 'event' AND (value ->> 'intro' || value ->> 'aboutBody') ~* 'orbit';

-- Registration copy also names the brand in its closed-state message.
UPDATE settings
SET value = value || jsonb_build_object(
      'closedMessage', replace(coalesce(value ->> 'closedMessage', ''), 'ORBIT', 'PMRS')
    ),
    updated_at = now()
WHERE key = 'registration' AND (value ->> 'closedMessage') ~* 'orbit';

-- Prose that names the old event. Anything already edited by an organiser to
-- mention PMRS is left as-is.
UPDATE settings
SET value = jsonb_build_object(
      'email', replace(coalesce(value ->> 'email', ''), 'orbit-olympiad.org', 'pmrs.pk'),
      'phone', coalesce(value ->> 'phone', ''),
      'whatsapp', coalesce(value ->> 'whatsapp', ''),
      'organizerName', 'Peshawar Model Robotics Society',
      'organizerRole', coalesce(value ->> 'organizerRole', 'Organising committee'),
      'organiserBody', replace(
        coalesce(value ->> 'organiserBody', ''),
        'ORBIT', 'PMRS'
      ),
      'address', coalesce(value ->> 'address', ''),
      'hours', coalesce(value ->> 'hours', '')
    ),
    updated_at = now()
WHERE key = 'contact'
  AND (value ->> 'email') LIKE '%orbit%';

-- Copyright line
UPDATE settings
SET value = value || jsonb_build_object(
      'copyright', 'Peshawar Model Robotics Society',
      'credit', 'Peshawar Model Robotics Society'
    ),
    updated_at = now()
WHERE key = 'footer';

-- ------------------------------------------------------------------- copy
-- Case-insensitive term replacement across the prose columns. `replace()` is
-- literal, so this handles the three casings that actually appear.
UPDATE articles
SET body = replace(replace(replace(body, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS'),
    excerpt = replace(replace(replace(excerpt, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS')
WHERE body ~* 'orbit' OR excerpt ~* 'orbit';

UPDATE faqs
SET question = replace(replace(replace(question, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS'),
    answer = replace(replace(replace(answer, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS')
WHERE question ~* 'orbit' OR answer ~* 'orbit';

UPDATE announcements
SET title = replace(replace(replace(title, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS'),
    body = replace(replace(replace(body, 'ORBIT', 'PMRS'), 'Orbit', 'PMRS'), 'orbit', 'PMRS')
WHERE title ~* 'orbit' OR body ~* 'orbit';

COMMIT;

-- ------------------------------------------------------------------ verify
-- Expect zero rows: nothing a visitor can read should still carry the old name.
SELECT 'settings' AS source, key AS where_
FROM settings
WHERE value::text ~* 'orbit'
UNION ALL
SELECT 'articles', title FROM articles WHERE (title || ' ' || coalesce(excerpt, '') || ' ' || body) ~* 'orbit'
UNION ALL
SELECT 'faqs', question FROM faqs WHERE (question || ' ' || answer) ~* 'orbit'
UNION ALL
SELECT 'announcements', title FROM announcements
WHERE (title || ' ' || coalesce(body, '')) ~* 'orbit';

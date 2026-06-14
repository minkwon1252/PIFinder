-- =============================================================================
-- PIFinder — seed data
-- Idempotent: uses ON CONFLICT so re-running is safe.
-- Run after migrations:  npm run db:seed   (or psql -f supabase/seed.sql)
-- =============================================================================

-- ---- Top 30 US engineering schools ----
insert into public.schools (name, short_name, admissions_url) values
  ('Massachusetts Institute of Technology', 'MIT', 'https://gradadmissions.mit.edu/'),
  ('Stanford University', 'Stanford', 'https://gradadmissions.stanford.edu/'),
  ('University of California, Berkeley', 'UC Berkeley', 'https://grad.berkeley.edu/'),
  ('California Institute of Technology', 'Caltech', 'https://www.gradoffice.caltech.edu/'),
  ('Georgia Institute of Technology', 'Georgia Tech', 'https://grad.gatech.edu/'),
  ('Carnegie Mellon University', 'CMU', 'https://www.cmu.edu/graduate/'),
  ('University of Michigan—Ann Arbor', 'Michigan', 'https://rackham.umich.edu/'),
  ('University of Illinois Urbana-Champaign', 'UIUC', 'https://grad.illinois.edu/'),
  ('Purdue University', 'Purdue', 'https://www.purdue.edu/gradschool/'),
  ('Cornell University', 'Cornell', 'https://gradschool.cornell.edu/'),
  ('University of Texas at Austin', 'UT Austin', 'https://gradschool.utexas.edu/'),
  ('Princeton University', 'Princeton', 'https://gradschool.princeton.edu/'),
  ('Columbia University', 'Columbia', 'https://www.gsas.columbia.edu/'),
  ('University of California, Los Angeles', 'UCLA', 'https://grad.ucla.edu/'),
  ('Johns Hopkins University', 'JHU', 'https://engineering.jhu.edu/graduate-studies/'),
  ('University of California, San Diego', 'UCSD', 'https://grad.ucsd.edu/'),
  ('University of Washington', 'UW', 'https://grad.uw.edu/'),
  ('University of Pennsylvania', 'Penn', 'https://www.upenn.edu/admissions/graduate'),
  ('Northwestern University', 'Northwestern', 'https://www.tgs.northwestern.edu/'),
  ('Duke University', 'Duke', 'https://gradschool.duke.edu/'),
  ('Virginia Tech', 'Virginia Tech', 'https://graduateschool.vt.edu/'),
  ('Texas A&M University—College Station', 'Texas A&M', 'https://grad.tamu.edu/'),
  ('Harvard University', 'Harvard', 'https://gsas.harvard.edu/'),
  ('University of Wisconsin—Madison', 'Wisconsin', 'https://grad.wisc.edu/'),
  ('University of Southern California', 'USC', 'https://gradadm.usc.edu/'),
  ('Rice University', 'Rice', 'https://graduate.rice.edu/'),
  ('University of California, Santa Barbara', 'UCSB', 'https://www.graddiv.ucsb.edu/'),
  ('Ohio State University', 'Ohio State', 'https://gradsch.osu.edu/'),
  ('University of Maryland—College Park', 'Maryland', 'https://gradschool.umd.edu/'),
  ('Penn State University—University Park', 'Penn State', 'https://gradschool.psu.edu/')
on conflict (name) do nothing;

-- ---- Departments (engineering + relevant science) ----
insert into public.departments (name, abbrev, field) values
  ('Materials Science and Engineering', 'MSE', 'engineering'),
  ('Electrical Engineering', 'EE', 'engineering'),
  ('Mechanical Engineering', 'ME', 'engineering'),
  ('Chemical Engineering', 'ChemE', 'engineering'),
  ('Biomedical Engineering', 'BME', 'engineering'),
  ('Nuclear Engineering', 'NucE', 'engineering'),
  ('Computer Science', 'CS', 'engineering'),
  ('Applied Physics', 'AP', 'science'),
  ('Physics', 'PHYS', 'science'),
  ('Chemistry', 'CHEM', 'science'),
  ('Mathematics', 'MATH', 'science'),
  ('Aerospace Engineering', 'AeroE', 'engineering'),
  ('Civil and Environmental Engineering', 'CEE', 'engineering'),
  ('Industrial and Systems Engineering', 'ISE', 'engineering')
on conflict (name) do nothing;

-- ---- Screening questions (Akinator-style discriminators) ----
insert into public.screening_questions (key, prompt, options, weight_hint) values
  ('research_style', 'Do you prefer experimental, computational, theoretical, or mixed research?',
    '["experimental","computational","theoretical","mixed"]', '{"factor":"method_fit"}'),
  ('focus_area', 'Do you prefer device, material, process, characterization, simulation, or theory?',
    '["device","material","process","characterization","simulation","theory"]', '{"factor":"application_domain_fit"}'),
  ('pi_seniority', 'Do you prefer a senior famous PI, a mid-career PI, or a rising assistant professor?',
    '["senior","mid_career","rising"]', '{"factor":"mentorship_proxy"}'),
  ('lab_size', 'Do you prefer a large lab or a small lab?',
    '["large","small"]', '{"factor":"mentorship_proxy"}'),
  ('industry', 'Do you want a strong industry connection?',
    '["yes","no","neutral"]', '{"factor":"application_domain_fit"}'),
  ('pivot', 'Do you want work close to your previous project, or a pivot into something new?',
    '["close","pivot","either"]', '{"factor":"project_overlap"}')
on conflict (key) do nothing;

-- ---- TOEFL practice sets (ENG Trainer MVP) ----
-- ENG Trainer content. Idempotent via NOT EXISTS (no unique constraint on title).
-- 'writing' = TOEFL-style prompts; 'typing' = academic passages for the typing test.
insert into public.toefl_practice_sets (title, prompt, kind, time_limit_seconds)
select v.title, v.prompt, v.kind, v.tl
from (values
  ('Independent Writing — Technology',
   'Do you agree or disagree: Modern technology has made students less creative? Use specific reasons and examples.', 'writing', 1800),
  ('Independent Writing — Graduate Study',
   'Some students prefer to work for a few years before graduate school; others apply immediately. Which do you prefer and why?', 'writing', 1800),
  ('Independent Writing — Collaboration',
   'Do you agree or disagree: scientific progress depends more on collaboration than on individual genius? Use specific reasons and examples.', 'writing', 1800),
  ('Independent Writing — Funding',
   'Some argue governments should fund basic research with no obvious application; others prefer applied research. Which do you support and why?', 'writing', 1800),
  ('Independent Writing — Online Learning',
   'Do you agree or disagree: online courses are as effective as in-person classes for graduate study? Support your view with examples.', 'writing', 1800),
  ('Independent Writing — Specialization',
   'Is it better for a researcher to specialize deeply in one area or to work across several fields? Explain your reasoning with examples.', 'writing', 1800),
  ('Typing — Literature Review',
   'A literature review situates your research within the existing body of knowledge, identifying the gaps that your work will address and clarifying the questions that remain unanswered.', 'typing', null),
  ('Typing — Reproducibility',
   'Reproducibility is a cornerstone of the scientific method; carefully documenting your methods allows other researchers to verify, challenge, and build upon your results.', 'typing', null),
  ('Typing — Statement of Purpose',
   'When writing a statement of purpose, connect your previous projects to the specific research a prospective advisor pursues, showing why their laboratory is the right place for your goals.', 'typing', null),
  ('Typing — Peer Review',
   'Peer review subjects a manuscript to the scrutiny of independent experts, improving its clarity, validity, and significance before it reaches the wider scientific community.', 'typing', null),
  ('Typing — Experimental Design',
   'Strong experimental design controls for confounding variables, ensuring that observed effects can be attributed to the factors under investigation rather than to chance.', 'typing', null),
  ('Typing — Resilience',
   'Graduate study demands not only technical skill but also resilience, because meaningful research often advances through repeated failure before a genuine insight finally emerges.', 'typing', null),
  ('Typing — Figures',
   'Clear figures communicate complex results at a glance; a well-labeled axis and an informative caption often persuade a reader more effectively than several paragraphs of dense text.', 'typing', null),
  ('Typing — Interdisciplinary',
   'Effective collaboration across disciplines requires a shared vocabulary, mutual respect for different methods, and the patience to translate ideas between distinct research traditions.', 'typing', null)
) as v(title, prompt, kind, tl)
where not exists (select 1 from public.toefl_practice_sets t where t.title = v.title);

-- =============================================================================
-- Department faculty-roster URLs (consumed by the official-page adapter, Phase 3).
-- Real professor data is NOT seeded here — it is populated from a real source via
-- scripts/seed-professors-openalex.mjs (provenance-backed). The previous synthetic
-- [SAMPLE] professors were removed once real data landed.
-- =============================================================================
do $$
declare
  mit_id uuid;
  berk_id uuid;
  mse_id uuid;
  ee_id uuid;
begin
  select id into mit_id from public.schools where short_name = 'MIT';
  select id into berk_id from public.schools where short_name = 'UC Berkeley';
  select id into mse_id from public.departments where abbrev = 'MSE';
  select id into ee_id from public.departments where abbrev = 'EE';

  insert into public.school_departments (school_id, department_id, faculty_url)
  values
    (mit_id, mse_id, 'https://dmse.mit.edu/people/'),
    (mit_id, ee_id, 'https://www.eecs.mit.edu/people/'),
    (berk_id, mse_id, 'https://mse.berkeley.edu/people/')
  on conflict do nothing;
end $$;

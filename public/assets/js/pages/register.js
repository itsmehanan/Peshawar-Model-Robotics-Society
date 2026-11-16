/**
 * Registration.
 *
 * Fixes the original "Join Team" failure by making the flow explicit:
 *   1. the field selector drives the team list (never the other way round)
 *   2. the team list is fetched from the server for that school + field,
 *      including each team's real seat count
 *   3. the passcode is verified server-side inside a transaction that re-counts
 *      seats, so a team can never be overfilled by two simultaneous joins
 */
import { get, post, ApiError, storeToken } from '../api.js';
import { state, setStudent, refreshContent } from '../store.js';
import { esc, onSubmit, toast, applyFieldErrors, setBusy } from '../ui.js';

export function registerPage({ query }) {
  const { registration, categories, event } = state.content;

  if (state.student) return alreadyRegistered(state.student);
  if (registration.open === false) return closedNotice(registration);

  const preselected = query.get('field') || '';
  const sizes = registration.allowedSizes?.length ? registration.allowedSizes : [2, 3, 4, 5, 6];
  const defaultSize = registration.maxMembers || 4;

  return `<div class="view">
    <section class="page-hero">
      <div class="wrap page-hero__inner">
        <div>
          <span class="eyebrow eyebrow--accent">Entries ${registration.open === false ? 'closed' : 'open'}</span>
          <h1 class="display display--sm mt-2">Register for<br><em>${esc(event.kicker || 'the olympiad')}.</em></h1>
          <p class="lede">One account per student. One field per team. Everything below can be edited later from
          your dashboard — nothing you type here is locked in.</p>
        </div>
        <div class="page-hero__aside">
          <p class="tiny muted">Registration closes</p>
          <p class="h4 mt-0">${esc(registration.deadlineLabel || 'see programme')}</p>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap reg-layout">
        <form class="sheet" id="registerForm" novalidate>
          <div class="steps-bar">
            <span class="steps-bar__item is-current" data-step="1"><span class="steps-bar__num">1</span><span class="steps-bar__label">Student</span></span>
            <span class="steps-bar__line"></span>
            <span class="steps-bar__item" data-step="2"><span class="steps-bar__num">2</span><span class="steps-bar__label">Team</span></span>
            <span class="steps-bar__line"></span>
            <span class="steps-bar__item" data-step="3"><span class="steps-bar__num">3</span><span class="steps-bar__label">Confirm</span></span>
          </div>

          <div class="sheet__head">
            <div>
              <span class="sheet__step">Section 01</span>
              <h2 class="sheet__title">Your student details</h2>
            </div>
          </div>

          <div class="form">
            <div class="form-row">
              <div class="field">
                <label for="reg-name">Full name</label>
                <input class="input" id="reg-name" name="name" autocomplete="name" required maxlength="90" placeholder="As it should appear on your certificate">
                <span class="field__error"></span>
              </div>
              <div class="field">
                <label for="reg-class">Class / grade</label>
                <input class="input" id="reg-class" name="className" required maxlength="40" placeholder="e.g. Grade 9-B">
                <span class="field__error"></span>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="reg-school">School</label>
                <input class="input" id="reg-school" name="school" required maxlength="120" list="schoolList" placeholder="Start typing your school">
                <datalist id="schoolList"></datalist>
                <span class="field__hint">Teams can only be formed within one school.</span>
                <span class="field__error"></span>
              </div>
              <div class="field">
                <label for="reg-project">Project title <span class="label__opt">optional</span></label>
                <input class="input" id="reg-project" name="projectTitle" maxlength="120" placeholder="Working title is fine">
                <span class="field__hint">You can add or change this later.</span>
                <span class="field__error"></span>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="reg-email">Email</label>
                <input class="input" id="reg-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
                <span class="field__hint">Used to sign in from any device.</span>
                <span class="field__error"></span>
              </div>
              <div class="field">
                <label for="reg-phone">Phone <span class="label__opt">optional</span></label>
                <input class="input" id="reg-phone" name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="+92 3xx xxx xxxx">
                <span class="field__error"></span>
              </div>
            </div>
            <div class="field">
              <label for="reg-password">Password</label>
              <input class="input" id="reg-password" name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters, one letter, one number">
              <span class="field__hint">Stored as a scrypt hash on the server — never in the browser.</span>
              <span class="field__error"></span>
            </div>
          </div>

          <div class="sheet__head" style="margin-top:2rem">
            <div>
              <span class="sheet__step">Section 02</span>
              <h2 class="sheet__title">Field of entry</h2>
            </div>
          </div>
          <div class="field">
            <label for="reg-category">Choose one field</label>
            <select class="select" id="reg-category" name="categoryId" required>
              <option value="">Select a field…</option>
              ${categories
                .map(
                  (c) =>
                    `<option value="${esc(c.id)}" ${preselected === c.id ? 'selected' : ''}>${esc(c.name)} — ${esc(c.summary)}</option>`,
                )
                .join('')}
            </select>
            <span class="field__hint">Your team will exhibit in this field. Judges are assigned per field.</span>
            <span class="field__error"></span>
          </div>

          <div class="sheet__head" style="margin-top:2rem">
            <div>
              <span class="sheet__step">Section 03</span>
              <h2 class="sheet__title">Team</h2>
            </div>
          </div>

          <div class="choice-grid" role="radiogroup" aria-label="Team participation">
            <label class="choice">
              <input type="radio" name="teamMode" value="create" checked>
              <span class="choice__title">Create a team</span>
              <span class="choice__desc">You become the leader and set the passcode.</span>
            </label>
            <label class="choice">
              <input type="radio" name="teamMode" value="join">
              <span class="choice__title">Join a team</span>
              <span class="choice__desc">Use the passcode your leader shared.</span>
            </label>
            <label class="choice">
              <input type="radio" name="teamMode" value="none">
              <span class="choice__title">Decide later</span>
              <span class="choice__desc">Register first, sort your team from the dashboard.</span>
            </label>
          </div>

          <div id="createFields" class="form mt-2">
            <div class="form-row">
              <div class="field">
                <label for="reg-teamname">Team name</label>
                <input class="input" id="reg-teamname" name="teamName" maxlength="60" placeholder="e.g. Circuit Breakers">
                <span class="field__hint">Unique within your school.</span>
                <span class="field__error"></span>
              </div>
              <div class="field">
                <label for="reg-teamcode">Team passcode</label>
                <input class="input" id="reg-teamcode" name="teamCode" maxlength="40" minlength="6" placeholder="At least 6 characters">
                <span class="field__hint">Share this with teammates — they need it to join.</span>
                <span class="field__error"></span>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="reg-max">Maximum team size</label>
                <select class="select" id="reg-max" name="maxMembers">
                  ${sizes
                    .map((n) => `<option value="${n}" ${n === defaultSize ? 'selected' : ''}>${n} members${n === defaultSize ? ' (recommended)' : ''}</option>`)
                    .join('')}
                </select>
                <span class="field__hint">Includes you. You can adjust it later if places remain.</span>
                <span class="field__error"></span>
              </div>
            </div>
          </div>

          <div id="joinFields" class="form mt-2" hidden>
            <div class="field">
              <label for="join-search">Find your team</label>
              <div class="row" style="gap:.5rem">
                <input class="input" id="join-search" placeholder="Filter by team or school" style="flex:1">
                <button class="btn btn--ghost btn--sm" type="button" id="join-refresh">Refresh</button>
              </div>
              <span class="field__hint" id="join-status">Teams appear once you choose a school and field above.</span>
            </div>
            <div id="teamList" class="stack stack--sm"></div>
            <div class="field">
              <label for="reg-joincode">Team passcode</label>
              <input class="input" id="reg-joincode" name="joinCode" maxlength="40" placeholder="The code your team leader shared">
              <span class="field__error"></span>
            </div>
            <input type="hidden" name="joinTeamId" id="joinTeamId">
          </div>

          <div class="form-note mt-2">
            By registering you agree to be listed as an exhibitor under your team name and school. Your email and
            phone number are only visible to the organisers — never to other students.
          </div>

          <div class="form-actions">
            <button class="btn btn--solid btn--lg" type="submit">
              Complete registration <span class="btn__arrow" aria-hidden="true">↗</span>
            </button>
            <span class="tiny muted">Fields marked optional can be filled later.</span>
          </div>
        </form>

        <aside class="stack">
          <div class="aside-card">
            <h3>Before you start</h3>
            <ul>
              <li>Use your real name — certificates are printed from it.</li>
              <li>One account per student; duplicate emails are rejected by the server.</li>
              <li>A team is ${registration.minMembers || 2}–${registration.maxMembers || 4} students from one school in one field.</li>
              <li>Leaders keep the passcode private: it is checked on every join.</li>
            </ul>
            <div class="mt-2">
              <div class="aside-card__stat"><span>Registration</span><b>${registration.open === false ? 'Closed' : 'Open'}</b></div>
              <div class="aside-card__stat"><span>Team fields</span><b>${categories.length}</b></div>
              <div class="aside-card__stat"><span>Cost</span><b>Free</b></div>
            </div>
            <p class="tiny muted mt-2">Already registered? <a class="underline" href="#/login" data-link>Sign in</a> to see your dashboard.</p>
          </div>
        </aside>
      </div>
    </section>
  </div>`;
}

function closedNotice(registration) {
  return `<div class="view"><section class="section">
    <div class="wrap wrap--narrow center">
      <span class="eyebrow eyebrow--plain">Registration</span>
      <h1 class="display display--sm mt-2">${esc(registration.closedTitle || 'Registration is closed.')}</h1>
      <p class="lede mt-2" style="margin-inline:auto">${esc(registration.closedMessage || '')}</p>
      <div class="row mt-3" style="justify-content:center">
        <a class="btn btn--solid" href="#/contact" data-link>Contact the organisers</a>
        <a class="btn btn--ghost" href="#/about" data-link>About the event</a>
      </div>
      <p class="small muted mt-2">Already registered? <a class="underline" href="#/login" data-link>Sign in instead</a>.</p>
    </div>
  </section></div>`;
}

function alreadyRegistered(student) {
  return `<div class="view"><section class="section">
    <div class="wrap wrap--narrow">
      <span class="eyebrow eyebrow--plain">You are already on the list</span>
      <h1 class="display display--sm mt-2">Hello again, ${esc(student.name.split(' ')[0])}.</h1>
      <p class="lede mt-2">Your registration is saved on our server, so you do not need to register again. Everything
      about your entry is editable from your dashboard.</p>
      <div class="kv mt-3">
        <div><dt>Field</dt><dd>${esc(student.category?.name || '—')}</dd></div>
        <div><dt>Team</dt><dd>${esc(student.team?.name || 'No team yet')}</dd></div>
        <div><dt>School</dt><dd>${esc(student.school)}</dd></div>
        <div><dt>Status</dt><dd>Registered</dd></div>
      </div>
      <div class="row mt-3">
        <a class="btn btn--solid" href="#/dashboard" data-link>Open my dashboard</a>
        <a class="btn btn--ghost" href="#/fields" data-link>Browse fields</a>
      </div>
    </div>
  </section></div>`;
}

/* ------------------------------------------------------------------ mount */
export async function mountRegister(root, { navigate }) {
  const form = root.querySelector('#registerForm');
  if (!form) return;

  const createFields = form.querySelector('#createFields');
  const joinFields = form.querySelector('#joinFields');
  const stepItems = root.querySelectorAll('.steps-bar__item');
  const teamList = form.querySelector('#teamList');
  const joinStatus = form.querySelector('#join-status');
  const joinSearch = form.querySelector('#join-search');
  const joinTeamId = form.querySelector('#joinTeamId');
  let currentTeams = [];

  const setStep = (n) => {
    stepItems.forEach((item) => {
      const step = Number(item.dataset.step);
      item.classList.toggle('is-current', step === n);
      item.classList.toggle('is-done', step < n);
    });
  };

  const mode = () => form.querySelector('input[name="teamMode"]:checked')?.value || 'create';

  function syncMode() {
    const m = mode();
    createFields.hidden = m !== 'create';
    joinFields.hidden = m !== 'join';
    form.elements.teamName?.toggleAttribute('required', m === 'create');
    form.elements.teamCode?.toggleAttribute('required', m === 'create');
    form.elements.joinCode?.toggleAttribute('required', m === 'join');
    if (m === 'join') {
      setStep(2);
      loadTeams();
    } else {
      setStep(1);
    }
  }

  form.querySelectorAll('input[name="teamMode"]').forEach((input) => input.addEventListener('change', syncMode));

  async function loadTeams() {
    const school = (form.elements.school.value || '').trim();
    const categoryId = form.elements.categoryId.value;
    joinTeamId.value = '';
    if (!school || !categoryId) {
      joinStatus.textContent = 'Enter your school and choose a field to see open teams.';
      teamList.innerHTML = '';
      currentTeams = [];
      return;
    }
    joinStatus.textContent = 'Looking for teams…';
    setBusy(form.querySelector('#join-refresh'), true);
    try {
      const { teams } = await get(
        `/teams?school=${encodeURIComponent(school)}&category=${encodeURIComponent(categoryId)}`,
      );
      currentTeams = teams;
      renderTeams();
    } catch (error) {
      joinStatus.textContent = error.message;
    } finally {
      setBusy(form.querySelector('#join-refresh'), false);
    }
  }

  function renderTeams() {
    const filter = (joinSearch.value || '').toLowerCase();
    const visible = currentTeams.filter((t) => t.name.toLowerCase().includes(filter));
    if (!currentTeams.length) {
      joinStatus.textContent = 'No teams registered yet for this school and field. Create one instead.';
      teamList.innerHTML = '';
      return;
    }
    joinStatus.textContent = `${currentTeams.length} team${currentTeams.length === 1 ? '' : 's'} found — pick one to join.`;
    if (!visible.length) {
      teamList.innerHTML = '<p class="small muted">No team matches that filter.</p>';
      return;
    }
    teamList.innerHTML = visible
      .map((team) => {
        const full = team.seatsLeft <= 0;
        const selected = joinTeamId.value === team.id;
        return `<label class="choice" style="${full ? 'opacity:.55;pointer-events:none' : ''}">
          <input type="radio" name="teamPick" value="${esc(team.id)}" ${selected ? 'checked' : ''} ${full ? 'disabled' : ''}>
          <span class="choice__title">${esc(team.name)} ${full ? '<span class="tiny muted">· full</span>' : ''}</span>
          <span class="choice__desc">
            ${esc(team.school)} · ${esc(team.categoryId)} · ${team.memberCount}/${team.maxMembers} seats used
          </span>
        </label>`;
      })
      .join('');
    teamList.querySelectorAll('input[name="teamPick"]').forEach((input) => {
      input.addEventListener('change', () => {
        joinTeamId.value = input.value;
        form.querySelector('#reg-joincode')?.focus();
      });
    });
  }

  form.querySelector('#join-refresh')?.addEventListener('click', loadTeams);
  joinSearch?.addEventListener('input', renderTeams);
  form.elements.school?.addEventListener('change', () => {
    if (mode() === 'join') loadTeams();
    loadSchools();
  });
  form.elements.categoryId?.addEventListener('change', () => {
    if (mode() === 'join') loadTeams();
  });

  // Existing schools as suggestions only — the value is free text.
  async function loadSchools() {
    const list = form.querySelector('#schoolList');
    if (!list || list.children.length) return;
    try {
      const { teams } = await get('/teams');
      const schools = [...new Set(teams.map((t) => t.school))].slice(0, 40);
      list.innerHTML = schools.map((s) => `<option value="${esc(s)}"></option>`).join('');
    } catch {
      /* suggestions are a nicety */
    }
  }
  loadSchools();

  onSubmit(form, async (data) => {
    const modeValue = mode();
    const payload = {
      name: data.get('name'),
      className: data.get('className'),
      school: data.get('school'),
      email: data.get('email'),
      phone: data.get('phone'),
      password: data.get('password'),
      categoryId: data.get('categoryId'),
      projectTitle: data.get('projectTitle'),
      teamMode: modeValue,
    };
    if (modeValue === 'create') {
      payload.teamName = data.get('teamName');
      payload.teamCode = data.get('teamCode');
      payload.maxMembers = Number(data.get('maxMembers'));
    }
    if (modeValue === 'join') {
      payload.joinTeamId = data.get('joinTeamId');
      payload.joinCode = data.get('joinCode');
      if (!payload.joinTeamId) {
        applyFieldErrors(form, { joinTeamId: 'required' });
        joinStatus.textContent = 'Pick a team from the list first.';
        toast('Choose the team you want to join.', 'error');
        return;
      }
    }

    const result = await post('/register', payload);
    storeToken('student', result.sessionToken);
    setStudent(result.student);
    await refreshContent().catch(() => {});
    toast('Registration saved. Welcome to the exhibition.', 'ok');
    navigate('#/welcome');
  });
}

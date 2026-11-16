/**
 * Student dashboard: profile, entry, team ownership, category changes.
 *
 * All mutations go through the API and then re-render from the server response,
 * so what you see is always what is stored. The old prototype mutated the DOM
 * and a localStorage blob separately, which is how it drifted out of sync.
 */
import { post, patch, del, get } from '../api.js';
import { state, setStudent } from '../store.js';
import { esc, onSubmit, toast, modal, confirmDialog, initials, formatDate, mountReveal } from '../ui.js';

export function dashboardPage({ section = 'overview' }) {
  const student = state.student;
  if (!student) return signInPrompt();

  const nav = [
    ['overview', 'Overview'],
    ['profile', 'Profile'],
    ['team', 'Team'],
    ['field', 'Field of entry'],
    ['account', 'Account & security'],
  ];

  return `<div class="view">
    <section class="page-hero" style="padding-block:clamp(1.8rem,3.5vw,2.8rem)">
      <div class="wrap">
        <div class="row row--between" style="align-items:flex-end">
          <div>
            <span class="eyebrow eyebrow--accent">Student dashboard</span>
            <h1 class="display display--sm mt-1" style="font-size:clamp(1.9rem,3.6vw,2.9rem)">
              ${esc(student.name)}
            </h1>
            <p class="small ink2 mt-1">
              ${esc(student.className)} · ${esc(student.school)}
              <span aria-hidden="true"> · </span>
              <span class="mono tiny">Ref ${esc(student.id.slice(0, 8).toUpperCase())}</span>
            </p>
          </div>
          <div class="row">
            <span class="status-chip ${student.status === 'confirmed' ? 'status-chip--ok' : student.status === 'withdrawn' ? 'status-chip--danger' : 'status-chip--wait'}">
              ${student.status === 'confirmed' ? 'Registered' : esc(student.status)}
            </span>
            <button class="btn btn--ghost btn--sm" data-action="logout">Sign out</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap dash">
        <nav class="dash-nav" aria-label="Dashboard sections">
          <p class="dash-nav__head">Your entry</p>
          <div class="dash-nav__list">
            ${nav
              .map(
                ([key, label]) =>
                  `<a class="dash-nav__link ${section === key ? 'is-active' : ''}" href="#/dashboard/${key}" data-link>${label}</a>`,
              )
              .join('')}
          </div>
          <p class="dash-nav__head" style="margin-top:1rem">Quick links</p>
          <div class="dash-nav__list">
            <a class="dash-nav__link" href="#/fields/${esc(student.categoryId)}" data-link>Field brief</a>
            <a class="dash-nav__link" href="#/journal" data-link>Journal</a>
          </div>
        </nav>

        <div id="dashBody">
          ${renderSection(section, student)}
        </div>
      </div>
    </section>
  </div>`;
}

function signInPrompt() {
  return `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
    <span class="eyebrow eyebrow--plain">Dashboard</span>
    <h1 class="display display--sm mt-2">Sign in to see your entry.</h1>
    <p class="lede mt-2" style="margin-inline:auto">Your registration is tied to your account, not to this browser.</p>
    <div class="row mt-3" style="justify-content:center">
      <a class="btn btn--solid" href="#/login" data-link>Sign in</a>
      <a class="btn btn--ghost" href="#/register" data-link>Register</a>
    </div>
  </div></section></div>`;
}

/* ------------------------------------------------------------------ views */
function renderSection(section, student) {
  switch (section) {
    case 'profile':
      return profileView(student);
    case 'team':
      return teamView(student);
    case 'field':
      return fieldView(student);
    case 'account':
      return accountView(student);
    default:
      return overviewView(student);
  }
}

function overviewView(student) {
  const team = student.team;
  const isLeader = team && team.leaderId === student.id;
  const checklist = [
    { done: true, label: 'Account created', detail: 'Signed in with your email' },
    { done: Boolean(student.projectTitle), label: 'Project title added', detail: student.projectTitle || 'Add a working title', action: 'profile' },
    { done: Boolean(team), label: 'Team formed', detail: team ? `${team.name} · ${team.memberCount}/${team.maxMembers}` : 'Create or join a team', action: 'team' },
    { done: Boolean(team && team.memberCount >= 2), label: 'Teammates joined', detail: team ? (team.seatsLeft ? `${team.seatsLeft} place${team.seatsLeft === 1 ? '' : 's'} still open` : 'Team complete') : 'Needs a team first', action: 'team' },
  ];

  return `
    <div class="metrics">
      <div class="metric">
        <p class="metric__value">${esc(student.category?.name?.split(' ')[0] || '—')}</p>
        <span class="metric__label">Field of entry</span>
      </div>
      <div class="metric">
        <p class="metric__value">${team ? team.memberCount : 0}<span style="font-size:1rem;color:var(--muted)">/${team ? team.maxMembers : 0}</span></p>
        <span class="metric__label">Team places filled</span>
      </div>
      <div class="metric">
        <p class="metric__value">${team ? (isLeader ? 'Lead' : 'Member') : 'Solo'}</p>
        <span class="metric__label">Your role</span>
      </div>
      <div class="metric">
        <p class="metric__value" style="font-size:1.2rem">${formatDate(student.createdAt, { style: 'short' })}</p>
        <span class="metric__label">Registered on</span>
      </div>
    </div>

    ${student.pendingRequest ? pendingBanner(student.pendingRequest) : ''}

    <div class="split">
      <div class="panel">
        <div class="panel__head">
          <div>
            <h2 class="panel__title">Preparation checklist</h2>
            <p class="panel__sub">The four things that make a smooth exhibition day.</p>
          </div>
        </div>
        <ul class="stack stack--sm">
          ${checklist
            .map(
              (item) => `<li class="member" style="display:flex;gap:.7rem;align-items:flex-start;padding:.6rem 0">
                <span style="width:1.15rem;height:1.15rem;border-radius:50%;border:1px solid ${item.done ? 'var(--ok)' : 'var(--line-strong)'};
                  background:${item.done ? 'var(--ok)' : 'transparent'};color:#fff;display:grid;place-items:center;font-size:.62rem;flex-shrink:0;margin-top:.15rem">
                  ${item.done ? '✓' : ''}
                </span>
                <span style="flex:1">
                  <span class="h4" style="font-family:var(--sans);font-weight:600;font-size:.9rem">${esc(item.label)}</span>
                  <span class="small muted" style="display:block">${esc(item.detail)}</span>
                </span>
                ${item.action && !item.done ? `<a class="link-arrow small" href="#/dashboard/${item.action}" data-link>Fix</a>` : ''}
              </li>`,
            )
            .join('')}
        </ul>
      </div>

      <div class="panel">
        <div class="panel__head">
          <div>
            <h2 class="panel__title">Your team</h2>
            <p class="panel__sub">${team ? esc(team.name) : 'No team yet'}</p>
          </div>
          ${team ? `<a class="link-arrow small" href="#/dashboard/team" data-link>Manage</a>` : ''}
        </div>
        ${
          team
            ? `<div class="member-list">
                ${team.members
                  .map(
                    (m) => `<div class="member">
                      <span class="member__avatar">${esc(initials(m.name))}</span>
                      <span class="member__body">
                        <span class="member__name">${esc(m.name)} ${m.isLeader ? '<span class="member__tag">Lead</span>' : ''}</span>
                        <span class="member__meta">${esc(m.className || 'Student')}</span>
                      </span>
                    </div>`,
                  )
                  .join('')}
              </div>
              <div class="seats mt-2" aria-label="${team.memberCount} of ${team.maxMembers} places filled">
                ${Array.from({ length: team.maxMembers })
                  .map((_, i) => `<span class="seat ${i < team.memberCount ? 'is-taken' : ''}"></span>`)
                  .join('')}
              </div>
              <p class="tiny muted mt-1">${team.seatsLeft > 0 ? `${team.seatsLeft} place${team.seatsLeft === 1 ? '' : 's'} open — share your passcode.` : 'Team is complete.'}</p>`
            : `<p class="small ink2">Create a team to lead, or join one with a passcode.</p>
               <a class="btn btn--solid btn--sm mt-2" href="#/dashboard/team" data-link>Sort out my team</a>`
        }
      </div>
    </div>

    <div class="panel mt-2">
      <div class="panel__head">
        <div>
          <h2 class="panel__title">Your entry at a glance</h2>
          <p class="panel__sub">These details appear on the exhibitor list.</p>
        </div>
        <a class="link-arrow small" href="#/dashboard/profile" data-link>Edit profile</a>
      </div>
      <dl class="kv">
        <div><dt>Full name</dt><dd>${esc(student.name)}</dd></div>
        <div><dt>Class</dt><dd>${esc(student.className)}</dd></div>
        <div><dt>School</dt><dd>${esc(student.school)}</dd></div>
        <div><dt>Field</dt><dd>${esc(student.category?.name || '—')}</dd></div>
        <div><dt>Project title</dt><dd>${esc(student.projectTitle || 'Not added yet')}</dd></div>
        <div><dt>Team</dt><dd>${esc(team?.name || 'Solo')}</dd></div>
      </dl>
    </div>`;
}

function pendingBanner(request) {
  const categories = state.content?.categories || [];
  const from = categories.find((c) => c.id === request.fromCategory)?.name || request.fromCategory;
  const to = categories.find((c) => c.id === request.toCategory)?.name || request.toCategory;
  return `<div class="callout callout--accent mb-2">
    <span class="callout__icon" aria-hidden="true">⌛</span>
    <div style="flex:1">
      <b>Field change awaiting review.</b> ${esc(from)} → ${esc(to)}.
      <span class="small muted">Submitted ${formatDate(request.createdAt, { style: 'short' })}.</span>
      <button class="btn btn--quiet btn--sm" data-action="cancel-request" data-id="${esc(request.id)}" style="margin-left:.3rem">Withdraw request</button>
    </div>
  </div>`;
}

function profileView(student) {
  return `
    <div class="panel">
      <div class="panel__head">
        <div>
          <h2 class="panel__title">Profile</h2>
          <p class="panel__sub">Editable at any time. School changes are blocked while you are on a team.</p>
        </div>
        <span class="status-chip status-chip--ok">Saved to server</span>
      </div>
      <form class="form" id="profileForm" novalidate>
        <div class="form-row">
          <div class="field">
            <label for="p-name">Full name</label>
            <input class="input" id="p-name" name="name" value="${esc(student.name)}" required maxlength="90">
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="p-class">Class / grade</label>
            <input class="input" id="p-class" name="className" value="${esc(student.className)}" required maxlength="40">
            <span class="field__error"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="p-school">School</label>
            <input class="input" id="p-school" name="school" value="${esc(student.school)}" required maxlength="120">
            ${student.team ? `<span class="field__hint">Locked while you are on ${esc(student.team.name)}. Leave the team to change school.</span>` : ''}
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="p-phone">Phone <span class="label__opt">optional</span></label>
            <input class="input" id="p-phone" name="phone" value="${esc(student.phone || '')}" maxlength="24">
            <span class="field__error"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="p-email">Email</label>
            <input class="input" id="p-email" name="email" type="email" value="${esc(student.email)}" required>
            <span class="field__hint">This is your sign-in name.</span>
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="p-project">Project title <span class="label__opt">optional</span></label>
            <input class="input" id="p-project" name="projectTitle" value="${esc(student.projectTitle || '')}" maxlength="120">
            <span class="field__error"></span>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn--solid" type="submit">Save profile</button>
          <span class="tiny muted">Changes apply immediately everywhere on the site.</span>
        </div>
      </form>
    </div>`;
}

function teamView(student) {
  const team = student.team;
  if (!team) return noTeamView(student);

  const isLeader = team.leaderId === student.id;
  const canRemove = isLeader;

  return `
    <div class="panel">
      <div class="panel__head">
        <div>
          <h2 class="panel__title">${esc(team.name)}</h2>
          <p class="panel__sub">
            ${esc(team.school)} · ${esc(team.category?.name || '')} ·
            ${team.memberCount} of ${team.maxMembers} places filled
          </p>
        </div>
        <span class="status-chip ${team.isFull ? 'status-chip--ok' : 'status-chip--wait'}">
          ${team.isFull ? 'Team complete' : `${team.seatsLeft} place${team.seatsLeft === 1 ? '' : 's'} open`}
        </span>
      </div>

      <div class="member-list">
        ${team.members
          .map(
            (m) => `<div class="member">
              <span class="member__avatar">${esc(initials(m.name))}</span>
              <span class="member__body">
                <span class="member__name">${esc(m.name)} ${m.isLeader ? '<span class="member__tag">Lead</span>' : ''} ${m.id === student.id ? '<span class="tiny muted">(you)</span>' : ''}</span>
                <span class="member__meta">${esc(m.className || 'Student')}${isLeader && m.email ? ` · ${esc(m.email)}` : ''}</span>
              </span>
              ${
                canRemove && m.id !== student.id
                  ? `<span class="member__actions">
                      <button class="btn btn--quiet btn--sm" data-action="transfer" data-id="${esc(m.id)}" data-name="${esc(m.name)}">Make lead</button>
                      <button class="btn btn--quiet btn--sm" data-action="remove" data-id="${esc(m.id)}" data-name="${esc(m.name)}">Remove</button>
                    </span>`
                  : ''
              }
            </div>`,
          )
          .join('')}
        ${Array.from({ length: team.seatsLeft })
          .map(
            () => `<div class="member" style="opacity:.6">
              <span class="member__avatar" style="border:1px dashed var(--line-strong);background:transparent">+</span>
              <span class="member__body"><span class="member__meta">Open place — share your passcode</span></span>
            </div>`,
          )
          .join('')}
      </div>
    </div>

    ${
      isLeader
        ? `<div class="panel">
            <div class="panel__head">
              <div>
                <h2 class="panel__title">Team settings</h2>
                <p class="panel__sub">Only you, as the team leader, can change these.</p>
              </div>
            </div>
            <form class="form" id="teamForm" novalidate>
              <div class="form-row">
                <div class="field">
                  <label for="t-name">Team name</label>
                  <input class="input" id="t-name" name="name" value="${esc(team.name)}" required maxlength="60">
                  <span class="field__error"></span>
                </div>
                <div class="field">
                  <label for="t-max">Maximum members</label>
                  <select class="select" id="t-max" name="maxMembers">
                    ${(state.content?.registration?.allowedSizes || [2, 3, 4, 5, 6])
                      .map((n) => `<option value="${n}" ${n === team.maxMembers ? 'selected' : ''}>${n} members${n === team.memberCount ? ' (current size)' : ''}</option>`)
                      .join('')}
                  </select>
                  <span class="field__hint">You cannot go below the ${team.memberCount} members already joined.</span>
                  <span class="field__error"></span>
                </div>
              </div>
              <div class="field">
                <label for="t-pass">New join passcode <span class="label__opt">leave blank to keep current</span></label>
                <input class="input" id="t-pass" name="passcode" minlength="6" maxlength="40" placeholder="At least 6 characters">
                <span class="field__hint">Existing members stay on the team; new joiners need the new code.</span>
                <span class="field__error"></span>
              </div>
              <div class="form-actions">
                <button class="btn btn--solid" type="submit">Save team details</button>
              </div>
            </form>
          </div>

          <div class="panel">
            <div class="panel__head"><div><h2 class="panel__title">Danger zone</h2><p class="panel__sub">These actions affect everyone on the team.</p></div></div>
            <div class="row row--between" style="align-items:center;gap:1rem;flex-wrap:wrap">
              <p class="small ink2" style="max-width:44ch">
                ${team.memberCount > 1
                  ? 'Hand leadership to a teammate before leaving, or close the team entirely once work is finished.'
                  : 'You are the only member. Leaving will close this team.'}
              </p>
              <div class="row">
                ${team.memberCount > 1 ? '<button class="btn btn--ghost btn--sm" data-action="transfer-prompt">Transfer leadership</button>' : ''}
                <button class="btn btn--danger btn--sm" data-action="leave-team">${team.memberCount > 1 ? 'Leave team' : 'Close team'}</button>
              </div>
            </div>
          </div>`
        : `<div class="panel">
            <div class="panel__head"><div><h2 class="panel__title">Your membership</h2></div></div>
            <p class="small ink2">You are a member of <b>${esc(team.name)}</b>. Your team leader manages names, sizes and passcodes. If you need a change, ask them — or leave and join another team.</p>
            <div class="row mt-2">
              <a class="btn btn--ghost btn--sm" href="#/fields/${esc(team.categoryId)}" data-link>Read the field brief</a>
              <button class="btn btn--danger btn--sm" data-action="leave-team">Leave team</button>
            </div>
          </div>`
    }`;
}

function noTeamView(student) {
  const sizes = state.content?.registration?.allowedSizes || [2, 3, 4, 5, 6];
  return `
    <div class="panel">
      <div class="panel__head">
        <div><h2 class="panel__title">No team yet</h2><p class="panel__sub">You are registered as a solo entry in ${esc(student.category?.name || 'your field')}.</p></div>
      </div>
      <div class="split" style="gap:1.5rem">
        <form class="stack" id="createTeamForm" novalidate>
          <h3 class="h4" style="font-family:var(--serif);font-size:1.05rem">Create a team</h3>
          <div class="field">
            <label for="nt-name">Team name</label>
            <input class="input" id="nt-name" name="teamName" required maxlength="60" placeholder="e.g. Circuit Breakers">
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="nt-pass">Passcode</label>
            <input class="input" id="nt-pass" name="teamCode" required minlength="6" maxlength="40" placeholder="At least 6 characters">
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="nt-max">Maximum members</label>
            <select class="select" id="nt-max" name="maxMembers">
              ${sizes.map((n) => `<option value="${n}" ${n === (state.content?.registration?.maxMembers || 4) ? 'selected' : ''}>${n} members</option>`).join('')}
            </select>
          </div>
          <button class="btn btn--solid btn--sm" type="submit" style="width:max-content">Create team</button>
        </form>

        <form class="stack" id="joinTeamForm" novalidate>
          <h3 class="h4" style="font-family:var(--serif);font-size:1.05rem">Join a team</h3>
          <div class="field">
            <label for="jt-select">Available teams at ${esc(student.school)}</label>
            <select class="select" id="jt-select" name="teamId" required>
              <option value="">Loading teams…</option>
            </select>
            <span class="field__hint">Only teams in ${esc(student.category?.name || 'your field')} appear here.</span>
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="jt-code">Team passcode</label>
            <input class="input" id="jt-code" name="joinCode" required maxlength="40" placeholder="Ask your team leader">
            <span class="field__error"></span>
          </div>
          <button class="btn btn--ghost btn--sm" type="submit" style="width:max-content">Join team</button>
        </form>
      </div>
    </div>`;
}

function fieldView(student) {
  const categories = state.content?.categories || [];
  const mode = state.content?.registration?.categoryChangeMode || 'request';
  const onTeam = Boolean(student.team);
  const isLeader = student.team && student.team.leaderId === student.id;

  const explanation = student.pendingRequest
    ? 'Your request is with the organisers. You can withdraw it and choose a different field in the meantime.'
    : onTeam
      ? isLeader
        ? mode === 'open'
          ? 'As leader you can move the whole team instantly.'
          : 'Changing field sends a request to the organisers; approval moves your whole team, so every booth in that field stays consistent.'
        : 'Your team shares one field. Changing yours needs approval and will move the team, so speak to your leader first.'
      : 'You are not on a team, so your field changes immediately.';

  return `
    <div class="panel">
      <div class="panel__head">
        <div>
          <h2 class="panel__title">Field of entry</h2>
          <p class="panel__sub">Currently <b>${esc(student.category?.name || '—')}</b></p>
        </div>
        <a class="link-arrow small" href="#/fields/${esc(student.categoryId)}" data-link>Read the brief</a>
      </div>

      ${mode === 'locked' ? '<div class="callout mb-2"><span class="callout__icon">!</span><div>Field changes are closed for this season. Contact the coordination desk if you believe your entry is in the wrong field.</div></div>' : ''}

      <div class="callout mb-2"><span class="callout__icon" aria-hidden="true">i</span><div>${esc(explanation)}</div></div>

      ${student.pendingRequest ? pendingBanner(student.pendingRequest) : ''}

      ${
        mode === 'locked'
          ? ''
          : `<form class="form" id="fieldForm" novalidate>
              <div class="field">
                <label for="f-category">Request a different field</label>
                <select class="select" id="f-category" name="categoryId" required>
                  <option value="">Choose a field…</option>
                  ${categories
                    .filter((c) => c.id !== student.categoryId)
                    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)} — ${esc(c.summary)}</option>`)
                    .join('')}
                </select>
                <span class="field__error"></span>
              </div>
              ${onTeam ? `<div class="field">
                <label for="f-reason">Reason <span class="label__opt">optional, helps the organisers decide</span></label>
                <textarea class="textarea" id="f-reason" name="reason" maxlength="500" placeholder="e.g. our prototype is a sensor system rather than a robot"></textarea>
              </div>` : ''}
              <div class="form-actions">
                <button class="btn btn--solid" type="submit">${onTeam ? 'Send change request' : 'Change my field'}</button>
              </div>
            </form>`
      }
    </div>`;
}

function accountView(student) {
  return `
    <div class="panel">
      <div class="panel__head">
        <div><h2 class="panel__title">Sign-in details</h2><p class="panel__sub">Your account works on any device.</p></div>
      </div>
      <dl class="kv">
        <div><dt>Email</dt><dd>${esc(student.email)}</dd></div>
        <div><dt>Registered</dt><dd>${formatDate(student.createdAt)}</dd></div>
        <div><dt>Reference</dt><dd class="mono">${esc(student.id.slice(0, 8).toUpperCase())}</dd></div>
        <div><dt>Status</dt><dd>${esc(student.status)}</dd></div>
      </dl>
    </div>

    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Change password</h2><p class="panel__sub">Signs out every other device.</p></div></div>
      <form class="form" id="passwordForm" novalidate>
        <div class="form-row">
          <div class="field">
            <label for="pw-current">Current password</label>
            <input class="input" id="pw-current" name="currentPassword" type="password" autocomplete="current-password" required>
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="pw-new">New password</label>
            <input class="input" id="pw-new" name="newPassword" type="password" autocomplete="new-password" required minlength="8">
            <span class="field__hint">8+ characters with a letter and a number.</span>
            <span class="field__error"></span>
          </div>
        </div>
        <div class="form-actions"><button class="btn btn--solid" type="submit">Update password</button></div>
      </form>
    </div>

    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Session</h2></div></div>
      <p class="small ink2">Signing out removes this device's session cookie. Your registration stays on the server.</p>
      <button class="btn btn--ghost btn--sm mt-2" data-action="logout">Sign out of this device</button>
    </div>`;
}

/* ------------------------------------------------------------------ mount */
export function mountDashboard(root, { navigate, refresh }) {
  const student = state.student;
  if (!student) return;

  root.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await post('/logout');
      setStudent(null);
      toast('Signed out.', 'ok');
      navigate('#/');
    });
  });

  root.querySelector('[data-action="cancel-request"]')?.addEventListener('click', async (event) => {
    const { id } = event.currentTarget.dataset;
    try {
      const result = await del(`/student/category-request/${id}`);
      setStudent(result.student);
      toast('Request withdrawn.', 'ok');
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  /* ------------------------------------------------- profile */
  const profileForm = root.querySelector('#profileForm');
  if (profileForm) {
    onSubmit(profileForm, async (data) => {
      const result = await patch('/student/profile', {
        name: data.get('name'),
        className: data.get('className'),
        school: data.get('school'),
        phone: data.get('phone'),
        email: data.get('email'),
        projectTitle: data.get('projectTitle'),
      });
      setStudent(result.student);
      toast('Profile saved.', 'ok');
      await refresh();
    });
  }

  /* ------------------------------------------------- create team */
  const createTeamForm = root.querySelector('#createTeamForm');
  if (createTeamForm) {
    onSubmit(createTeamForm, async (data) => {
      const result = await post('/student/team', {
        mode: 'create',
        teamName: data.get('teamName'),
        teamCode: data.get('teamCode'),
        maxMembers: Number(data.get('maxMembers')),
      });
      setStudent(result.student);
      toast(result.message, 'ok');
      await refresh();
    });
  }

  /* ------------------------------------------------- join team */
  const joinTeamForm = root.querySelector('#joinTeamForm');
  if (joinTeamForm) {
    (async () => {
      const select = joinTeamForm.querySelector('#jt-select');
      try {
        const { teams } = await get(
          `/teams?school=${encodeURIComponent(student.school)}&category=${encodeURIComponent(student.categoryId)}`,
        );
        const open = teams.filter((t) => t.seatsLeft > 0);
        select.innerHTML = open.length
          ? `<option value="">Choose a team…</option>${open
              .map((t) => `<option value="${esc(t.id)}">${esc(t.name)} — ${t.seatsLeft} place${t.seatsLeft === 1 ? '' : 's'} open</option>`)
              .join('')}`
          : '<option value="">No teams with open places in your field</option>';
      } catch (error) {
        select.innerHTML = `<option value="">${esc(error.message)}</option>`;
      }
    })();

    onSubmit(joinTeamForm, async (data) => {
      const result = await post('/student/team', {
        mode: 'join',
        teamId: data.get('teamId'),
        joinCode: data.get('joinCode'),
      });
      setStudent(result.student);
      toast(result.message, 'ok');
      await refresh();
    });
  }

  /* ------------------------------------------------- team settings */
  const teamForm = root.querySelector('#teamForm');
  if (teamForm) {
    onSubmit(teamForm, async (data) => {
      const passcode = (data.get('passcode') || '').trim();
      const result = await patch('/student/team', {
        name: data.get('name'),
        maxMembers: Number(data.get('maxMembers')),
        passcode: passcode || undefined,
      });
      setStudent(result.student);
      toast(result.message, 'ok');
      await refresh();
    });

    root.querySelector('[data-action="leave-team"]')?.addEventListener('click', async () => {
      const team = state.student.team;
      const confirmed = await confirmDialog({
        title: team.memberCount > 1 ? 'Leave this team?' : 'Close this team?',
        message:
          team.memberCount > 1
            ? 'You will be removed from the team and your registration becomes a solo entry. You can join another team afterwards.'
            : 'You are the only member, so the team will be deleted. You can create a new one afterwards.',
        confirmLabel: team.memberCount > 1 ? 'Leave team' : 'Close team',
        danger: true,
      });
      if (!confirmed) return;
      try {
        const result = await del('/student/team');
        setStudent(result.student);
        toast(result.message, 'ok');
        await refresh();
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    root.querySelector('[data-action="transfer-prompt"]')?.addEventListener('click', () => {
      const members = state.student.team.members.filter((m) => m.id !== state.student.id);
      modal({
        title: 'Transfer team leadership',
        body: `<p class="small ink2">Choose who becomes the new leader. You stay on the team as a member and lose access to team settings.</p>
          <div class="stack stack--sm mt-2">
            ${members
              .map(
                (m) => `<label class="choice">
                  <input type="radio" name="transferTo" value="${esc(m.id)}">
                  <span class="choice__title">${esc(m.name)}</span>
                  <span class="choice__desc">${esc(m.className || 'Student')}</span>
                </label>`,
              )
              .join('')}
          </div>`,
        actions: [
          { id: 'cancel', label: 'Cancel' },
          {
            id: 'confirm',
            label: 'Transfer',
            cls: 'btn btn--solid btn--sm',
            onClick: async ({ dialog }) => {
              const chosen = dialog.querySelector('input[name="transferTo"]:checked');
              if (!chosen) {
                toast('Choose a teammate first.', 'error');
                return true;
              }
              try {
                const result = await post('/student/team/transfer', { studentId: chosen.value });
                setStudent(result.student);
                toast(result.message, 'ok');
                await refresh();
              } catch (error) {
                toast(error.message, 'error');
                return true;
              }
              return false;
            },
          },
        ],
      });
    });

    root.querySelectorAll('[data-action="transfer"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: `Make ${button.dataset.name} the leader?`,
          message: 'You will become a regular member. This can only be undone by the new leader.',
          confirmLabel: 'Transfer leadership',
        });
        if (!confirmed) return;
        try {
          const result = await post('/student/team/transfer', { studentId: button.dataset.id });
          setStudent(result.student);
          toast(result.message, 'ok');
          await refresh();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });

    root.querySelectorAll('[data-action="remove"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: `Remove ${button.dataset.name}?`,
          message: 'They keep their registration and can join another team. Their place opens up for a new teammate.',
          confirmLabel: 'Remove from team',
          danger: true,
        });
        if (!confirmed) return;
        try {
          const result = await post('/student/team/remove', { studentId: button.dataset.id });
          setStudent(result.student);
          toast(result.message, 'ok');
          await refresh();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  // Non-leader leave button
  if (!root.querySelector('#teamForm')) {
    root.querySelectorAll('[data-action="leave-team"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Leave this team?',
          message: 'Your registration becomes a solo entry. You can join another team from your dashboard.',
          confirmLabel: 'Leave team',
          danger: true,
        });
        if (!confirmed) return;
        try {
          const result = await del('/student/team');
          setStudent(result.student);
          toast(result.message, 'ok');
          await refresh();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  /* ------------------------------------------------- field change */
  const fieldForm = root.querySelector('#fieldForm');
  if (fieldForm) {
    onSubmit(fieldForm, async (data) => {
      const payload = { categoryId: data.get('categoryId') };
      if (data.get('reason')) payload.reason = data.get('reason');
      const result = await post('/student/category', payload);
      setStudent(result.student);
      toast(result.message, 'ok');
      await refresh();
    });
  }

  /* ------------------------------------------------- password */
  const passwordForm = root.querySelector('#passwordForm');
  if (passwordForm) {
    onSubmit(passwordForm, async (data) => {
      await post('/student/password', {
        currentPassword: data.get('currentPassword'),
        newPassword: data.get('newPassword'),
      });
      passwordForm.reset();
      toast('Password updated. Other devices were signed out.', 'ok');
    });
  }

  mountReveal(root);
}

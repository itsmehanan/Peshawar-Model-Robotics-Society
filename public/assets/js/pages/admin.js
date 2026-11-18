/**
 * Admin control room.
 *
 * Sign-in hits /api/admin/login; the session lives in an HttpOnly cookie. There
 * is no password in this bundle and no admin-only data in the public payload.
 */
import { get, post, patch, put, del, download, loadContent, storeToken } from '../api.js';
import { state, setAdmin, refreshContent } from '../store.js';
import {
  esc, onSubmit, toast, modal, confirmDialog, formatDate, relative, applyFieldErrors, socialIcons, setBusy, linkLabels,
} from '../ui.js';

const SECTIONS = [
  { group: 'Overview', key: 'overview', label: 'Dashboard' },
  { group: 'Overview', key: 'requests', label: 'Change requests', badge: true },
  { group: 'People', key: 'students', label: 'Students' },
  { group: 'People', key: 'teams', label: 'Teams' },
  { group: 'Content', key: 'site', label: 'Branding & site' },
  { group: 'Content', key: 'event', label: 'Event details' },
  { group: 'Content', key: 'fields', label: 'Fields of entry' },
  { group: 'Content', key: 'articles', label: 'Articles & FAQ' },
  { group: 'Content', key: 'announcements', label: 'Announcements' },
  { group: 'Content', key: 'contact', label: 'Contact & social' },
  { group: 'Settings', key: 'registration', label: 'Registration' },
  { group: 'Settings', key: 'exports', label: 'Exports' },
  { group: 'Settings', key: 'account', label: 'Account' },
];

export function adminPage({ section = 'overview' }) {
  if (!state.admin) return adminLoginView();

  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return `<div class="view">
    <section class="page-hero" style="padding-block:clamp(1.6rem,3vw,2.4rem)">
      <div class="wrap">
        <div class="row row--between" style="align-items:flex-end">
          <div>
            <span class="eyebrow eyebrow--accent">Organiser control room</span>
            <h1 class="display display--sm mt-1" style="font-size:clamp(1.7rem,3.2vw,2.5rem)">Administration</h1>
            <p class="small ink2 mt-1">Signed in as ${esc(state.admin.name)} · ${esc(state.admin.email)}</p>
          </div>
          <div class="row">
            <a class="btn btn--ghost btn--sm" href="#/" data-link>View site</a>
            <button class="btn btn--ghost btn--sm" data-action="admin-logout">Sign out</button>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap admin-layout">
        <details class="admin-menu" data-admin-menu>
          <summary class="admin-menu__toggle">
            <span class="admin-menu__label">Sections</span>
            <span class="admin-menu__current">${esc(SECTIONS.find((s) => s.key === section)?.label || 'Dashboard')}</span>
          </summary>
          <nav class="admin-nav" aria-label="Admin sections">
          ${groups
            .map(
              (group) => `
            <p class="admin-nav__group">${esc(group)}</p>
            ${SECTIONS.filter((s) => s.group === group)
              .map(
                (s) => `<a class="admin-nav__link ${section === s.key ? 'is-active' : ''}" href="#/admin/${s.key}" data-link>
                  <span>${esc(s.label)}</span>
                  ${s.badge ? `<span class="admin-nav__badge" data-request-badge hidden>0</span>` : ''}
                </a>`,
              )
              .join('')}`,
            )
            .join('')}
          </nav>
        </details>

        <div id="adminBody">
          <p class="small muted">Loading…</p>
        </div>
      </div>
    </section>
  </div>`;
}

function adminLoginView() {
  return `<div class="view auth-wrap">
    <div class="auth-panel">
      <div class="auth-panel__inner">
        <span class="eyebrow eyebrow--accent">Restricted</span>
        <h1 class="display display--sm mt-2" style="font-size:clamp(1.9rem,3.2vw,2.6rem)">Organiser<br><em>sign in.</em></h1>
        <p class="small ink2 mt-1 mb-2">This area manages the live event website and the registration database.
        Access is checked on the server with a hashed password and an HttpOnly session.</p>
        <form class="form" id="adminLoginForm" novalidate>
          <div class="field">
            <label for="a-email">Administrator ID or email</label>
            <input class="input" id="a-email" name="email" type="text" autocomplete="username"
                   autocapitalize="characters" spellcheck="false" placeholder="ADMIN-003" required>
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="a-password">Password</label>
            <input class="input" id="a-password" name="password" type="password" autocomplete="current-password" required>
            <span class="field__error"></span>
          </div>
          <button class="btn btn--solid btn--lg btn--block" type="submit">Sign in</button>
        </form>
        <p class="tiny muted mt-2">Use the administrator ID assigned by the PMRS team. Your password is checked securely on the server and is never stored in this page.</p>
        <a class="link-arrow mt-2" href="#/" data-link><span aria-hidden="true">←</span> Back to the site</a>
      </div>
    </div>
    <aside class="auth-art" aria-hidden="true">
      <picture>
        <source type="image/webp" srcset="/assets/art/hero-sm.webp">
        <img src="/assets/art/hero-sm.png" alt="" width="1000" height="1000" loading="lazy" decoding="async">
      </picture>
      <p class="auth-art__quote">Every published change updates the public site immediately — the exhibition
        database stays the single source of truth.</p>
      <p class="auth-art__cite">Control room</p>
    </aside>
  </div>`;
}

/* ------------------------------------------------------------------ mount */
export async function mountAdmin(root, { section = 'overview', navigate, refresh }) {
  const loginForm = root.querySelector('#adminLoginForm');
  if (loginForm) {
    onSubmit(loginForm, async (data) => {
      const result = await post('/admin/login', { email: data.get('email'), password: data.get('password') });
      storeToken('admin', result.sessionToken);
      setAdmin(result.admin);
      toast('Signed in to the control room.', 'ok');
      navigate('#/admin/overview');
    });
    return;
  }

  /**
   * The section menu is a <details> so it needs no JS to open on a phone, but it
   * must START collapsed there (a 14-row list would cover the panel) and START
   * open on a desktop sidebar. The breakpoint matches the stylesheet's 980px.
   */
  const menu = root.querySelector('[data-admin-menu]');
  if (menu && window.matchMedia) {
    const wide = window.matchMedia('(min-width: 980px)');
    const apply = () => {
      menu.open = wide.matches;
    };
    apply();
    wide.addEventListener?.('change', apply);
  }

  root.querySelector('[data-action="admin-logout"]')?.addEventListener('click', async () => {
    await post('/admin/logout').catch(() => {});
    storeToken('admin', null);
    setAdmin(null);
    navigate('#/');
    toast('Signed out.', 'ok');
  });

  const body = root.querySelector('#adminBody');
  if (!body) return;

  const reload = async () => {
    await refreshContent().catch(() => {});
    await refresh();
  };

  try {
    if (section === 'students') await renderStudents(body, reload);
    else if (section === 'teams') await renderTeams(body, reload);
    else if (section === 'requests') await renderRequests(body, reload);
    else if (section === 'fields') await renderFields(body, reload);
    else if (section === 'articles') await renderArticles(body, reload);
    else if (section === 'announcements') await renderAnnouncements(body, reload);
    else if (section === 'site') await renderSettingsSection(body, 'site', reload);
    else if (section === 'event') await renderSettingsSection(body, 'event', reload);
    else if (section === 'contact') await renderSettingsSection(body, 'contact', reload);
    else if (section === 'registration') await renderSettingsSection(body, 'registration', reload);
    else if (section === 'exports') renderExports(body);
    else if (section === 'account') renderAccount(body);
    else await renderOverview(body);
  } catch (error) {
    if (error.status === 401) {
      // A single 401 does not necessarily mean the session is gone (expired
      // cookie, restored tab, flaky network). Confirm with the server first so
      // the panel is never replaced by the sign-in form by accident.
      const still = await get('/admin/session').catch(() => null);
      if (still?.admin) {
        setAdmin(still.admin);
        body.innerHTML = `<div class="panel"><p class="small">${esc(error.message)} Reload the panel to try again.</p>
          <button class="btn btn--solid btn--sm mt-2" data-action="retry-section">Reload panel</button></div>`;
        body.querySelector('[data-action="retry-section"]')?.addEventListener('click', () => refresh());
        return;
      }
      storeToken('admin', null);
      setAdmin(null);
      toast('Your organiser session expired. Sign in again.', 'error');
      navigate('#/admin');
      return;
    }
    body.innerHTML = `<div class="panel"><p class="small">${esc(error.message)}</p></div>`;
  }

  // Admin panes are fetched then painted, so label association runs afterwards.
  linkLabels(body);

  // Pending-request badge (cheap: one call, shared with the overview)
  get('/admin/category-requests')
    .then(({ requests }) => {
      const pending = requests.filter((r) => r.status === 'pending').length;
      root.querySelectorAll('[data-request-badge]').forEach((badge) => {
        badge.hidden = pending === 0;
        badge.textContent = String(pending);
      });
    })
    .catch(() => {});
}

/* --------------------------------------------------------------- overview */
async function renderOverview(body) {
  const data = await get('/admin/overview');
  const total = Math.max(1, ...data.perCategory.map((c) => c.students));
  body.innerHTML = `
    <div class="metrics">
      <div class="metric"><p class="metric__value">${data.counts.students}</p><span class="metric__label">Registered students</span></div>
      <div class="metric"><p class="metric__value">${data.counts.teams}</p><span class="metric__label">Teams</span></div>
      <div class="metric"><p class="metric__value">${data.counts.pending_requests}</p><span class="metric__label">Pending requests</span></div>
      <div class="metric"><p class="metric__value">${data.counts.new_week}</p><span class="metric__label">New this week</span></div>
    </div>

    <div class="split">
      <div class="panel">
        <div class="panel__head"><div><h2 class="panel__title">Students by field</h2></div></div>
        ${data.perCategory
          .map(
            (c) => `<div class="bar-row">
              <span>${esc(c.name)}</span>
              <span class="bar"><span style="width:${Math.round((c.students / total) * 100)}%"></span></span>
              <span class="bar-row__value">${c.students}</span>
            </div>`,
          )
          .join('')}
      </div>
      <div class="panel">
        <div class="panel__head"><div><h2 class="panel__title">Latest registrations</h2></div></div>
        ${
          data.recent.length
            ? `<div class="editor-list">${data.recent
                .map(
                  (s) => `<div class="editor-item">
                    <div class="editor-item__body">
                      <p class="editor-item__title">${esc(s.name)}</p>
                      <p class="editor-item__meta">${esc(s.school)} · ${esc(s.className)} · ${relative(s.createdAt)}</p>
                    </div>
                  </div>`,
                )
                .join('')}</div>`
            : '<div class="empty">No registrations yet. Share the registration link.</div>'
        }
      </div>
    </div>

    <div class="panel mt-2">
      <div class="panel__head"><div><h2 class="panel__title">Activity</h2><p class="panel__sub">Server-side audit trail.</p></div></div>
      ${
        data.activity.length
          ? `<div class="editor-list">${data.activity
              .map(
                (a) => `<div class="editor-item">
                  <div class="editor-item__body">
                    <p class="editor-item__title" style="font-family:var(--sans);font-size:.86rem">${esc(a.action)}</p>
                    <p class="editor-item__meta">${esc(a.actorKind)} · ${relative(a.createdAt)}</p>
                  </div>
                </div>`,
              )
              .join('')}</div>`
          : '<div class="empty">No activity recorded yet.</div>'
      }
    </div>`;
}

/* --------------------------------------------------------------- students */
async function renderStudents(body, reload) {
  body.innerHTML = `
    <div class="admin-toolbar">
      <input class="input" id="studentSearch" placeholder="Search name, email, school…" aria-label="Search students">
      <select class="select" id="studentField" style="max-width:12rem" aria-label="Filter by field"><option value="">All fields</option></select>
      <select class="select" id="studentTeam" style="max-width:10rem" aria-label="Filter by team status">
        <option value="">Everyone</option><option value="team">On a team</option><option value="solo">Solo entries</option>
      </select>
      <span class="admin-toolbar__spacer"></span>
      <button class="btn btn--ghost btn--sm" data-action="export-students">Export CSV ↓</button>
    </div>
    <div id="studentResults"><p class="small muted">Loading…</p></div>`;

  const results = body.querySelector('#studentResults');
  const fieldSelect = body.querySelector('#studentField');
  const teamSelect = body.querySelector('#studentTeam');
  const search = body.querySelector('#studentSearch');

  (state.content?.categories || []).forEach((c) => {
    fieldSelect.insertAdjacentHTML('beforeend', `<option value="${esc(c.id)}">${esc(c.name)}</option>`);
  });

  let rows = [];
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const filtered = rows.filter(
      (s) => !q || [s.name, s.email, s.school, s.className].join(' ').toLowerCase().includes(q),
    );
    results.innerHTML = filtered.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Student</th><th>School / class</th><th>Field</th><th>Team</th><th>Registered</th><th></th></tr></thead>
          <tbody>${filtered
            .map(
              (s) => `<tr>
                <td><b>${esc(s.name)}</b><br><span class="tiny muted">${esc(s.email)}</span></td>
                <td>${esc(s.school)}<br><span class="tiny muted">${esc(s.className)}</span></td>
                <td>${esc(s.categoryName || s.categoryId)}</td>
                <td>${s.teamName ? esc(s.teamName) : '<span class="muted">Solo</span>'}${s.role === 'leader' ? ' <span class="member__tag">Lead</span>' : ''}</td>
                <td class="tiny muted">${formatDate(s.createdAt, { style: 'short' })}</td>
                <td class="table__actions">
                  <button class="btn btn--quiet btn--sm" data-edit="${esc(s.id)}">Edit</button>
                  <button class="btn btn--quiet btn--sm" data-delete="${esc(s.id)}" data-name="${esc(s.name)}">Delete</button>
                </td>
              </tr>`,
            )
            .join('')}</tbody></table></div>`
      : '<div class="empty">No students match that filter.</div>';

    results.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => editStudent(rows.find((s) => s.id === button.dataset.edit), reload));
    });
    results.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: `Delete ${button.dataset.name}?`,
          message: 'This removes the account and frees their team place. Export the CSV first if you need a record.',
          confirmLabel: 'Delete account',
          danger: true,
        });
        if (!ok) return;
        try {
          await del(`/admin/students/${button.dataset.delete}`);
          toast('Student deleted.', 'ok');
          rows = rows.filter((s) => s.id !== button.dataset.delete);
          draw();
          await reload();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  };

  const load = async () => {
    const params = new URLSearchParams();
    if (fieldSelect.value) params.set('category', fieldSelect.value);
    if (teamSelect.value) params.set('team', teamSelect.value);
    const data = await get(`/admin/students${params.toString() ? `?${params}` : ''}`);
    rows = data.students;
    draw();
  };

  search.addEventListener('input', draw);
  fieldSelect.addEventListener('change', load);
  teamSelect.addEventListener('change', load);
  body.querySelector('[data-action="export-students"]').addEventListener('click', () => download('/admin/export/registrations.csv'));
  await load();
}

function editStudent(student, reload) {
  if (!student) return;
  const categories = state.content?.categories || [];
  modal({
    title: `Edit ${student.name}`,
    size: 'lg',
    body: `<form class="form" id="studentEditForm">
      <div class="form-row">
        <div class="field"><label>Full name</label><input class="input" name="name" value="${esc(student.name)}" required><span class="field__error"></span></div>
        <div class="field"><label>Class</label><input class="input" name="className" value="${esc(student.className)}"><span class="field__error"></span></div>
      </div>
      <div class="form-row">
        <div class="field"><label>School</label><input class="input" name="school" value="${esc(student.school)}" required><span class="field__error"></span></div>
        <div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(student.phone || '')}"><span class="field__error"></span></div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Field</label>
          <select class="select" name="categoryId">
            ${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === student.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          <span class="field__error"></span>
        </div>
        <div class="field">
          <label>Status</label>
          <select class="select" name="status">
            <option value="confirmed" ${student.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="pending" ${student.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="withdrawn" ${student.status === 'withdrawn' ? 'selected' : ''}>Withdrawn</option>
          </select>
        </div>
      </div>
      <p class="form-note">Changing field or team here bypasses the normal approval flow — the student is not notified. Team changes must keep school and field consistent, or the server rejects the save.</p>
    </form>`,
    actions: [
      { id: 'cancel', label: 'Cancel' },
      {
        id: 'save',
        label: 'Save changes',
        cls: 'btn btn--solid btn--sm',
        onClick: async ({ dialog }) => {
          const form = dialog.querySelector('#studentEditForm');
          const data = Object.fromEntries(new FormData(form));
          try {
            await patch(`/admin/students/${student.id}`, data);
            toast('Student updated.', 'ok');
            await reload();
            return false;
          } catch (error) {
            if (error.fields) applyFieldErrors(form, error.fields);
            toast(error.message, 'error');
            return true;
          }
        },
      },
    ],
  });
}

/* --------------------------------------------------------------- teams */
async function renderTeams(body, reload) {
  const { teams } = await get('/admin/teams');
  body.innerHTML = `
    <div class="admin-toolbar">
      <h2 class="h3" style="font-size:1.15rem">${teams.length} teams</h2>
      <span class="admin-toolbar__spacer"></span>
      <button class="btn btn--ghost btn--sm" data-action="export-teams">Export CSV ↓</button>
    </div>
    ${
      teams.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Team</th><th>School</th><th>Field</th><th>Members</th><th>Leader</th><th></th></tr></thead>
            <tbody>${teams
              .map(
                (t) => `<tr>
                  <td><b>${esc(t.name)}</b><br><span class="tiny muted">${formatDate(t.createdAt, { style: 'short' })}</span></td>
                  <td>${esc(t.school)}</td>
                  <td>${esc(t.categoryName || t.categoryId)}</td>
                  <td>${t.memberCount}/${t.maxMembers}</td>
                  <td>${esc(t.leaderName || '—')}</td>
                  <td class="table__actions">
                    <button class="btn btn--quiet btn--sm" data-edit-team="${esc(t.id)}">Edit</button>
                    <button class="btn btn--quiet btn--sm" data-del-team="${esc(t.id)}" data-name="${esc(t.name)}">Delete</button>
                  </td>
                </tr>`,
              )
              .join('')}</tbody></table></div>`
        : '<div class="empty">No teams created yet.</div>'
    }`;

  body.querySelector('[data-action="export-teams"]').addEventListener('click', () => download('/admin/export/teams.csv'));

  body.querySelectorAll('[data-edit-team]').forEach((button) => {
    button.addEventListener('click', () => {
      const team = teams.find((t) => t.id === button.dataset.editTeam);
      const categories = state.content?.categories || [];
      modal({
        title: `Edit ${team.name}`,
        body: `<form class="form" id="teamEditForm">
          <div class="field"><label>Team name</label><input class="input" name="name" value="${esc(team.name)}" required><span class="field__error"></span></div>
          <div class="form-row">
            <div class="field">
              <label>Field</label>
              <select class="select" name="categoryId">${categories.map((c) => `<option value="${esc(c.id)}" ${c.id === team.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
              <span class="field__hint">Changing this moves every member too.</span>
            </div>
            <div class="field">
              <label>Capacity</label>
              <select class="select" name="maxMembers">${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === team.maxMembers ? 'selected' : ''}>${n} members</option>`).join('')}</select>
              <span class="field__error"></span>
            </div>
          </div>
          <div class="field"><label>Reset passcode <span class="label__opt">optional</span></label><input class="input" name="passcode" minlength="6" placeholder="Leave blank to keep the current code"><span class="field__error"></span></div>
        </form>`,
        actions: [
          { id: 'cancel', label: 'Cancel' },
          {
            id: 'save',
            label: 'Save team',
            cls: 'btn btn--solid btn--sm',
            onClick: async ({ dialog }) => {
              const form = dialog.querySelector('#teamEditForm');
              try {
                await patch(`/admin/teams/${team.id}`, Object.fromEntries(new FormData(form)));
                toast('Team updated.', 'ok');
                await reload();
                return false;
              } catch (error) {
                if (error.fields) applyFieldErrors(form, error.fields);
                toast(error.message, 'error');
                return true;
              }
            },
          },
        ],
      });
    });
  });

  body.querySelectorAll('[data-del-team]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete team ${button.dataset.name}?`,
        message: 'Members keep their registrations but become solo entries.',
        confirmLabel: 'Delete team',
        danger: true,
      });
      if (!ok) return;
      try {
        await del(`/admin/teams/${button.dataset.delTeam}`);
        toast('Team deleted.', 'ok');
        await reload();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

/* ------------------------------------------------------------- requests */
async function renderRequests(body, reload) {
  const [{ requests }, categories] = await Promise.all([
    get('/admin/category-requests'),
    Promise.resolve(state.content?.categories || []),
  ]);
  const name = (id) => categories.find((c) => c.id === id)?.name || id;
  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  body.innerHTML = `
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Pending field changes</h2><p class="panel__sub">Approving a leader's request moves the whole team.</p></div>
      <span class="status-chip status-chip--wait">${pending.length} waiting</span></div>
      ${
        pending.length
          ? `<div class="editor-list">${pending
              .map(
                (r) => `<div class="editor-item">
                  <div class="editor-item__body">
                    <p class="editor-item__title">${esc(r.studentName)} <span class="tiny muted">· ${esc(r.school)}</span></p>
                    <p class="editor-item__meta">${esc(name(r.fromCategory))} → <b>${esc(name(r.toCategory))}</b>${r.teamSize > 1 ? ` · affects ${r.teamSize} members` : ''} · ${relative(r.createdAt)}</p>
                    ${r.reason ? `<p class="small ink2" style="margin-top:.3rem;max-width:52ch">“${esc(r.reason)}”</p>` : ''}
                  </div>
                  <div class="editor-item__actions">
                    <button class="btn btn--solid btn--sm" data-approve="${esc(r.id)}">Approve</button>
                    <button class="btn btn--ghost btn--sm" data-reject="${esc(r.id)}">Reject</button>
                  </div>
                </div>`,
              )
              .join('')}</div>`
          : '<div class="empty">No pending requests.</div>'
      }
    </div>

    ${
      resolved.length
        ? `<div class="panel">
            <div class="panel__head"><div><h2 class="panel__title">Recent decisions</h2></div></div>
            <div class="editor-list">${resolved
              .slice(0, 12)
              .map(
                (r) => `<div class="editor-item">
                  <div class="editor-item__body">
                    <p class="editor-item__title">${esc(r.studentName)}</p>
                    <p class="editor-item__meta">${esc(name(r.fromCategory))} → ${esc(name(r.toCategory))} · ${esc(r.status)} · ${relative(r.createdAt)}</p>
                    ${r.adminNote ? `<p class="tiny muted">${esc(r.adminNote)}</p>` : ''}
                  </div>
                </div>`,
              )
              .join('')}</div>
          </div>`
        : ''
    }`;

  const decide = async (id, action) => {
    const note = action === 'reject' ? window.prompt('Reason for the student (optional)') ?? '' : '';
    try {
      await post(`/admin/category-requests/${id}`, { action, note });
      toast(action === 'approve' ? 'Request approved and applied.' : 'Request rejected.', 'ok');
      await reload();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  body.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.approve, 'approve')));
  body.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.reject, 'reject')));
}

/* ---------------------------------------------------------------- fields */
async function renderFields(body, reload) {
  const { categories } = await get('/admin/categories');
  body.innerHTML = `
    <div class="admin-toolbar">
      <h2 class="h3" style="font-size:1.15rem">${categories.length} fields</h2>
      <span class="admin-toolbar__spacer"></span>
      <button class="btn btn--solid btn--sm" data-action="new-field">Add a field +</button>
    </div>
    <div class="editor-list panel">
      ${
        categories.length
          ? categories
              .map(
                (c) => `<div class="editor-item">
                  <div class="editor-item__body">
                    <p class="editor-item__title"><span class="accent" style="margin-right:.4rem">${esc(c.symbol)}</span>${esc(c.name)}${c.isActive === false ? ' <span class="status-chip status-chip--off">Hidden</span>' : ''}</p>
                    <p class="editor-item__meta"><span class="mono">${esc(c.id)}</span> · ${esc(c.summary)}</p>
                  </div>
                  <div class="editor-item__actions">
                    <button class="btn btn--quiet btn--sm" data-edit-field="${esc(c.id)}">Edit</button>
                    <button class="btn btn--quiet btn--sm" data-del-field="${esc(c.id)}" data-name="${esc(c.name)}">Delete</button>
                  </div>
                </div>`,
              )
              .join('')
          : '<div class="empty">No fields yet.</div>'
      }
    </div>`;

  body.querySelector('[data-action="new-field"]').addEventListener('click', () => fieldModal(null, reload));
  body.querySelectorAll('[data-edit-field]').forEach((b) =>
    b.addEventListener('click', () => fieldModal(categories.find((c) => c.id === b.dataset.editField), reload)),
  );
  body.querySelectorAll('[data-del-field]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete ${b.dataset.name}?`,
        message: 'Fields with registrations cannot be deleted — hide them instead.',
        confirmLabel: 'Delete field',
        danger: true,
      });
      if (!ok) return;
      try {
        await del(`/admin/categories/${b.dataset.delField}`);
        toast('Field deleted.', 'ok');
        await reload();
      } catch (error) {
        toast(error.message, 'error');
      }
    }),
  );
}

function fieldModal(category, reload) {
  const editing = Boolean(category);
  modal({
    title: editing ? `Edit ${category.name}` : 'Add a field',
    size: 'lg',
    body: `<form class="form" id="fieldFormModal">
      <div class="form-row">
        <div class="field"><label>Name</label><input class="input" name="name" value="${editing ? esc(category.name) : ''}" required maxlength="60"><span class="field__error"></span></div>
        <div class="field"><label>Symbol</label><input class="input" name="symbol" value="${editing ? esc(category.symbol) : '◇'}" maxlength="4"><span class="field__error"></span></div>
      </div>
      ${editing ? '' : `<div class="field"><label>Link slug <span class="label__opt">optional — generated from the name</span></label><input class="input" name="id" placeholder="e.g. robotics"><span class="field__error"></span></div>`}
      <div class="field"><label>One-line summary</label><input class="input" name="summary" value="${editing ? esc(category.summary) : ''}" required maxlength="180"><span class="field__error"></span></div>
      <div class="field"><label>Full brief</label><textarea class="textarea" name="details" rows="5">${editing ? esc(category.details) : ''}</textarea><span class="field__error"></span></div>
      <div class="field"><label>Entry rules</label><textarea class="textarea" name="rules" rows="3">${editing ? esc(category.rules) : ''}</textarea><span class="field__error"></span></div>
      <label class="checkline"><input type="checkbox" name="isActive" ${!editing || category.isActive !== false ? 'checked' : ''}><span>Visible on the public site</span></label>
    </form>`,
    actions: [
      { id: 'cancel', label: 'Cancel' },
      {
        id: 'save',
        label: editing ? 'Save field' : 'Create field',
        cls: 'btn btn--solid btn--sm',
        onClick: async ({ dialog }) => {
          const form = dialog.querySelector('#fieldFormModal');
          const raw = Object.fromEntries(new FormData(form));
          raw.isActive = form.elements.isActive.checked;
          try {
            if (editing) await patch(`/admin/categories/${category.id}`, raw);
            else await post('/admin/categories', raw);
            toast(editing ? 'Field updated.' : 'Field created.', 'ok');
            await reload();
            return false;
          } catch (error) {
            if (error.fields) applyFieldErrors(form, error.fields);
            toast(error.message, 'error');
            return true;
          }
        },
      },
    ],
  });
}

/* -------------------------------------------------------------- articles */
async function renderArticles(body, reload) {
  const { articles, faqs } = await get('/admin/articles');
  body.innerHTML = `
    <div class="tabs">
      <button class="tab is-active" data-tab="articles">Articles (${articles.length})</button>
      <button class="tab" data-tab="faqs">FAQ (${faqs.length})</button>
    </div>
    <div id="articlePane">
      <div class="admin-toolbar">
        <span class="admin-toolbar__spacer"></span>
        <button class="btn btn--solid btn--sm" data-action="new-article">New article +</button>
      </div>
      <div class="editor-list panel">
        ${articles
          .map(
            (a) => `<div class="editor-item">
              <div class="editor-item__body">
                <p class="editor-item__title">${esc(a.title)}${a.isPublished === false ? ' <span class="status-chip status-chip--off">Draft</span>' : ''}</p>
                <p class="editor-item__meta">${esc(a.label)} · ${a.readMinutes} min · ${esc(a.excerpt.slice(0, 90))}…</p>
              </div>
              <div class="editor-item__actions">
                <button class="btn btn--quiet btn--sm" data-edit-article="${esc(a.id)}">Edit</button>
                <button class="btn btn--quiet btn--sm" data-del-article="${esc(a.id)}" data-name="${esc(a.title)}">Delete</button>
              </div>
            </div>`,
          )
          .join('') || '<div class="empty">No articles yet.</div>'}
      </div>
    </div>
    <div id="faqPane" hidden>
      <div class="admin-toolbar"><span class="admin-toolbar__spacer"></span><button class="btn btn--solid btn--sm" data-action="new-faq">New question +</button></div>
      <div class="editor-list panel">
        ${faqs
          .map(
            (f) => `<div class="editor-item">
              <div class="editor-item__body">
                <p class="editor-item__title">${esc(f.question)}</p>
                <p class="editor-item__meta">${esc(f.answer.slice(0, 110))}…</p>
              </div>
              <div class="editor-item__actions">
                <button class="btn btn--quiet btn--sm" data-edit-faq="${esc(f.id)}">Edit</button>
                <button class="btn btn--quiet btn--sm" data-del-faq="${esc(f.id)}">Remove</button>
              </div>
            </div>`,
          )
          .join('') || '<div class="empty">No questions yet.</div>'}
      </div>
    </div>`;

  const tabs = body.querySelectorAll('.tab');
  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      body.querySelector('#articlePane').hidden = tab.dataset.tab !== 'articles';
      body.querySelector('#faqPane').hidden = tab.dataset.tab !== 'faqs';
    }),
  );

  body.querySelector('[data-action="new-article"]').addEventListener('click', () => articleModal(null, reload));
  body.querySelectorAll('[data-edit-article]').forEach((b) =>
    b.addEventListener('click', () => articleModal(articles.find((a) => a.id === b.dataset.editArticle), reload)),
  );
  body.querySelectorAll('[data-del-article]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: `Delete “${b.dataset.name}”?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await del(`/admin/articles/${b.dataset.delArticle}`);
      toast('Article deleted.', 'ok');
      await reload();
    }),
  );

  body.querySelector('[data-action="new-faq"]').addEventListener('click', () => faqModal(null, reload));
  body.querySelectorAll('[data-edit-faq]').forEach((b) =>
    b.addEventListener('click', () => faqModal(faqs.find((f) => f.id === b.dataset.editFaq), reload)),
  );
  body.querySelectorAll('[data-del-faq]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Remove this question?', message: '', confirmLabel: 'Remove', danger: true });
      if (!ok) return;
      await del(`/admin/faqs/${b.dataset.delFaq}`);
      toast('Question removed.', 'ok');
      await reload();
    }),
  );
}

function articleModal(article, reload) {
  const editing = Boolean(article);
  modal({
    title: editing ? 'Edit article' : 'New article',
    size: 'lg',
    body: `<form class="form" id="articleFormModal">
      <div class="field"><label>Title</label><input class="input" name="title" value="${editing ? esc(article.title) : ''}" required maxlength="140"><span class="field__error"></span></div>
      <div class="form-row">
        <div class="field"><label>Label</label><input class="input" name="label" value="${editing ? esc(article.label) : 'Field notes'}" maxlength="40"></div>
        <div class="field"><label>Read time (minutes)</label><input class="input" name="readMinutes" type="number" min="1" max="60" value="${editing ? article.readMinutes : 4}"></div>
      </div>
      <div class="field"><label>Excerpt</label><textarea class="textarea" name="excerpt" rows="2" maxlength="260">${editing ? esc(article.excerpt) : ''}</textarea></div>
      <div class="field"><label>Body</label><textarea class="textarea" name="body" rows="10" required>${editing ? esc(article.body) : ''}</textarea><span class="field__hint">Markdown-lite: blank line for paragraphs, ## for headings, **bold**, _italic_, [text](url).</span><span class="field__error"></span></div>
      <label class="checkline"><input type="checkbox" name="isPublished" ${!editing || article.isPublished !== false ? 'checked' : ''}><span>Published (visible in the journal)</span></label>
    </form>`,
    actions: [
      { id: 'cancel', label: 'Cancel' },
      {
        id: 'save',
        label: editing ? 'Save article' : 'Publish',
        cls: 'btn btn--solid btn--sm',
        onClick: async ({ dialog }) => {
          const form = dialog.querySelector('#articleFormModal');
          const raw = Object.fromEntries(new FormData(form));
          raw.isPublished = form.elements.isPublished.checked;
          raw.readMinutes = Number(raw.readMinutes);
          try {
            if (editing) await patch(`/admin/articles/${article.id}`, raw);
            else await post('/admin/articles', raw);
            toast(editing ? 'Article saved.' : 'Article published.', 'ok');
            await reload();
            return false;
          } catch (error) {
            if (error.fields) applyFieldErrors(form, error.fields);
            toast(error.message, 'error');
            return true;
          }
        },
      },
    ],
  });
}

function faqModal(faq, reload) {
  const editing = Boolean(faq);
  modal({
    title: editing ? 'Edit question' : 'New question',
    body: `<form class="form" id="faqFormModal">
      <div class="field"><label>Question</label><input class="input" name="question" value="${editing ? esc(faq.question) : ''}" required maxlength="200"><span class="field__error"></span></div>
      <div class="field"><label>Answer</label><textarea class="textarea" name="answer" rows="5" required>${editing ? esc(faq.answer) : ''}</textarea><span class="field__error"></span></div>
      <label class="checkline"><input type="checkbox" name="isActive" ${!editing || faq.isActive !== false ? 'checked' : ''}><span>Show on the public FAQ</span></label>
    </form>`,
    actions: [
      { id: 'cancel', label: 'Cancel' },
      {
        id: 'save',
        label: 'Save',
        cls: 'btn btn--solid btn--sm',
        onClick: async ({ dialog }) => {
          const form = dialog.querySelector('#faqFormModal');
          const raw = Object.fromEntries(new FormData(form));
          raw.isActive = form.elements.isActive.checked;
          try {
            if (editing) await patch(`/admin/faqs/${faq.id}`, raw);
            else await post('/admin/faqs', raw);
            toast('Saved.', 'ok');
            await reload();
            return false;
          } catch (error) {
            if (error.fields) applyFieldErrors(form, error.fields);
            toast(error.message, 'error');
            return true;
          }
        },
      },
    ],
  });
}

/* ---------------------------------------------------------- announcements */
async function renderAnnouncements(body, reload) {
  const { announcements } = await get('/admin/announcements');
  body.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <div><h2 class="panel__title">Announcements</h2><p class="panel__sub">The most recent active announcement appears as a bar at the top of the home page.</p></div>
        <button class="btn btn--solid btn--sm" data-action="new-announcement">New announcement +</button>
      </div>
      <div class="editor-list">
        ${
          announcements.length
            ? announcements
                .map(
                  (a) => `<div class="editor-item">
                    <div class="editor-item__body">
                      <p class="editor-item__title">${esc(a.title)} ${!a.isActive ? '<span class="status-chip status-chip--off">Hidden</span>' : `<span class="status-chip status-chip--${a.level === 'important' ? 'danger' : 'ok'}">${esc(a.level)}</span>`}</p>
                      <p class="editor-item__meta">${esc(a.body || 'No message body')} · ${relative(a.createdAt)}</p>
                    </div>
                    <div class="editor-item__actions">
                      <button class="btn btn--quiet btn--sm" data-edit-ann="${esc(a.id)}">Edit</button>
                      <button class="btn btn--quiet btn--sm" data-del-ann="${esc(a.id)}">Delete</button>
                    </div>
                  </div>`,
                )
                .join('')
            : '<div class="empty">No announcements yet.</div>'
        }
      </div>
    </div>`;

  body.querySelector('[data-action="new-announcement"]').addEventListener('click', () => announcementModal(null, reload));
  body.querySelectorAll('[data-edit-ann]').forEach((b) =>
    b.addEventListener('click', () => announcementModal(announcements.find((a) => a.id === b.dataset.editAnn), reload)),
  );
  body.querySelectorAll('[data-del-ann]').forEach((b) =>
    b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Delete this announcement?', message: 'It disappears from the home page immediately.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await del(`/admin/announcements/${b.dataset.delAnn}`);
      toast('Announcement deleted.', 'ok');
      await reload();
    }),
  );
}

function announcementModal(item, reload) {
  const editing = Boolean(item);
  modal({
    title: editing ? 'Edit announcement' : 'New announcement',
    body: `<form class="form" id="annForm">
      <div class="field"><label>Title</label><input class="input" name="title" value="${editing ? esc(item.title) : ''}" required maxlength="120"><span class="field__error"></span></div>
      <div class="field"><label>Message</label><textarea class="textarea" name="body" rows="3" maxlength="800">${editing ? esc(item.body) : ''}</textarea></div>
      <div class="form-row">
        <div class="field">
          <label>Style</label>
          <select class="select" name="level">
            <option value="info" ${editing && item.level === 'info' ? 'selected' : ''}>Notice</option>
            <option value="important" ${editing && item.level === 'important' ? 'selected' : ''}>Important</option>
            <option value="success" ${editing && item.level === 'success' ? 'selected' : ''}>News</option>
          </select>
        </div>
        <div class="field"><label>Link label <span class="label__opt">optional</span></label><input class="input" name="linkLabel" value="${editing ? esc(item.linkLabel) : ''}" maxlength="40"></div>
      </div>
      <div class="field"><label>Link URL <span class="label__opt">optional</span></label><input class="input" name="linkUrl" value="${editing ? esc(item.linkUrl) : ''}" placeholder="https://…"><span class="field__error"></span></div>
      <label class="checkline"><input type="checkbox" name="isActive" ${!editing || item.isActive ? 'checked' : ''}><span>Show on the home page</span></label>
    </form>`,
    actions: [
      { id: 'cancel', label: 'Cancel' },
      {
        id: 'save',
        label: 'Save',
        cls: 'btn btn--solid btn--sm',
        onClick: async ({ dialog }) => {
          const form = dialog.querySelector('#annForm');
          const raw = Object.fromEntries(new FormData(form));
          raw.isActive = form.elements.isActive.checked;
          try {
            if (editing) await patch(`/admin/announcements/${item.id}`, raw);
            else await post('/admin/announcements', raw);
            toast('Announcement saved.', 'ok');
            await reload();
            return false;
          } catch (error) {
            if (error.fields) applyFieldErrors(form, error.fields);
            toast(error.message, 'error');
            return true;
          }
        },
      },
    ],
  });
}

/* -------------------------------------------------------------- settings */
async function renderSettingsSection(body, section, reload) {
  const { settings } = await get('/admin/settings');
  const formId = 'settingsForm';
  let fields = '';
  let intro = '';

  if (section === 'site') {
    const s = settings.site;
    intro = 'Branding is injected into every page on the server. The hero artwork deliberately does not change with it.';
    fields = `
      <div class="form-row">
        <div class="field"><label>Short name</label><input class="input" name="name" value="${esc(s.name)}" required maxlength="40"><span class="field__hint">Shown in the header.</span></div>
        <div class="field"><label>Full name</label><input class="input" name="fullName" value="${esc(s.fullName)}" required maxlength="80"><span class="field__error"></span></div>
      </div>
      <div class="field"><label>Tagline</label><input class="input" name="tagline" value="${esc(s.tagline)}" maxlength="160"></div>
      <div class="field"><label>Description</label><textarea class="textarea" name="description" rows="3" maxlength="600">${esc(s.description)}</textarea></div>
      <div class="field"><label>Meta description (search results)</label><textarea class="textarea" name="metaDescription" rows="2" maxlength="300">${esc(s.metaDescription)}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Logo mark (1–3 characters)</label><input class="input" name="logoMark" value="${esc(s.logoMark)}" maxlength="3"><span class="field__hint">Rendered in a circle in the header.</span></div>
        <div class="field">
          <label>Logo image <span class="label__opt">optional upload</span></label>
          <div class="row"><input class="input" name="logoUrl" value="${esc(s.logoUrl)}" placeholder="https://… or upload"><input type="file" accept="image/*" data-upload="logoUrl" class="sr-only" id="logoUpload"><label for="logoUpload" class="btn btn--ghost btn--sm" style="white-space:nowrap">Upload</label></div>
          <span class="field__hint">Uploads are stored in the database and served from /api/assets.</span>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Favicon URL <span class="label__opt">optional</span></label><input class="input" name="faviconUrl" value="${esc(s.faviconUrl)}" placeholder="https://…"></div>
        <div class="field"><label>Footer note</label><input class="input" name="footerNote" value="${esc(s.footerNote)}" maxlength="200"></div>
      </div>
      <div class="field"><label>Footer credit</label><input class="input" name="credit" value="${esc(settings.footer?.credit || '')}" maxlength="120"><span class="field__hint">Saved with the footer section.</span></div>`;
  }

  if (section === 'event') {
    const e = settings.event;
    intro = 'These values drive the hero facts, the programme band, the about page and the contact panel.';
    fields = `
      <div class="form-row">
        <div class="field"><label>Hero headline</label><input class="input" name="headline" value="${esc(e.headline)}" required maxlength="120"><span class="field__error"></span></div>
        <div class="field"><label>Season kicker</label><input class="input" name="kicker" value="${esc(e.kicker)}" maxlength="60"></div>
      </div>
      <div class="field"><label>Hero intro</label><textarea class="textarea" name="intro" rows="3" maxlength="900">${esc(e.intro)}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Date (display)</label><input class="input" name="dateLabel" value="${esc(e.dateLabel)}" maxlength="80"></div>
        <div class="field"><label>Date (ISO, for sorting)</label><input class="input" name="dateISO" type="date" value="${esc(e.dateISO)}"></div>
      </div>
      <div class="field"><label>Programme line</label><input class="input" name="doorsLabel" value="${esc(e.doorsLabel)}" maxlength="120"><span class="field__hint">e.g. Gates 09:00 · Judging 11:30 · Public 14:00</span></div>
      <div class="form-row">
        <div class="field"><label>Venue</label><input class="input" name="venue" value="${esc(e.venue)}" maxlength="120"></div>
        <div class="field"><label>City</label><input class="input" name="city" value="${esc(e.city)}" maxlength="80"></div>
      </div>
      <div class="field"><label>Full address</label><input class="input" name="address" value="${esc(e.address)}" maxlength="200"></div>
      <div class="form-row">
        <div class="field"><label>Map link <span class="label__opt">optional</span></label><input class="input" name="mapUrl" value="${esc(e.mapUrl || '')}" placeholder="https://maps.google.com/…"></div>
        <div class="field"><label>Hero image URL <span class="label__opt">optional</span></label><input class="input" name="heroImageUrl" value="${esc(e.heroImageUrl || '')}" placeholder="https://…"><span class="field__hint">Used for social sharing previews.</span></div>
      </div>
      <div class="field"><label>About heading</label><input class="input" name="aboutTitle" value="${esc(e.aboutTitle)}" maxlength="140"></div>
      <div class="field"><label>About body</label><textarea class="textarea" name="aboutBody" rows="7">${esc(e.aboutBody)}</textarea><span class="field__hint">Blank lines separate paragraphs.</span></div>
      <div class="field">
        <span class="label">Stats (up to 4)</span>
        ${(e.stats || [])
          .map(
            (stat, i) => `<div class="row" style="margin-bottom:.4rem;align-items:center">
          <input class="input" id="statValue${i}" name="statValue${i}" value="${esc(stat.value)}" style="max-width:7rem" placeholder="120+" aria-label="Stat ${i + 1} value">
          <input class="input" id="statLabel${i}" name="statLabel${i}" value="${esc(stat.label)}" placeholder="Student exhibitors" aria-label="Stat ${i + 1} label">
        </div>`,
          )
          .join('')}
        <span class="field__hint">Shown as a four-column band on the home and about pages. Leave a row empty to drop it.</span>
      </div>`;
  }

  if (section === 'contact') {
    const c = settings.contact;
    intro = 'Only social accounts with a URL and "enabled" appear on the site. Nothing else is hard-coded.';
    fields = `
      <div class="form-row">
        <div class="field"><label>Email</label><input class="input" name="email" type="email" value="${esc(c.email)}"><span class="field__error"></span></div>
        <div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(c.phone)}"><span class="field__error"></span></div>
      </div>
      <div class="form-row">
        <div class="field"><label>WhatsApp <span class="label__opt">optional</span></label><input class="input" name="whatsapp" value="${esc(c.whatsapp || '')}"></div>
        <div class="field"><label>Office hours</label><input class="input" name="hours" value="${esc(c.hours)}" maxlength="80"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Organiser name</label><input class="input" name="organizerName" value="${esc(c.organizerName)}" maxlength="80"></div>
        <div class="field"><label>Organiser role</label><input class="input" name="organizerRole" value="${esc(c.organizerRole)}" maxlength="80"></div>
      </div>
      <div class="field"><label>Contact blurb</label><textarea class="textarea" name="organiserBody" rows="3" maxlength="600">${esc(c.organiserBody)}</textarea></div>
      <div class="field"><label>Address</label><input class="input" name="address" value="${esc(c.address)}" maxlength="200"></div>

      <div class="field"><label>Social platforms</label>
        <div class="social-editor" id="socialEditor">
          ${(settings.socials || []).map((s) => socialRow(s)).join('')}
        </div>
        <span class="field__hint">Leave the URL empty to hide a platform entirely.</span>
      </div>`;
  }

  if (section === 'registration') {
    const r = settings.registration;
    intro = 'Controls the public registration flow, team sizes and how field changes are handled.';
    fields = `
      <label class="checkline"><input type="checkbox" name="open" ${r.open ? 'checked' : ''}><span><b>Registration is open</b> — when unchecked, the register page shows the closed message.</span></label>
      <label class="checkline"><input type="checkbox" name="allowTeamCreation" ${r.allowTeamCreation !== false ? 'checked' : ''}><span>Allow students to create new teams</span></label>
      <label class="checkline"><input type="checkbox" name="requireSchoolMatch" ${r.requireSchoolMatch !== false ? 'checked' : ''}><span>Require teams to be formed within one school</span></label>
      <div class="form-row">
        <div class="field"><label>Default team size</label><input class="input" name="maxMembers" type="number" min="2" max="8" value="${r.maxMembers}"><span class="field__error"></span></div>
        <div class="field"><label>Minimum team size</label><input class="input" name="minMembers" type="number" min="2" max="8" value="${r.minMembers}"><span class="field__error"></span></div>
      </div>
      <div class="field"><label>Allowed sizes (comma separated)</label><input class="input" name="allowedSizes" value="${(r.allowedSizes || []).join(', ')}"><span class="field__hint">e.g. 2, 3, 4, 5, 6</span></div>
      <div class="form-row">
        <div class="field"><label>Deadline label</label><input class="input" name="deadlineLabel" value="${esc(r.deadlineLabel)}" maxlength="120"></div>
        <div class="field">
          <label>Field changes</label>
          <select class="select" name="categoryChangeMode">
            <option value="request" ${r.categoryChangeMode === 'request' ? 'selected' : ''}>Require approval</option>
            <option value="open" ${r.categoryChangeMode === 'open' ? 'selected' : ''}>Leaders change instantly</option>
            <option value="locked" ${r.categoryChangeMode === 'locked' ? 'selected' : ''}>Locked for the season</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>Closed title</label><input class="input" name="closedTitle" value="${esc(r.closedTitle)}" maxlength="120"></div>
        <div class="field"><label>Closed message</label><textarea class="textarea" name="closedMessage" rows="3" maxlength="600">${esc(r.closedMessage)}</textarea></div>
      </div>`;
  }

  body.innerHTML = `
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">${esc(SECTIONS.find((s) => s.key === section)?.label || section)}</h2><p class="panel__sub">${esc(intro)}</p></div></div>
      <form class="form" id="${formId}">${fields}
        <div class="form-actions"><button class="btn btn--solid" type="submit">Save changes</button><span class="tiny muted" id="settingsStamp"></span></div>
      </form>
    </div>`;

  const form = body.querySelector(`#${formId}`);

  // Simple logo upload → stored as a data URL asset, then kept as its serve URL
  form.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) return toast('Image must be under 1.5 MB.', 'error');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      try {
        const { url } = await post('/admin/assets', { dataUrl });
        form.elements[input.dataset.upload].value = url;
        toast('Image uploaded — save to apply.', 'ok');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true);
    try {
      const data = Object.fromEntries(new FormData(form));
      if (section === 'site') {
        await put('/admin/settings/site', data);
        await put('/admin/settings/footer', { credit: data.credit });
      } else if (section === 'event') {
        const stats = [];
        for (let i = 0; i < 4; i += 1) {
          if (data[`statValue${i}`] || data[`statLabel${i}`]) {
            stats.push({ value: data[`statValue${i}`] || '', label: data[`statLabel${i}`] || '' });
          }
        }
        data.stats = stats;
        await put('/admin/settings/event', data);
      } else if (section === 'contact') {
        const socials = [...form.querySelectorAll('[data-social-row]')].map((row) => ({
          platform: row.dataset.platform,
          label: row.querySelector('[data-key="label"]').value,
          handle: row.querySelector('[data-key="handle"]').value,
          url: row.querySelector('[data-key="url"]').value,
          enabled: row.querySelector('[data-key="enabled"]').checked,
        }));
        await put('/admin/settings/socials', { socials });
        await put('/admin/settings/contact', data);
      } else if (section === 'registration') {
        data.open = form.elements.open.checked;
        data.allowTeamCreation = form.elements.allowTeamCreation.checked;
        data.requireSchoolMatch = form.elements.requireSchoolMatch.checked;
        data.maxMembers = Number(data.maxMembers);
        data.minMembers = Number(data.minMembers);
        data.allowedSizes = String(data.allowedSizes || '')
          .split(',')
          .map((n) => Number(n.trim()))
          .filter((n) => Number.isInteger(n) && n >= 2 && n <= 8);
        await put('/admin/settings/registration', data);
      }
      toast('Settings saved. The public site now shows these values.', 'ok');
      body.querySelector('#settingsStamp').textContent = `Saved ${relative(new Date().toISOString())}`;
      await reload();
    } catch (error) {
      if (error.fields) applyFieldErrors(form, error.fields);
      toast(error.message, 'error');
    } finally {
      setBusy(submit, false);
    }
  });
}

function socialRow(social) {
  return `<div class="social-editor__row" data-social-row data-platform="${esc(social.platform)}">
    <span class="row" style="gap:.45rem;font-size:.8rem;font-weight:600">
      <span style="width:16px;height:16px;display:inline-block">${socialIcons[social.platform] || ''}</span>
      ${esc(social.label || social.platform)}
    </span>
    <input class="input" data-key="handle" value="${esc(social.handle || '')}" placeholder="@handle" aria-label="${esc(social.label)} handle">
    <input class="input" data-key="url" value="${esc(social.url || '')}" placeholder="https://…" aria-label="${esc(social.label)} URL">
    <label class="checkline" style="white-space:nowrap"><input type="checkbox" data-key="enabled" ${social.enabled ? 'checked' : ''}><span class="tiny">Show</span></label>
  </div>`;
}

/* --------------------------------------------------------------- exports */
function renderExports(body) {
  body.innerHTML = `
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Exports</h2><p class="panel__sub">Generated live from the database, not from browser storage.</p></div></div>
      <div class="stack">
        <div class="editor-item">
          <div class="editor-item__body">
            <p class="editor-item__title">Registrations</p>
            <p class="editor-item__meta">Every student with contact, field, team, role and timestamp. UTF-8 with BOM so Excel opens it correctly.</p>
          </div>
          <div class="editor-item__actions"><button class="btn btn--solid btn--sm" data-export="/admin/export/registrations.csv">Download CSV</button></div>
        </div>
        <div class="editor-item">
          <div class="editor-item__body">
            <p class="editor-item__title">Teams</p>
            <p class="editor-item__meta">Team name, school, field, capacity, leader and member names.</p>
          </div>
          <div class="editor-item__actions"><button class="btn btn--ghost btn--sm" data-export="/admin/export/teams.csv">Download CSV</button></div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Backups</h2></div></div>
      <p class="small ink2">If you are running on the embedded database, the whole dataset lives in <span class="mono">./data/pglite</span>.
      Copy that directory to back up. On Supabase/hosted PostgreSQL use the provider's automated backups, or
      <span class="mono">pg_dump "$DATABASE_URL" &gt; pmrs-backup.sql</span>.</p>
    </div>`;
  body.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => download(b.dataset.export)));
}

/* --------------------------------------------------------------- account */
function renderAccount(body) {
  body.innerHTML = `
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Administrator account</h2><p class="panel__sub">${esc(state.admin.email)}</p></div></div>
      <form class="form" id="adminPasswordForm">
        <div class="form-row">
          <div class="field"><label>Current password</label><input class="input" name="currentPassword" type="password" required><span class="field__error"></span></div>
          <div class="field"><label>New password</label><input class="input" name="newPassword" type="password" required minlength="8"><span class="field__hint">8+ characters, a letter and a number.</span><span class="field__error"></span></div>
        </div>
        <div class="form-actions"><button class="btn btn--solid" type="submit">Change password</button></div>
      </form>
    </div>
    <div class="panel">
      <div class="panel__head"><div><h2 class="panel__title">Security notes</h2></div></div>
      <ul class="stack stack--sm small ink2" style="padding-left:1rem">
        <li style="list-style:disc">Passwords are hashed with scrypt and a per-user salt.</li>
        <li style="list-style:disc">Sessions are HttpOnly, SameSite=Lax cookies backed by hashed tokens.</li>
        <li style="list-style:disc">The admin API rejects unauthenticated requests server-side; nothing is hidden only in CSS.</li>
        <li style="list-style:disc">Changing the password signs out every admin session.</li>
      </ul>
    </div>`;
  const form = body.querySelector('#adminPasswordForm');
  onSubmit(form, async (data) => {
    await post('/admin/password', {
      currentPassword: data.get('currentPassword'),
      newPassword: data.get('newPassword'),
    });
    toast('Password changed. Please sign in again.', 'ok');
    setTimeout(() => window.location.reload(), 900);
  });
}

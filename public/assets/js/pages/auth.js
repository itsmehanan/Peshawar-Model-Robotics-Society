import { post } from '../api.js';
import { state, setStudent } from '../store.js';
import { storeToken } from '../api.js';
import { esc, onSubmit, toast } from '../ui.js';

export function loginPage() {
  if (state.student) {
    return `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
      <span class="eyebrow eyebrow--plain">Signed in</span>
      <h1 class="display display--sm mt-2">You are already signed in.</h1>
      <p class="lede mt-2" style="margin-inline:auto">Hello ${esc(state.student.name)}.</p>
      <a class="btn btn--solid mt-2" href="#/dashboard" data-link>Open my dashboard</a>
    </div></section></div>`;
  }

  return `<div class="view auth-wrap">
    <div class="auth-panel">
      <div class="auth-panel__inner">
        <span class="eyebrow eyebrow--accent">Student sign in</span>
        <h1 class="display display--sm mt-2" style="font-size:clamp(2rem,3.4vw,2.7rem)">Welcome<br><em>back.</em></h1>
        <p class="small ink2 mt-1 mb-2">Sign in to see your entry, edit your profile and manage your team. Your
        registration is stored with your account — not in this browser — so it follows you to any device.</p>

        <form class="form" id="loginForm" novalidate>
          <div class="field">
            <label for="login-email">Email</label>
            <input class="input" id="login-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
            <span class="field__error"></span>
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Your password">
            <span class="field__error"></span>
          </div>
          <button class="btn btn--solid btn--lg btn--block" type="submit">Sign in <span class="btn__arrow" aria-hidden="true">↗</span></button>
        </form>

        <div class="divider-text mt-2">or</div>
        <div class="stack stack--sm mt-2">
          <a class="btn btn--ghost btn--block" href="#/register" data-link>Create a new registration</a>
          <a class="btn btn--quiet btn--block" href="#/admin" data-link>Organiser sign in</a>
        </div>
      </div>
    </div>
    <aside class="auth-art" aria-hidden="true">
      <div>
        <p class="auth-art__quote">“Nobody remembers the booth with the most expensive parts. Everybody remembers the team that could explain <em>why</em>.”</p>
        <p class="auth-art__cite">Judging notes, PMRS</p>
      </div>
    </aside>
  </div>`;
}

export function mountLogin(root, { navigate }) {
  const form = root.querySelector('#loginForm');
  if (!form) return;
  onSubmit(form, async (data) => {
    const result = await post('/login', { email: data.get('email'), password: data.get('password') });
    storeToken('student', result.sessionToken);
    setStudent(result.student);
    toast('Signed in.', 'ok');
    navigate('#/dashboard');
  });
}

/* --------------------------------------------------------------- welcome */
export function welcomePage() {
  const student = state.student;
  if (!student) {
    return `<div class="view"><section class="section"><div class="wrap wrap--narrow center">
      <h1 class="display display--sm">Registration complete.</h1>
      <a class="btn btn--solid mt-2" href="#/login" data-link>Sign in</a>
    </div></section></div>`;
  }
  const team = student.team;
  return `<div class="view">
    <section class="section">
      <div class="wrap wrap--narrow">
        <span class="eyebrow eyebrow--accent">Registration complete</span>
        <h1 class="display display--sm mt-2">You're on the list,<br><em>${esc(student.name.split(' ')[0])}.</em></h1>
        <p class="lede mt-2">Your entry is saved to our database. You will not see a registration button again on
        this account — everything you need is in your dashboard.</p>

        <div class="kv mt-3">
          <div><dt>Reference</dt><dd class="mono">${esc(student.id.slice(0, 8).toUpperCase())}</dd></div>
          <div><dt>Field</dt><dd>${esc(student.category?.name || '—')}</dd></div>
          <div><dt>Team</dt><dd>${esc(team?.name || 'Not assigned yet')}</dd></div>
          <div><dt>Role</dt><dd>${team ? (team.leaderId === student.id ? 'Team leader' : 'Team member') : 'Solo entry'}</dd></div>
        </div>

        ${
          team
            ? `<div class="callout callout--ok mt-2"><span class="callout__icon" aria-hidden="true">✓</span>
                <div>Your team <b>${esc(team.name)}</b> has ${team.memberCount} of ${team.maxMembers} places filled.
                ${team.seatsLeft > 0 ? `Share the passcode with ${team.seatsLeft} more classmate${team.seatsLeft === 1 ? '' : 's'} so they can join.` : 'Your team is complete.'}</div>
              </div>`
            : `<div class="callout callout--accent mt-2"><span class="callout__icon" aria-hidden="true">→</span>
                <div>You registered without a team. You can create one or join an existing team from your dashboard at any time.</div>
              </div>`
        }

        <div class="row mt-3">
          <a class="btn btn--solid" href="#/dashboard" data-link>Open my dashboard <span class="btn__arrow" aria-hidden="true">↗</span></a>
          <a class="btn btn--ghost" href="#/fields/${esc(student.categoryId)}" data-link>Read my field brief</a>
        </div>
        <p class="small muted mt-3">Bookmark this page? Your dashboard lives at <span class="mono">#/dashboard</span>.
        Sign in with ${esc(student.email)} on any device to reach it again.</p>
      </div>
    </section>
  </div>`;
}

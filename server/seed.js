/**
 * First-boot content. Everything here is editable from the admin panel after
 * installation — the seed only exists so the site is never empty.
 */
import { randomUUID } from 'node:crypto';

const uid = () => randomUUID();

export const DEFAULT_SETTINGS = {
  site: {
    // The organisation is the identity; an acronym alone tells a first-time
    // visitor nothing, so the full name always appears alongside it.
    name: 'PMRSDC',
    fullName: 'Peshawar Model Robotics Society — Dalazak Campus',
    campusName: 'Dalazak Campus',
    tagline: 'Innovate · Build · Compete',
    description:
      'The student robotics and engineering society of Peshawar Model School — where students design, build and compete with machines they made themselves.',
    logoMark: 'P',
    logoMarkDarkUrl: '/assets/pmrs-logo-dark.jpg',
    logoMarkLightUrl: '/assets/pmrs-logo-light.jpg',
    logoUrl: '',
    faviconUrl: '',
    metaDescription:
      'Peshawar Model Robotics Society — Dalazak Campus. Register your team, choose a field of entry and present the machine you built.',
    footerNote: 'Run by students, for students.',
  },
  event: {
    headline: 'Build something the future needs.',
    intro:
      'One day. Four fields. Students presenting machines they designed and built themselves. This is where school science stops being a worksheet and becomes something that moves.',
    kicker: 'Season 04 — 2026',
    dateLabel: 'Saturday, 14 March 2026',
    dateISO: '2026-03-14',
    doorsLabel: 'Gates open 09:00 · Judging 11:30 · Public viewing 14:00',
    venue: 'Peshawar Model School Auditorium',
    city: 'Peshawar, Pakistan',
    address: 'Peshawar Model School, Warsak Road, Peshawar',
    mapUrl: '',
    heroImageUrl: '',
    aboutTitle: 'An exhibition, not a competition of polish.',
    aboutBody:
      'PMRS began as a hallway table with three robots on it. Today it runs a full exhibition day: teams set up booths, present prototypes to judges, and explain their work to anyone who stops to ask a question.\n\nWe score the thinking, not the budget. A working cardboard mechanism that solves a real problem will always outrank a polished box that does nothing. Judges spend time with every team, ask two questions, and write comments you can keep.\n\nEvery participant leaves with feedback, a certificate, and at least one idea for next year.',
    // Deliberately describes the programme, not attendance: claimed exhibitor
    // and school counts were invented and would be a false claim to the public.
    stats: [
      { value: '04', label: 'Fields of entry' },
      { value: '02', label: 'Students minimum per team' },
      { value: '06', label: 'Students maximum per team' },
      { value: '01', label: 'Exhibition day' },
    ],
  },
  registration: {
    open: true,
    closedTitle: 'Registration is closed for this season.',
    closedMessage:
      'Team registration for this season has closed. Follow our social accounts or contact the organisers to be told when the next season opens.',
    deadlineLabel: 'Teams close on 28 February 2026',
    maxMembers: 4,
    minMembers: 2,
    allowedSizes: [2, 3, 4, 5, 6],
    requireSchoolMatch: true,
    categoryChangeMode: 'request',
  },
  announcement: {
    enabled: true,
  },
  contact: {
    email: 'hello@pmrs.pk',
    // Left blank on purpose: a placeholder number is worse than none. Fill these
    // in from Admin → Contact and the site shows them only once they are real.
    phone: '',
    whatsapp: '',
    organizerName: 'Peshawar Model Robotics Society',
    organizerRole: 'Organising committee',
    organiserBody:
      'Questions about eligibility, projects, accessibility or visiting the exhibition? Write to the coordination desk — a real person answers within two school days.',
    address: 'Peshawar Model School, Warsak Road, Peshawar, Pakistan',
    hours: 'Mon – Fri, 09:00 – 15:00',
  },
  // Every account starts empty. The site only renders a platform once an admin
  // has entered a real URL, so a fresh install never publishes a dead link.
  socials: [
    { platform: 'instagram', label: 'Instagram', handle: '', url: '', enabled: false },
    { platform: 'facebook', label: 'Facebook', handle: '', url: '', enabled: false },
    { platform: 'youtube', label: 'YouTube', handle: '', url: '', enabled: false },
    { platform: 'tiktok', label: 'TikTok', handle: '', url: '', enabled: false },
    { platform: 'linkedin', label: 'LinkedIn', handle: '', url: '', enabled: false },
    { platform: 'x', label: 'X', handle: '', url: '', enabled: false },
  ],
  footer: {
    credit: 'Peshawar Model Robotics Society',
    copyright: 'Peshawar Model Robotics Society',
  },
};

const CATEGORIES = [
  {
    id: 'robotics',
    name: 'Robotics & AI',
    symbol: '⌘',
    summary: 'Machines that sense, decide and move.',
    rules: 'Working prototype or a documented attempt. Remote controls are allowed; autonomy scores higher. Bring your own power source.',
    sort_order: 1,
  },
  {
    id: 'science',
    name: 'Science & Discovery',
    symbol: '✧',
    summary: 'Experiments that answer a question worth asking.',
    rules: 'A clear question, a method, and results — including the ones that did not work. Display boards welcome.',
    sort_order: 2,
  },
  {
    id: 'engineering',
    name: 'Engineering & Design',
    symbol: '⎔',
    summary: 'Structures and systems built to survive contact with reality.',
    rules: 'Show the design decision, the failure, and the fix. Load tests and stress tests may be run live at your booth.',
    sort_order: 3,
  },
  {
    id: 'technology',
    name: 'Future Technology',
    symbol: '⌁',
    summary: 'Software, hardware and ideas that change ordinary days.',
    rules: 'Working demos preferred over slideware. Screens, laptops and printed interfaces are all acceptable.',
    sort_order: 4,
  },
];

const ARTICLES = [
  {
    title: 'What judges actually look for at an exhibition',
    label: 'Field notes',
    excerpt:
      'Four judges, one afternoon, a hundred booths. Here is the short version of the rubric they carry — and the three mistakes almost every team makes.',
    body:
      'Every year we publish the judging rubric in advance, and every year the same three questions come back to us on the exhibition floor.\n\n## The rubric, plainly\n\nJudges score four things: the question your project tries to answer, the quality of the method, what you learned from the attempt, and how clearly you can explain it to someone who was not there while you built it.\n\nNothing else carries points — not the size of the model, not the number of components, not how much the display board cost.\n\n## Three avoidable mistakes\n\n**Explaining the object instead of the problem.** Visitors can see what the machine looks like. They cannot see the problem you found in your own life and decided to solve. Start there.\n\n**Hiding the failure.** The half of your project that did not work is usually the most interesting part of the booth. Put it on the table and label it.\n\n**Reading the board aloud.** Every team that reads their own display board out loud loses the room in twenty seconds. Talk to the visitor instead: ask them a question back.\n\nBring the thing itself. Bring the failure. Bring two sentences about why it matters.',
    read_minutes: 5,
    sort_order: 1,
  },
  {
    title: 'How to split the work in a four-person team',
    label: 'Team craft',
    excerpt:
      'Most broken teams are not full of lazy people. They are full of people who all did the same job. A simple division of labour that keeps a project moving.',
    body:
      'Teams rarely fail because someone did nothing. They fail because four people did the same thing at the same time and nobody counted the screws.\n\n## Four hats, not four skills\n\nRather than dividing by talent, divide by responsibility. One person owns the **build** — the physical object and the parts list. One owns the **brain** — code, wiring and the logic that makes it behave. One owns the **story** — the question, the poster, the five-sentence version of your project. One owns the **calendar** — packing, transport, deadlines, and the quiet job of noticing when the build is stuck.\n\n## Rotate once\n\nHalfway to exhibition day, swap hats for one afternoon. The build owner explains the code to the story owner. You will find the parts of your project that only one person understands — which is exactly the risk that sinks teams at the booth.\n\n## Write the handover down\n\nA single page: what works, what is broken, what is next, who is doing it. Teams that keep this page finish projects. Teams that keep it in their heads finish projects at 2am, badly.',
    read_minutes: 4,
    sort_order: 2,
  },
  {
    title: 'A booth that visitors walk towards',
    label: 'Exhibition design',
    excerpt:
      'You get about six seconds of a stranger’s attention. Here is how to spend them — and the two things that should never be behind your desk.',
    body:
      'An exhibition booth is a piece of communication design. It has one job: get a passing visitor to stop, look, and ask a question.\n\n## The six-second rule\n\nThe top third of your display should say what you built in six words or fewer. Not the title of the project — the thing it does. “A robot that waters plants while you are at school” beats “IoT-Based Automated Irrigation System (Phase II)”.\n\n## Put the object forward\n\nAnything working goes at the front of the table, at chest height, powered on. The laptop running your code is not the exhibit; it is the backup. Keep screens tilted towards the visitor, not away.\n\n## Leave a gap\n\nDo not stand behind the middle of your table. Stand to one side so a visitor can step into the gap and look at the work with you, instead of at you over a barrier.\n\n## The thing everyone forgets\n\nA laminated card with your team name, school, category, and one line about the project. Judges collect these. Visitors remember them. Cost: almost nothing.',
    read_minutes: 3,
    sort_order: 3,
  },
];

const FAQS = [
  {
    question: 'Who can take part?',
    answer:
      'Any student currently enrolled in a participating school may register, from grade 6 upwards. A team may be all from one school — mixed-school teams are not permitted, because judging is school-based.',
    sort_order: 1,
  },
  {
    question: 'How big can a team be?',
    answer:
      'Teams are between two and six students, with four recommended. The team leader creates the team, sets the team size, and shares the join code. Only the leader can change team details.',
    sort_order: 2,
  },
  {
    question: 'Can I change my category after registering?',
    answer:
      'If you are not yet in a team, you can change your field from your dashboard immediately. Once you are in a team you share the field with your teammates, so a change request is sent to the organisers, who approve it for the whole team — this keeps every exhibition table consistent.',
    sort_order: 3,
  },
  {
    question: 'What does it cost?',
    answer:
      'Entry is free for students. Schools are responsible for their own transport and materials. A limited number of build stipends is available — ask your coordinating teacher.',
    sort_order: 4,
  },
  {
    question: 'Do we need a finished product?',
    answer:
      'No. Judges are specifically instructed to reward process and reasoning. A well-documented prototype that only partly works is a stronger entry than a finished object nobody can explain.',
    sort_order: 5,
  },
];

const ADMIN_PLACEHOLDER = '!unset';

export async function seedDatabase(db) {
  /* settings ------------------------------------------------------------- */
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, JSON.stringify(value)],
    );
  }

  /* categories ----------------------------------------------------------- */
  const { rows: catCount } = await db.query('SELECT count(*)::int AS n FROM categories');
  if (!catCount[0]?.n) {
    for (const c of CATEGORIES) {
      await db.query(
        `INSERT INTO categories (id, name, symbol, summary, details, rules, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.symbol, c.summary, c.details ?? '', c.rules, c.sort_order],
      );
    }
  }

  /* articles ------------------------------------------------------------- */
  const { rows: artCount } = await db.query('SELECT count(*)::int AS n FROM articles');
  if (!artCount[0]?.n) {
    for (const a of ARTICLES) {
      await db.query(
        `INSERT INTO articles (id, title, slug, label, excerpt, body, read_minutes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uid(), a.title, slugify(a.title), a.label, a.excerpt, a.body, a.read_minutes, a.sort_order],
      );
    }
  }

  /* announcements -------------------------------------------------------- */
  const { rows: annCount } = await db.query('SELECT count(*)::int AS n FROM announcements');
  if (!annCount[0]?.n) {
    await db.query(
      `INSERT INTO announcements (id, title, body, level, link_label, link_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [
        uid(),
        'Team registration closes 28 February',
        'Leaders: your team needs at least two members to be scheduled for judging. Add them from your dashboard before the deadline.',
        'info',
        'Read the team guide',
        '',
      ],
    );
  }

  /* faqs ----------------------------------------------------------------- */
  const { rows: faqCount } = await db.query('SELECT count(*)::int AS n FROM faqs');
  if (!faqCount[0]?.n) {
    for (const f of FAQS) {
      await db.query('INSERT INTO faqs (id, question, answer, sort_order) VALUES ($1,$2,$3,$4)', [
        uid(),
        f.question,
        f.answer,
        f.sort_order,
      ]);
    }
  }
  return ADMIN_PLACEHOLDER;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70);
}

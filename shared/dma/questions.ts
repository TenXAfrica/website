import type {
  BuildType,
  Dimension,
  MaturityBand,
  Question,
} from './types';

/**
 * Weights sum to 100. Operations and data carry the most because that is
 * where the builds in catalogue/builds.md actually land.
 */
export const DIMENSION_META: Dimension[] = [
  {
    id: 'sales',
    label: 'Sales and customer handling',
    blurb: 'What happens between someone asking and someone buying.',
    weight: 20,
  },
  {
    id: 'operations',
    label: 'Operations and delivery',
    blurb: 'How the work gets done, tracked and handed over.',
    weight: 25,
  },
  {
    id: 'finance',
    label: 'Finance and admin',
    blurb: 'Invoicing, chasing, and the paperwork around the money.',
    weight: 15,
  },
  {
    id: 'people',
    label: 'People and communication',
    blurb: 'How work passes between people, and how new people start.',
    weight: 10,
  },
  {
    id: 'data',
    label: 'Data and systems',
    blurb: 'Where the records live and whether the tools talk to each other.',
    weight: 20,
  },
  {
    id: 'ai',
    label: 'AI readiness',
    blurb: 'Whether the business is in a position to use these tools safely.',
    weight: 10,
  },
];

export const BUILD_META: BuildType[] = [
  {
    id: 'intake_portal',
    label: 'Client intake and onboarding portal',
    summary:
      'One branded form flow that collects everything you need from a new client, files the documents, creates the records and tells you it is done.',
    size: 'medium',
    automationFactor: 0.7,
  },
  {
    id: 'quote_to_invoice',
    label: 'Quote-to-invoice automation',
    summary:
      'Quote from your price list, approve it, send the invoice, chase payment automatically, and see where every job stands.',
    size: 'medium',
    automationFactor: 0.75,
  },
  {
    id: 'ops_dashboard',
    label: 'Operations dashboard',
    summary:
      'One screen with the numbers you check daily, pulled from the tools you already use, so nobody has to ask for a status.',
    size: 'medium',
    automationFactor: 0.5,
  },
  {
    id: 'doc_generation',
    label: 'Document generation',
    summary:
      'Contracts, reports and letters built from your templates and live data, with an approval step before anything goes out.',
    size: 'small',
    automationFactor: 0.8,
  },
  {
    id: 'inbox_triage',
    label: 'Inbox triage and routing',
    summary:
      'Incoming email and form submissions read, classified, routed to the right person, and logged so nothing sits unanswered.',
    size: 'medium',
    automationFactor: 0.6,
  },
];

export const MATURITY_BANDS: MaturityBand[] = [
  {
    id: 'manual',
    label: 'Manual',
    min: 0,
    max: 24,
    meaning:
      'Most of the business runs on people remembering things. That is fragile, and it is also the easiest to fix — the first build usually pays for itself fastest here.',
  },
  {
    id: 'emerging',
    label: 'Emerging',
    min: 25,
    max: 44,
    meaning:
      'You have tools, but they are mostly places to type things twice. The win is joining them up rather than buying more.',
  },
  {
    id: 'connected',
    label: 'Connected',
    min: 45,
    max: 64,
    meaning:
      'The core systems are in place and people use them. The hours now leak at the handoffs between them.',
  },
  {
    id: 'streamlined',
    label: 'Streamlined',
    min: 65,
    max: 84,
    meaning:
      'Most routine work moves without being pushed. What is left is the judgement calls and the exceptions.',
  },
  {
    id: 'optimised',
    label: 'Optimised',
    min: 85,
    max: 100,
    meaning:
      'You are ahead of almost every business your size. The remaining gains are in decision support, not in admin.',
  },
];

/**
 * Twelve questions, two per dimension. Under three minutes on a phone.
 * Option order is always most manual (0) to most automated (4) so the
 * radio group reads as a scale.
 */
export const SELF_SERVE_QUESTIONS: Question[] = [
  /* ----------------------------- sales ----------------------------- */
  {
    id: 's1',
    dimension: 'sales',
    prompt: 'A new enquiry arrives. What happens next?',
    options: [
      {
        value: 's1a',
        label: 'It sits in a shared inbox until someone notices it',
        score: 0,
        builds: { inbox_triage: 3, intake_portal: 1 },
        signals: ['SLOW_RESPONSE', 'MANUAL_ADMIN'],
      },
      {
        value: 's1b',
        label: 'One person checks the inbox and replies by hand',
        score: 1,
        builds: { inbox_triage: 3 },
        signals: ['SLOW_RESPONSE'],
      },
      {
        value: 's1c',
        label: 'We copy it into a spreadsheet and reply by hand',
        score: 2,
        builds: { inbox_triage: 2, intake_portal: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 's1d',
        label: 'It goes into a CRM and we reply from a template',
        score: 3,
        builds: { intake_portal: 1 },
      },
      {
        value: 's1e',
        label: 'It is acknowledged, assigned and tracked to close automatically',
        score: 4,
      },
    ],
  },
  {
    id: 's2',
    dimension: 'sales',
    prompt: 'How do you put a quote or proposal together?',
    options: [
      {
        value: 's2a',
        label: 'From scratch in Word or email, every time',
        score: 0,
        builds: { doc_generation: 3, quote_to_invoice: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 's2b',
        label: 'We find the last similar one and edit it',
        score: 1,
        builds: { doc_generation: 3, quote_to_invoice: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 's2c',
        label: 'We fill in a template by hand',
        score: 2,
        builds: { doc_generation: 2, quote_to_invoice: 1 },
      },
      {
        value: 's2d',
        label: 'It is generated from a price list, then sent manually',
        score: 3,
        builds: { quote_to_invoice: 1 },
      },
      {
        value: 's2e',
        label: 'Generated, approved and sent from one system',
        score: 4,
      },
    ],
  },

  /* --------------------------- operations -------------------------- */
  {
    id: 'o1',
    dimension: 'operations',
    prompt: 'How do you find out where a job has got to?',
    options: [
      {
        value: 'o1a',
        label: 'Ask the person doing it',
        score: 0,
        builds: { ops_dashboard: 3 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'o1b',
        label: 'Look at a spreadsheet somebody keeps up to date',
        score: 1,
        builds: { ops_dashboard: 3 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'o1c',
        label: 'Check a shared board that people move cards on',
        score: 2,
        builds: { ops_dashboard: 2 },
      },
      {
        value: 'o1d',
        label: 'A system shows status, but someone has to update it',
        score: 3,
        builds: { ops_dashboard: 1 },
      },
      {
        value: 'o1e',
        label: 'Status updates itself as the work moves',
        score: 4,
      },
    ],
  },
  {
    id: 'o2',
    dimension: 'operations',
    prompt:
      'Across the whole business, how many hours a week go on repeat admin?',
    help: 'Copying data between tools, chasing people, re-typing the same information.',
    options: [
      {
        value: 'o2a',
        label: 'More than 15 hours',
        score: 0,
        hoursPerWeek: 20,
        builds: { ops_dashboard: 2, inbox_triage: 2, intake_portal: 2 },
        signals: ['MANUAL_ADMIN', 'HIRING_ADMIN'],
      },
      {
        value: 'o2b',
        label: '10 to 15 hours',
        score: 1,
        hoursPerWeek: 12.5,
        builds: { ops_dashboard: 2, inbox_triage: 1, intake_portal: 1 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'o2c',
        label: '5 to 10 hours',
        score: 2,
        hoursPerWeek: 7.5,
        builds: { ops_dashboard: 1 },
      },
      {
        value: 'o2d',
        label: '2 to 5 hours',
        score: 3,
        hoursPerWeek: 3.5,
      },
      {
        value: 'o2e',
        label: 'Under 2 hours',
        score: 4,
        hoursPerWeek: 1,
      },
    ],
  },

  /* ---------------------------- finance ---------------------------- */
  {
    id: 'f1',
    dimension: 'finance',
    prompt: 'How do invoices get raised and chased?',
    options: [
      {
        value: 'f1a',
        label: 'By hand, and we sometimes forget to chase',
        score: 0,
        builds: { quote_to_invoice: 4 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'f1b',
        label: 'By hand, and someone chases every week',
        score: 1,
        builds: { quote_to_invoice: 3 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'f1c',
        label: 'In accounting software, typed in from the job details',
        score: 2,
        builds: { quote_to_invoice: 2 },
      },
      {
        value: 'f1d',
        label: 'Accounting software linked to jobs, reminders sent by hand',
        score: 3,
        builds: { quote_to_invoice: 1 },
      },
      {
        value: 'f1e',
        label: 'Raised and chased automatically',
        score: 4,
      },
    ],
  },
  {
    id: 'f2',
    dimension: 'finance',
    prompt: 'From the work being finished, how long until the invoice goes out?',
    options: [
      {
        value: 'f2a',
        label: 'More than two weeks, or whenever we get to it',
        score: 0,
        builds: { quote_to_invoice: 3 },
        signals: ['MANUAL_ADMIN'],
      },
      { value: 'f2b', label: 'About two weeks', score: 1, builds: { quote_to_invoice: 2 } },
      { value: 'f2c', label: 'About a week', score: 2, builds: { quote_to_invoice: 1 } },
      { value: 'f2d', label: 'A day or two', score: 3 },
      { value: 'f2e', label: 'Same day, automatically', score: 4 },
    ],
  },

  /* ----------------------------- people ---------------------------- */
  {
    id: 'p1',
    dimension: 'people',
    prompt: 'How does work get handed from one person to the next?',
    options: [
      {
        value: 'p1a',
        label: 'A word in passing, a WhatsApp, or an email',
        score: 0,
        builds: { inbox_triage: 2, ops_dashboard: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'p1b',
        label: 'Email, with a spreadsheet updated afterwards',
        score: 1,
        builds: { ops_dashboard: 2, inbox_triage: 1 },
      },
      {
        value: 'p1c',
        label: 'A shared board or task list',
        score: 2,
        builds: { ops_dashboard: 1 },
      },
      { value: 'p1d', label: 'A system assigns it, with a manual nudge', score: 3 },
      { value: 'p1e', label: 'The system routes and notifies on its own', score: 4 },
    ],
  },
  {
    id: 'p2',
    dimension: 'people',
    prompt: 'What happens when you take on a new client?',
    options: [
      {
        value: 'p2a',
        label: 'A run of emails and calls, different every time',
        score: 0,
        builds: { intake_portal: 4 },
        signals: ['MANUAL_ADMIN', 'NO_BOOKING'],
      },
      {
        value: 'p2b',
        label: 'We work off a checklist someone keeps',
        score: 1,
        builds: { intake_portal: 3 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'p2c',
        label: 'A form or document pack we send and chase',
        score: 2,
        builds: { intake_portal: 2 },
      },
      {
        value: 'p2d',
        label: 'An online form that files itself, with manual follow-up',
        score: 3,
        builds: { intake_portal: 1 },
      },
      {
        value: 'p2e',
        label: 'A portal that collects, validates and files everything',
        score: 4,
      },
    ],
  },

  /* ------------------------------ data ----------------------------- */
  {
    id: 'd1',
    dimension: 'data',
    prompt: 'Where do your customer records actually live?',
    options: [
      {
        value: 'd1a',
        label: 'In people’s heads and their email',
        score: 0,
        builds: { intake_portal: 2, ops_dashboard: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'd1b',
        label: 'Spreadsheets on different machines',
        score: 1,
        builds: { intake_portal: 2, ops_dashboard: 2 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'd1c',
        label: 'One shared spreadsheet everyone edits',
        score: 2,
        builds: { ops_dashboard: 1, intake_portal: 1 },
      },
      {
        value: 'd1d',
        label: 'A CRM, plus some spreadsheets on the side',
        score: 3,
        builds: { ops_dashboard: 1 },
      },
      { value: 'd1e', label: 'One system, and it is the single source', score: 4 },
    ],
  },
  {
    id: 'd2',
    dimension: 'data',
    prompt: 'Do your main tools pass information to each other?',
    options: [
      {
        value: 'd2a',
        label: 'No. Everything is re-typed between them',
        score: 0,
        builds: { ops_dashboard: 3, quote_to_invoice: 2, intake_portal: 1 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'd2b',
        label: 'We export and import files now and then',
        score: 1,
        builds: { ops_dashboard: 3, quote_to_invoice: 1 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'd2c',
        label: 'One or two are connected, the rest are not',
        score: 2,
        builds: { ops_dashboard: 2 },
      },
      { value: 'd2d', label: 'Most are connected, with some gaps', score: 3, builds: { ops_dashboard: 1 } },
      { value: 'd2e', label: 'They are joined up end to end', score: 4 },
    ],
  },

  /* ------------------------------- ai ------------------------------ */
  {
    id: 'a1',
    dimension: 'ai',
    prompt: 'Has anyone in the business used AI tools for real work?',
    options: [
      { value: 'a1a', label: 'No, not yet', score: 0 },
      { value: 'a1b', label: 'One or two people have tried it privately', score: 1 },
      { value: 'a1c', label: 'A few people use it for drafting, informally', score: 2 },
      { value: 'a1d', label: 'We use it regularly for specific tasks', score: 3 },
      { value: 'a1e', label: 'It is built into how we work, with rules about what is allowed', score: 4 },
    ],
  },
  {
    id: 'a2',
    dimension: 'ai',
    prompt: 'Could someone new follow your processes from what is written down?',
    help: 'Automation can only take over work that somebody can describe.',
    options: [
      {
        value: 'a2a',
        label: 'Nothing is written down',
        score: 0,
        builds: { doc_generation: 2, intake_portal: 1 },
        signals: ['MANUAL_ADMIN'],
      },
      {
        value: 'a2b',
        label: 'A few notes, mostly out of date',
        score: 1,
        builds: { doc_generation: 2 },
      },
      { value: 'a2c', label: 'The main processes are written down', score: 2, builds: { doc_generation: 1 } },
      { value: 'a2d', label: 'Written down and mostly followed', score: 3 },
      { value: 'a2e', label: 'Documented, followed, and kept current', score: 4 },
    ],
  },
];

/**
 * The guided DMA asks five questions per dimension. Each one is captured
 * against the same six fields (current, tools, owner, hoursPerWeek, pain,
 * maturity) so the processor can compare like for like. The maturity
 * anchors live in dma/rubric.md.
 */
export const FULL_DMA_QUESTIONS: Question[] = [
  ...prompts('sales', [
    'How does a new enquiry reach you, and what happens in the first hour?',
    'How do you decide whether an enquiry is worth pursuing?',
    'Walk me through producing a quote for a typical job.',
    'What happens between sending a quote and getting a yes?',
    'How do you know, today, what is in your pipeline and what it is worth?',
  ]),
  ...prompts('operations', [
    'Name the five to seven processes that actually run this business.',
    'Take the one that hurts most. Walk me through it end to end.',
    'Where does work wait, and what is it waiting for?',
    'Where does the same information get typed in more than once?',
    'What breaks when the person who normally does it is away?',
  ]),
  ...prompts('finance', [
    'How does a finished job become an invoice?',
    'How do you chase unpaid invoices, and who does it?',
    'How do you know what you are owed right now?',
    'What admin sits around payroll, suppliers and expenses?',
    'What reporting do you produce, for whom, and how long does it take?',
  ]),
  ...prompts('people', [
    'How does work pass between people, and where does it get dropped?',
    'What happens in a new client’s first week with you?',
    'What happens in a new employee’s first week?',
    'Which decisions need a human, and which follow a rule?',
    'What would you stop doing tomorrow if you could?',
  ]),
  ...prompts('data', [
    'Where do customer records live, and who is allowed to touch them?',
    'List every tool the business pays for and what it is used for.',
    'Which tools talk to each other, and which do not?',
    'Where do documents and files live, and how are they named?',
    'What compliance, privacy or security constraints apply to you?',
  ]),
  ...prompts('ai', [
    'What has been tried with automation or AI before, and why did it stop?',
    'What is your appetite for something running without a person checking it?',
    'Who would own a new system day to day once we hand it over?',
    'What is the baseline number we should be trying to beat?',
    'What would have to be true in six months for this to have been worth it?',
  ]),
];

function prompts(dimension: Question['dimension'], list: string[]): Question[] {
  return list.map((prompt, i) => ({
    id: `${dimension}-${i + 1}`,
    dimension,
    prompt,
    options: [],
  }));
}

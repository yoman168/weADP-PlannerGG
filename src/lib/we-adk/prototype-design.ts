/**
 * The canvas design behind each prototype html file.
 *
 * Preview shows the screen as it is built; Design shows what it is built from —
 * the same blocks the Sketcher palette offers, carrying the screen's own labels,
 * columns and rows so the canvas reads as that screen rather than as a generic
 * wireframe. Opening a file's Design tab for the first time seeds the canvas
 * from here; after that the canvas is the user's, and whatever they save wins.
 *
 * Generated from the screens under `src/app/eacc/…`; if a screen changes its
 * columns or its actions, update its entry here to match.
 */
import {
  createBlock,
  type BlockKind,
  type BlockProps,
  type CanvasBlock,
} from '@/lib/we-adk-mock/sketcher';
import { findPrototypeFile } from './prototype';

interface DesignBlock {
  kind: BlockKind;
  props?: BlockProps;
}

const DESIGNS: Record<string, DesignBlock[]> = {
  login: [
    {
      kind: 'screenHeader',
      props: {
        label: 'eACC Cloud',
        subtitle: 'Sign in to your workspace',
      },
    },
    {
      kind: 'input',
      props: {
        label: 'Email',
        placeholder: 'you@company.com',
        width: 0,
      },
    },
    {
      kind: 'input',
      props: {
        label: 'Password',
        placeholder: '••••••••',
        width: 0,
      },
    },
    {
      kind: 'checkbox',
      props: {
        label: 'Remember me',
        checked: true,
      },
    },
    {
      kind: 'buttonBar',
      props: {
        align: 'left',
        buttons: [
          {
            label: 'Sign in',
            variant: 'default',
          },
          {
            label: 'Forgot password?',
            variant: 'link',
          },
        ],
      },
    },
    {
      kind: 'divider',
      props: {},
    },
    {
      kind: 'buttonBar',
      props: {
        align: 'left',
        buttons: [
          {
            label: 'Continue with company SSO',
            variant: 'outline',
          },
        ],
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'JWT · HS256 · 24h session · SSO deferred to phase 2',
      },
    },
  ],
  dashboard: [
    {
      kind: 'screenHeader',
      props: {
        label: 'Dashboard',
        subtitle: 'July 2026 · Taehyuk Park (Accountant)',
        showActions: true,
        buttons: [
          {
            label: 'Go to close status',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'statCards',
      props: {
        pairs: [
          {
            key: 'July spend',
            value: '₩48,720,400',
            tone: 'blue',
            note: '+8.2%',
          },
          {
            key: 'Waiting on me',
            value: '12',
            tone: 'amber',
            note: '4 overdue',
          },
          {
            key: 'Closed this month',
            value: '187 / 234',
            tone: 'green',
          },
          {
            key: 'Blocked items',
            value: '8',
            tone: 'red',
            note: '+2 today',
          },
        ],
      },
    },
    {
      kind: 'taskList',
      props: {
        label: 'What needs me',
        pairs: [
          {
            key: '8 items blocking the close',
            value: 'Missing evidence in Operations and R&D',
            note: 'Due 2026-08-05',
            tone: 'red',
          },
          {
            key: '12 corporate card charges to approve',
            value: 'July 2026 · ₩3,684,900',
            note: 'Due 2026-08-02',
            tone: 'amber',
          },
          {
            key: '4 personal expenses returned',
            value: 'Waiting on the submitter to fix and resend',
            note: 'No deadline',
            tone: 'blue',
          },
        ],
      },
    },
    {
      kind: 'metricBars',
      props: {
        label: 'Spend by category',
        pairs: [
          {
            key: 'Software',
            value: '₩16,564,000',
            progress: 34,
          },
          {
            key: 'Travel',
            value: '₩13,154,500',
            progress: 27,
          },
          {
            key: 'Food & Beverage',
            value: '₩7,795,300',
            progress: 16,
          },
          {
            key: 'Office Supplies',
            value: '₩6,333,700',
            progress: 13,
          },
          {
            key: 'Other',
            value: '₩4,872,900',
            progress: 10,
          },
        ],
      },
    },
    {
      kind: 'timeline',
      props: {
        label: 'Recent activity',
        pairs: [
          {
            key: 'Corporate card · Amazon Web Services — ₩1,240,000',
            value: 'Kim Minsu · 10 min ago',
          },
          {
            key: 'Cash receipt · Stationery World Co. — ₩128,000',
            value: 'Kim Minsu · 1 hour ago',
          },
          {
            key: 'Personal expense · Client dinner — ₩186,000',
            value: 'Lee Jiyeon · 3 hours ago',
          },
          {
            key: 'Corporate card · Korean Air — ₩1,820,000',
            value: 'Shin Hyunjung · Yesterday',
          },
        ],
      },
    },
  ],
  'close-status': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Month-end Close Status',
        subtitle: 'July 2026 · Closing deadline: 2026-08-05',
        showActions: true,
        buttons: [
          {
            label: 'Refresh',
            variant: 'outline',
          },
          {
            label: 'Print',
            variant: 'outline',
          },
          {
            label: 'Export PDF',
            variant: 'outline',
          },
          {
            label: 'View Blockers',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'statCards',
      props: {
        pairs: [
          {
            key: 'Total to Process',
            value: '234',
            tone: 'blue',
          },
          {
            key: 'Completed',
            value: '187',
            tone: 'green',
            note: '+12 today',
          },
          {
            key: 'Remaining',
            value: '47',
            tone: 'amber',
          },
          {
            key: 'Blocked',
            value: '8',
            tone: 'red',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        label: 'By Cost Centre',
        columns: ['Cost Centre', 'Total', 'Progress', 'Status', 'Responsible', 'Last Activity', ''],
        data: [
          [
            'IT & Infrastructure',
            '52',
            '96%',
            '2 remaining',
            'Kim Minsu',
            '2026-07-31 14:22',
            'View',
          ],
          [
            'Finance & Accounting  2 blocked',
            '38',
            '89%',
            '4 remaining',
            'Lee Jiyeon',
            '2026-07-31 11:05',
            'View',
          ],
          [
            'Human Resources  1 blocked',
            '29',
            '72%',
            '8 remaining',
            'Choi Dongwook',
            '2026-07-31 09:48',
            'View',
          ],
          [
            'Operations  3 blocked',
            '44',
            '45%',
            '24 remaining',
            'Park Seongmin',
            '2026-07-30 17:30',
            'View',
          ],
          [
            'Sales & Marketing',
            '31',
            '90%',
            '3 remaining',
            'Jung Minjae',
            '2026-07-31 13:15',
            'View',
          ],
          ['R&D  1 blocked', '22', '82%', '4 remaining', 'Yoo Namwon', '2026-07-30 16:00', 'View'],
          [
            'Legal & Compliance  1 blocked',
            '18',
            '89%',
            '2 remaining',
            'Shin Hyunjung',
            '2026-07-31 10:22',
            'View',
          ],
        ],
        showHeader: true,
      },
    },
  ],
  'close-blockers': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Close Blockers by Cost Centre',
        subtitle: 'Items preventing the July 2026 month-end close',
        showActions: false,
      },
    },
    {
      kind: 'banner',
      props: {
        label: '44 items blocked',
        tone: 'danger',
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search cost centres, responsible…',
          },
          {
            type: 'select',
            label: 'Priority',
            options: ['All priorities', 'High', 'Medium', 'Low'],
            activeIndex: 0,
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        columns: [
          'Cost Centre',
          'Category',
          'Count',
          'Oldest (days)',
          'Responsible',
          'Priority',
          'Note',
          '',
        ],
        data: [
          [
            'Operations',
            'Corporate Card',
            '12',
            '8d',
            'Park Seongmin',
            'High',
            'Bulk approve not yet submitted',
            'Remind',
          ],
          ['Operations', 'Personal Expense', '6', '5d', 'Park Seongmin', 'High', '—', 'Remind'],
          ['Operations', 'Tax Invoice', '4', '3d', 'Park Seongmin', 'Medium', '—', 'Remind'],
          [
            'Finance & Accounting',
            'Personal Expense',
            '7',
            '6d',
            'Lee Jiyeon',
            'High',
            'Pending manager approval',
            'Remind',
          ],
          [
            'Finance & Accounting',
            'Corporate Card',
            '3',
            '2d',
            'Lee Jiyeon',
            'Medium',
            '—',
            'Remind',
          ],
          [
            'Human Resources',
            'Tax Invoice',
            '5',
            '4d',
            'Choi Dongwook',
            'Medium',
            'Supplier CEO column data missing',
            'Remind',
          ],
          ['R&D', 'Cash Receipt', '4', '7d', 'Yoo Namwon', 'High', '—', 'Remind'],
          [
            'Legal & Compliance',
            'Personal Expense',
            '3',
            '3d',
            'Shin Hyunjung',
            'Low',
            '—',
            'Remind',
          ],
        ],
        showHeader: true,
        label: '',
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'Showing 8 of 8 blockers',
      },
    },
  ],
  'corporate-card': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Corporate Card',
        subtitle: 'Corporate Card > Corporate Card',
        showActions: true,
        buttons: [
          {
            label: 'Export',
            variant: 'outline',
          },
          {
            label: 'New Charge',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search user, merchant…',
          },
          {
            type: 'select',
            options: ['July 2026', 'June 2026'],
            activeIndex: 0,
          },
          {
            type: 'select',
            options: ['All statuses', 'Draft', 'In review', 'Approved', 'Rejected'],
            activeIndex: 1,
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        label: 'Card Transaction Table',
        columns: [
          'Select',
          'Date',
          'User',
          'Department',
          'Merchant',
          'Category',
          'Amount (₩)',
          'Card No.',
          'Status',
        ],
        data: [
          [
            '',
            '2026-07-31',
            'Kim Minsu',
            'IT',
            '스타벅스',
            'Food & Beverage',
            '25,500',
            '****9901',
            'Draft',
          ],
          [
            '',
            '2026-07-31',
            'Kim Minsu',
            'IT',
            'Amazon Web Services',
            'Software',
            '1,240,000',
            '****9901',
            'Draft',
          ],
          [
            '',
            '2026-07-30',
            'Lee Jiyeon',
            'Finance',
            '올리브영',
            'Health',
            '68,900',
            '****3820',
            'Draft',
          ],
          [
            '',
            '2026-07-30',
            'Park Seongmin',
            'Operations',
            'Korea Gas Corp',
            'Utilities',
            '340,000',
            '****5531',
            'Draft',
          ],
          [
            '',
            '2026-07-29',
            'Choi Dongwook',
            'HR',
            'GS25',
            'Food & Beverage',
            '12,400',
            '****7742',
            'Draft',
          ],
          ['Total (5 transactions)', '', '', '', '', '', '₩1,686,800', '', ''],
        ],
        showHeader: true,
      },
    },
  ],
  'corporate-card-bulk-approve': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Bulk Approve — July 2026',
        subtitle: 'Corporate Card > Bulk Approve',
        showActions: true,
        buttons: [
          {
            label: 'Approve 2 batches',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'select',
            label: 'Month',
            options: ['July 2026', 'June 2026'],
            activeIndex: 0,
          },
          {
            type: 'checkbox',
            label: 'Skip batches with missing evidence',
            checked: true,
          },
        ],
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'Approval is per calendar month — the whole month goes through together.',
      },
    },
    {
      kind: 'table',
      props: {
        label: 'Department Batches',
        columns: [
          'Select',
          'Department',
          'Card owner',
          'Charges',
          'Amount (₩)',
          'Missing evidence',
        ],
        data: [
          ['', 'IT', 'Kim Minsu', '24', '3,820,400', '—'],
          ['', 'Finance', 'Lee Jiyeon', '18', '1,284,900', '2'],
          ['', 'Operations', 'Park Seongmin', '31', '5,640,000', '—'],
          ['', 'HR', 'Choi Dongwook', '9', '412,300', '1'],
          ['', 'Sales', 'Jung Minjae', '27', '2,910,500', '—'],
          ['', 'R&D', 'Yoo Namwon', '14', '1,760,000', '3'],
        ],
        showHeader: true,
      },
    },
    {
      kind: 'statCards',
      props: {
        pairs: [
          {
            key: 'Batches selected',
            value: '2',
            tone: 'blue',
          },
          {
            key: 'Charges',
            value: '55',
            tone: 'neutral',
          },
          {
            key: 'Total amount',
            value: '₩9,460,400',
            tone: 'green',
          },
        ],
      },
    },
    {
      kind: 'buttonBar',
      props: {
        align: 'right',
        buttons: [
          {
            label: 'Approve selected',
            variant: 'default',
          },
        ],
      },
    },
  ],
  'personal-expense': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Personal Expense',
        subtitle: 'Personal Expense > Personal Expense',
        showActions: true,
        buttons: [
          {
            label: 'Export',
            variant: 'outline',
          },
          {
            label: 'New Expense',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'statusTabs',
      props: {
        tabs: [
          {
            label: 'All expenses',
            count: 0,
          },
          {
            label: 'My expenses',
            count: 0,
          },
          {
            label: 'Returned to me',
            count: 3,
          },
        ],
        activeIndex: 0,
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search user, category, purpose…',
          },
          {
            type: 'select',
            options: [
              'All statuses',
              'Draft',
              'Submitted',
              'In approval',
              'Approved',
              'Rejected',
              'Returned',
            ],
            activeIndex: 0,
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        columns: [
          'Date',
          'User',
          'Department',
          'Category',
          'Purpose',
          'Amount (₩)',
          'Receipt',
          'Status',
        ],
        data: [
          [
            '2026-07-31',
            'Kim Minsu',
            'IT',
            'Transport',
            'Bus card recharge',
            '50,000',
            '✓',
            'Draft',
          ],
          [
            '2026-07-30',
            'Lee Jiyeon',
            'Finance',
            'Meals',
            'Team lunch',
            '180,000',
            '✓',
            'Submitted',
          ],
          [
            '2026-07-30',
            'Park Seongmin',
            'Operations',
            'Transport',
            'Taxi to airport',
            '45,000',
            '✓',
            'In approval',
          ],
          [
            '2026-07-29',
            'Choi Dongwook',
            'HR',
            'Office',
            'Printer paper',
            '28,000',
            '✓',
            'Approved',
          ],
          [
            '2026-07-28',
            'Jung Minjae',
            'Sales',
            'Entertainment',
            'Client dinner',
            '320,000',
            '✗',
            'Rejected',
          ],
          [
            '2026-07-27',
            'Yoo Namwon',
            'R&D',
            'Books',
            'Tech conference book',
            '42,000',
            '✓',
            'Returned',
          ],
          ['Total (10 expenses)', '', '', '', '', '895,800', '', ''],
        ],
        label: '',
      },
    },
  ],
  'personal-expense-detail': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Expense Report — July week 5',
        subtitle: 'Personal Expense > EXP-2026-00412',
        showActions: true,
        buttons: [
          {
            label: 'Resubmit',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'banner',
      props: {
        label: 'Returned to you',
        helpText:
          'The office supplies line has no receipt attached. Please add it and resubmit — the dinner and taxi are fine.  ·  Park Taehyuk (Accountant) · 2026-07-30 09:12',
        tone: 'warning',
      },
    },
    {
      kind: 'formGrid',
      props: {
        pairs: [
          {
            key: 'Title',
            value: 'July week 5',
          },
          {
            key: 'Period',
            value: '2026-07-27 ~ 2026-07-31',
          },
          {
            key: 'Cost centre',
            value: 'Finance & Accounting',
          },
          {
            key: 'Payout account',
            value: 'KB 123456-01-789012',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        label: 'Expense lines',
        columns: ['Date', 'Category', 'Purpose', 'Amount (₩)', 'Receipt', ''],
        data: [
          ['2026-07-28', 'Meals', 'Client dinner — Visionlyu', '186,000', 'Attached', ''],
          ['2026-07-28', 'Transport', 'Taxi back to office', '18,400', 'Attached', ''],
          ['2026-07-29', 'Office', 'Notebook and pens', '24,000', 'Attach', ''],
          ['Total (3 lines)', '', '', '₩228,400', '1 without a receipt', ''],
        ],
      },
    },
    {
      kind: 'textarea',
      props: {
        label: 'Comment to the accountant',
        placeholder: 'Receipt for the office supplies is attached now.',
      },
    },
  ],
  'tax-invoice': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Purchase Tax Invoice',
        subtitle: 'Purchase Tax Invoice > Purchase Tax Invoice',
        showActions: true,
        buttons: [
          {
            label: 'Export',
            variant: 'outline',
          },
          {
            label: 'New Invoice',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search supplier, invoice no…',
          },
          {
            type: 'select',
            options: ['All statuses', 'Draft', 'Submitted', 'Approved', 'Rejected'],
            activeIndex: 0,
          },
          {
            type: 'select',
            options: ['All types', 'Tax invoice', 'Invoice', 'Revised tax invoice'],
            activeIndex: 0,
          },
          {
            type: 'dateRange',
            label: 'Current month',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        columns: [
          'Date',
          'Supplier',
          'Business No.',
          'Amount (₩)',
          'Tax (₩)',
          'Type',
          'Invoice No.',
          'Status',
          'Submitted By',
        ],
        data: [
          [
            '2026-07-27',
            'LG Vendor',
            '111',
            '2,080,579',
            '189,143',
            'Invoice',
            'INV-2026-00834',
            'Draft',
            'Kim Minsu',
          ],
          [
            '2026-07-27',
            'Visionlyu Co., Ltd.',
            '2208195788',
            '100',
            '9',
            'Invoice',
            'INV-2026-00833',
            'Draft',
            'Lee Jiyeon',
          ],
          [
            '2026-07-23',
            'Visionlyu Co., Ltd.',
            '2208195788',
            '943',
            '85',
            'Tax invoice',
            'TAX-2026-00819',
            'Submitted',
            'Park Seongmin',
          ],
          [
            '2026-07-06',
            'iBeeree Inc.',
            '2148733800',
            '-319,000',
            '-29,000',
            'Revised tax invoice',
            'RTAX-2026-00741',
            'Approved',
            'Choi Dongwook',
          ],
          [
            '2026-07-03',
            'The Office Garden Co.',
            '1058633625',
            '728,200',
            '66,200',
            'Tax invoice',
            'TAX-2026-00716',
            'Approved',
            'Moon Namwon',
          ],
          [
            '2026-06-15',
            'Naver Corp',
            '2208200455',
            '380,000',
            '34,545',
            'Tax invoice',
            'TAX-2026-00602',
            'Rejected',
            'Shin Hyunjung',
          ],
          ['Total (10 invoices)', '', '', '4,932,476', '448,404', '', '', '', ''],
        ],
        showHeader: true,
        label: '',
      },
    },
  ],
  'cash-receipt': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Cash Receipt',
        subtitle: 'Cash Receipt > Cash Receipt',
        showActions: true,
        buttons: [
          {
            label: 'Export',
            variant: 'outline',
          },
          {
            label: 'New Receipt',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search receipt no, supplier…',
          },
          {
            type: 'select',
            options: ['All statuses', 'Draft', 'Submitted', 'Approved', 'Rejected'],
            activeIndex: 0,
          },
          {
            type: 'dateRange',
            label: '2026-07-01 ~ 2026-07-31',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        columns: [
          'Receipt No.',
          'Date',
          'Supplier',
          'Business No.',
          'Purpose',
          'Amount (₩)',
          'Tax',
          'Status',
          'Submitted By',
        ],
        data: [
          [
            'RCP-2026-00187',
            '2026-07-31',
            'Stationery World Co.',
            '1108734521',
            'Office supplies',
            '128,000',
            '11,636',
            'Draft',
            'Kim Minsu',
          ],
          [
            'RCP-2026-00186',
            '2026-07-30',
            'Korea Telecom',
            '1028611944',
            'Phone bill July',
            '45,000',
            '4,090',
            'Submitted',
            'Lee Jiyeon',
          ],
          [
            'RCP-2026-00185',
            '2026-07-30',
            'Kakao Mobility',
            '2648733920',
            'Taxi — client visit',
            '23,400',
            '2,127',
            'Approved',
            'Park Seongmin',
          ],
          [
            'RCP-2026-00184',
            '2026-07-29',
            'GS25 Convenience',
            '1218854032',
            'Team refreshments',
            '87,300',
            '7,936',
            'Draft',
            'Choi Dongwook',
          ],
          [
            'RCP-2026-00183',
            '2026-07-28',
            'Woori Printing',
            '2048711620',
            'Presentation printing',
            '54,000',
            '4,909',
            'Approved',
            'Jung Minjae',
          ],
          [
            'RCP-2026-00180',
            '2026-07-26',
            'The Office Garden Co.',
            '1058633625',
            'Cleaning service',
            '728,200',
            '66,200',
            'Rejected',
            'Park Taehyuk',
          ],
          ['Total (10 items)', '', '', '', '', '3,807,479', '', '', ''],
        ],
        showHeader: true,
        label: '',
      },
    },
  ],
  'cash-receipt-detail': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Cash Receipt Detail',
        subtitle: 'Cash Receipt > RCP-2026-00187',
        showActions: true,
        buttons: [
          {
            label: 'Print',
            variant: 'outline',
          },
          {
            label: 'Export',
            variant: 'outline',
          },
        ],
      },
    },
    {
      kind: 'badgeRow',
      props: {
        badges: ['Draft'],
        tone: 'secondary',
      },
    },
    {
      kind: 'keyValue',
      props: {
        label: 'Receipt',
        pairs: [
          {
            key: 'Receipt No.',
            value: 'RCP-2026-00187',
          },
          {
            key: 'Date',
            value: '2026-07-31',
          },
          {
            key: 'Supplier',
            value: 'Stationery World Co.',
          },
          {
            key: 'Business No.',
            value: '1108734521',
          },
          {
            key: 'Purpose',
            value: 'Office supplies',
          },
          {
            key: 'Cost centre',
            value: 'IT & Infrastructure',
          },
          {
            key: 'Payment method',
            value: 'Corporate card ****9901',
          },
          {
            key: 'Submitted by',
            value: 'Kim Minsu · 2026-07-31 14:22',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        label: 'Line items',
        columns: ['Description', 'Qty', 'Unit price', 'Amount'],
        data: [
          ['A4 paper, 5 boxes', '5', '12,000', '60,000'],
          ['Whiteboard markers, 2 packs', '2', '9,000', '18,000'],
          ['Desk organiser', '1', '23,000', '23,000'],
          ['Printer toner (compatible)', '1', '27,000', '27,000'],
          ['Subtotal · tax 11,636', '', '', '₩128,000'],
        ],
        showHeader: true,
      },
    },
    {
      kind: 'textarea',
      props: {
        label: 'Decision',
        placeholder: 'Note for the submitter (required when returning)',
        height: 80,
      },
    },
    {
      kind: 'buttonBar',
      props: {
        align: 'left',
        buttons: [
          {
            label: 'Approve',
            variant: 'default',
          },
          {
            label: 'Return',
            variant: 'outline',
          },
        ],
      },
    },
    {
      kind: 'fileList',
      props: {
        label: 'Evidence',
        pairs: [
          {
            key: 'receipt-scan.pdf',
            value: '412 KB',
          },
          {
            key: 'card-slip.jpg',
            value: '188 KB',
          },
        ],
      },
    },
    {
      kind: 'timeline',
      props: {
        label: 'History',
        pairs: [
          {
            key: 'Created the receipt',
            value: 'Kim Minsu · 2026-07-31 14:22',
          },
          {
            key: 'Attached receipt-scan.pdf',
            value: 'Kim Minsu · 2026-07-31 14:24',
          },
          {
            key: 'Matched to card charge ****9901',
            value: 'System · 2026-07-31 16:03',
          },
        ],
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'Receipt number replaces the internal id in every list — June change request.',
      },
    },
  ],
  'approval-queue': [
    {
      kind: 'screenHeader',
      props: {
        label: 'Approval Queue',
        subtitle: 'Accountant > Waiting on me',
        showActions: true,
        buttons: [
          {
            label: 'Delegate while away',
            variant: 'outline',
          },
        ],
      },
    },
    {
      kind: 'statCards',
      props: {
        pairs: [
          {
            key: 'Waiting on me',
            value: '8',
            tone: 'blue',
          },
          {
            key: 'Overdue',
            value: '2',
            tone: 'red',
          },
          {
            key: 'Total value',
            value: '₩4,299,279',
            tone: 'green',
          },
        ],
      },
    },
    {
      kind: 'filterBar',
      props: {
        controls: [
          {
            type: 'search',
            placeholder: 'Search reference, requester…',
          },
          {
            type: 'select',
            options: [
              'All types',
              'Corporate card',
              'Personal expense',
              'Cash receipt',
              'Tax invoice',
            ],
            activeIndex: 0,
          },
        ],
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'Scoped to Taehyuk Park — you only see what you can act on.',
      },
    },
    {
      kind: 'table',
      props: {
        columns: [
          'Reference',
          'Type',
          'Requester',
          'Department',
          'Amount (₩)',
          'Submitted',
          'Due',
          'Actions',
        ],
        data: [
          [
            'CC-2026-01188',
            'Corporate card',
            'Kim Minsu',
            'IT',
            '1,240,000',
            '2026-07-31',
            '2d overdue',
            'Approve · Return',
          ],
          [
            'EXP-2026-00412',
            'Personal expense',
            'Lee Jiyeon',
            'Finance',
            '228,400',
            '2026-07-30',
            '1d overdue',
            'Approve · Return',
          ],
          [
            'RCP-2026-00186',
            'Cash receipt',
            'Lee Jiyeon',
            'Finance',
            '45,000',
            '2026-07-30',
            'Due today',
            'Approve · Return',
          ],
          [
            'TI-2026-00931',
            'Tax invoice',
            'Moon Namwon',
            'Finance',
            '2,080,579',
            '2026-07-29',
            'in 1d',
            'Approve · Return',
          ],
          [
            'CC-2026-01184',
            'Corporate card',
            'Park Seongmin',
            'Operations',
            '340,000',
            '2026-07-29',
            'in 1d',
            'Approve · Return',
          ],
          [
            'EXP-2026-00409',
            'Personal expense',
            'Choi Dongwook',
            'HR',
            '87,300',
            '2026-07-28',
            'in 2d',
            'Approve · Return',
          ],
        ],
        showHeader: true,
        label: '',
      },
    },
  ],
  settings: [
    {
      kind: 'screenHeader',
      props: {
        label: 'Settings',
        subtitle: 'Administration > Workspace settings',
        showActions: true,
        buttons: [
          {
            label: 'Save changes',
            variant: 'default',
          },
        ],
      },
    },
    {
      kind: 'formGrid',
      props: {
        label: 'Company',
        pairs: [
          {
            key: 'Company name',
            value: 'KOSIGN Cloud',
          },
          {
            key: 'Business number',
            value: '220-81-95788',
          },
          {
            key: 'Base currency',
            value: 'KRW (₩)',
          },
          {
            key: 'Fiscal year start',
            value: 'January',
          },
        ],
      },
    },
    {
      kind: 'caption',
      props: {
        label: 'Multi-tenant workspace · 6 solutions on this cloud',
      },
    },
    {
      kind: 'toggleList',
      props: {
        label: 'Close & approval policy',
        pairs: [
          {
            key: 'Close the month automatically',
            value: 'Locks the period once every cost centre reports complete.',
            checked: true,
          },
          {
            key: 'Require evidence before approval',
            value: 'A charge with no receipt cannot be approved, in bulk or one by one.',
            checked: true,
          },
          {
            key: 'Bulk approve by calendar month',
            value: 'Approves the whole month rather than the current selection.',
            checked: true,
          },
          {
            key: 'Email the submitter on return',
            value: 'Off by default — the returned tab already shows it.',
            checked: false,
          },
        ],
      },
    },
    {
      kind: 'buttonBar',
      props: {
        align: 'right',
        buttons: [
          {
            label: 'Invite member',
            variant: 'outline',
          },
        ],
      },
    },
    {
      kind: 'table',
      props: {
        label: 'Members',
        columns: ['Name', 'Email', 'Role', 'Status'],
        data: [
          ['Taehyuk Park', 'taehyuk.park@kosign.com', 'Accountant', 'Active'],
          ['Lee Jiyeon', 'jiyeon.lee@kosign.com', 'Approver', 'Active'],
          ['Kim Minsu', 'minsu.kim@kosign.com', 'Member', 'Active'],
          ['Namwon Moon', 'namwon.moon@kosign.com', 'Admin', 'Active'],
          ['Choi Dongwook', 'dongwook.choi@kosign.com', 'Member', 'Invited'],
        ],
      },
    },
  ],
};

/** The blocks a prototype file's canvas starts from, or null if it has none. */
export function prototypeDesignBlocks(screenId: string): CanvasBlock[] | null {
  const file = findPrototypeFile(screenId);
  const design = file ? DESIGNS[file.slug] : undefined;
  if (!design) return null;
  return design.map((entry) => createBlock(entry.kind, entry.props));
}

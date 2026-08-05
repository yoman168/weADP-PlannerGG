import { ArrowRight, Code2, Gauge, Hammer, PenTool } from 'lucide-react';
import Link from 'next/link';
import { Badge, Card, CardContent } from '@/components/ui';
import { StatusChip } from '@/components/we-adk/status-chip';

const TOOLS = [
  {
    href: '/we-adk',
    icon: PenTool,
    name: 'WE-ADK Sketcher',
    tagline:
      'A folder per project: design files grouped by the customer meeting they came from, next to the real screens that project runs in production today.',
    users: 'Used by PM · PL',
    status: { label: 'Prototype', tone: 'violet' as const },
  },
  {
    href: '/we-adk',
    icon: Hammer,
    name: 'WE-ADK Builder',
    tagline:
      'Planners build real, working screens from solution mockups and hand them off to development as a formal requirements spec.',
    users: 'Used by planners · product owners',
    status: { label: 'Live on BZP', tone: 'blue' as const },
  },
  {
    href: '/we-adk',
    icon: Code2,
    name: 'WE-ADK Developer',
    tagline:
      'A harness-based development platform where AI builds with full awareness of each business unit’s rules and domain context.',
    users: 'Used by developers',
    status: { label: 'Operating (Local Currency, Voucher, BZP)', tone: 'green' as const },
  },
  {
    href: '/we-adk/devadmin',
    icon: Gauge,
    name: 'WE-ADK DevAdmin',
    tagline:
      'An operations console giving the org visibility and control as AI-assisted development scales.',
    users: 'Used by engineering managers',
    status: { label: 'Under construction', tone: 'amber' as const },
  },
];

const BUSINESS_LINES = ['BZP', 'BIZ', 'Local Currency', 'Voucher', 'KOSIGN'];

export default function WeAdkOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">WE-ADK Architecture</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Meeting notes & concept mockups (Sketcher) → solution-based mockups & PRD (Builder) →
          harness-based development (Developer) → token, usage & security operations (DevAdmin).
          Every stage shares one Claude/LLM engine and is cloned & customized per business line.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                    <tool.icon className="size-4.5" />
                  </span>
                  <StatusChip {...tool.status} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{tool.name}</p>
                  <p className="text-muted-foreground text-xs">{tool.users}</p>
                </div>
                <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                  {tool.tagline}
                </p>
                <span className="text-primary flex items-center gap-1 text-xs font-medium">
                  Open <ArrowRight className="size-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium">Cloned & customized per business line</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_LINES.map((line) => (
              <Badge key={line} variant="secondary" className="px-3 py-1 text-sm">
                {line}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Built on the standard WE-ADK stack (GitLab for codebase & configuration management + a
            shared Claude/LLM engine), then cloned and customized per business line.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

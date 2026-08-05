'use client';

import { ArrowLeft, Layers, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import {
  MockupBoard,
  ZoomControl,
  type BoardScreen,
  type ZoomId,
} from '@/components/we-adk/mockup-board';
import { useLocale } from '@/lib/locale';
import { WORK_MOCKUPS } from '@/lib/we-adk-mock/builder';

export default function MockupBoardPage() {
  const { t } = useLocale();
  const params = useParams<{ projectId: string; mockupId: string }>();
  const builderHref = `/we-adk/projects/${params.projectId}/builder`;
  const mockup = WORK_MOCKUPS.find((entry) => entry.id === params.mockupId);
  const [zoom, setZoom] = useState<ZoomId>('md');

  if (!mockup) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium">That work mockup does not exist.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={builderHref}>
            <ArrowLeft />
            Back to work mockups
          </Link>
        </Button>
      </div>
    );
  }

  const screens: BoardScreen[] = mockup.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    route: screen.route,
    seedPattern: screen.seedPattern,
    status: screen.status,
    updatedAt: screen.updatedAt,
  }));

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" asChild>
            <Link href={builderHref}>
              <ArrowLeft className="size-3.5" />
              Work mockups
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-sm font-semibold">{mockup.title}</span>
          <Badge variant="secondary" className="shrink-0">
            {mockup.domain}
          </Badge>
          <Badge variant="muted" className="shrink-0 gap-1">
            <Layers className="size-3" />
            {mockup.screens.length} screens
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <ZoomControl zoom={zoom} onChange={setZoom} />
          <Button variant="outline" size="sm" disabled title={t('misc.notMockup')}>
            <Plus />
            New screen
          </Button>
        </div>
      </div>

      <MockupBoard screens={screens} projectId={params.projectId} zoom={zoom} />
    </div>
  );
}

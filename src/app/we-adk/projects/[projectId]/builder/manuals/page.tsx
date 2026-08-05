import { BookOpenText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { USER_MANUALS } from '@/lib/we-adk-mock/builder';

export default function UserManualsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">User manuals</h1>
      <p className="text-muted-foreground text-sm">
        Automatically written by AI after Developer completes work, based on the real screen flow.
      </p>
      <div className="flex flex-col gap-2">
        {USER_MANUALS.map((manual) => (
          <Card key={manual.title} className="gap-0 py-0">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <BookOpenText className="text-muted-foreground size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{manual.title}</p>
                <p className="text-muted-foreground text-xs">
                  Audience: {manual.audience} · Updated {manual.updatedAt}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

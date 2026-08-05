import { Card, CardContent } from '@/components/ui';
import { StatusChip } from '@/components/we-adk/status-chip';
import { INTEGRATION_TESTS } from '@/lib/we-adk-mock/builder';

export default function IntegrationTestsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Integration tests</h1>
      <p className="text-muted-foreground text-sm">
        Scenario verification results that span multiple screens and APIs.
      </p>
      <div className="flex flex-col gap-2">
        {INTEGRATION_TESTS.map((scenario, index) => (
          <Card key={index} className="gap-0 py-0">
            <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="font-medium">{scenario.scenario}</p>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">{scenario.ranAt}</span>
                <StatusChip {...scenario.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OnboardingProps {
  onboardingName: string;
  col?: number;
}

const colClassMap: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  6: 'col-span-6',
  8: 'col-span-8',
  12: 'col-span-12',
};

export function OnboardingWidget({ onboardingName, col = 12 }: OnboardingProps) {
  const colClass = colClassMap[col] || 'col-span-full';

  return (
    <div className={colClass}>
      <Card className="border-border bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🚀</span>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                {onboardingName} Onboarding
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Module setup guide
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                    1
                  </Badge>
                  <span className="text-muted-foreground">Configure module settings and initial master data</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
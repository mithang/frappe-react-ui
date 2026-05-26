import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OnboardingProps {
  onboardingName: string;
  col: number;
}

export function OnboardingWidget({ onboardingName, col }: OnboardingProps) {
  const colClass = `col-span-${Math.min(col, 12)}`;

  const getOnboardingContent = (name: string) => {
    const content: { [key: string]: { title: string; description: string; steps: string[] } } = {
      'Accounts': {
        title: 'Welcome to Accounting',
        description: 'Get started with your accounting setup',
        steps: [
          'Set up your Chart of Accounts',
          'Configure payment methods',
          'Create your first invoice'
        ]
      },
      'Website': {
        title: 'Build Your Website',
        description: 'Create a professional website',
        steps: [
          'Configure website settings',
          'Create your first web page',
          'Set up blog and portfolio'
        ]
      }
    };

    return content[name] || {
      title: `Get Started with ${name}`,
      description: 'Complete the setup process',
      steps: ['Configure basic settings', 'Add initial data', 'Start using the module']
    };
  };

  const content = getOnboardingContent(onboardingName);

  return (
    <div className={colClass}>
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-xl">🚀</span>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {content.title}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                {content.description}
              </p>
              <div className="space-y-2">
                {content.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-blue-700 dark:text-blue-200">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
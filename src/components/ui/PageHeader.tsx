import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-md">
      <div className="flex flex-col gap-xs min-w-0">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-background">
          {title}
        </h1>
        {subtitle && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

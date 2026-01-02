// Backend Connection Status Indicator
// =============================================================================

import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'checking' | 'online' | 'offline';

export function ConnectionStatus({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>('checking');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const res = await getHealth();
        if (!isMounted) return;
        if (res.ok) {
          setStatus('online');
          setDetail(null);
        } else {
          setStatus('offline');
          setDetail(res.error != null ? String(res.error) : null);
        }
      } catch (e) {
        if (!isMounted) return;
        setStatus('offline');
        setDetail((e as Error).message);
      }
    }

    check();
    const intervalId = window.setInterval(check, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const dotClass =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'offline'
        ? 'bg-destructive'
        : 'bg-muted-foreground';

  const label =
    status === 'online'
      ? 'API: online'
      : status === 'offline'
        ? 'API: offline'
        : 'API: checking';

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      {!compact && (
        <span className="text-muted-foreground" title={detail ?? undefined}>
          {label}
        </span>
      )}
    </div>
  );
}

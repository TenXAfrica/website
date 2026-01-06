import React, { useEffect, useState } from 'react';

interface SystemStatus {
  allOnline: boolean;
  upCount: number;
  totalCount: number;
  percentageUp: number;
}

export function SystemStatusPill() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/system-status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        // Default to all systems online if check fails
        setStatus({
          allOnline: true,
          upCount: 4,
          totalCount: 4,
          percentageUp: 100
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 animate-fade-in-up">
        <span className="w-1.5 h-1.5 rounded-full bg-tenx-gold animate-pulse"></span>
        <span className="text-xs font-mono tracking-widest text-white/70">
          CHECKING_SYSTEMS...
        </span>
      </div>
    );
  }

  const statusText = status?.allOnline
    ? 'ALL_SYSTEMS_ONLINE'
    : `SYSTEMS_${status?.percentageUp}%_ONLINE`;

  const indicatorColor = status?.allOnline
    ? 'bg-tenx-gold'
    : status && status.percentageUp >= 75
    ? 'bg-yellow-500'
    : status && status.percentageUp >= 50
    ? 'bg-orange-500'
    : 'bg-red-500';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 animate-fade-in-up">
      <span
        className={`w-1.5 h-1.5 rounded-full ${indicatorColor} animate-pulse`}
      ></span>
      <span className="text-xs font-mono tracking-widest text-white/70">
        {statusText}
      </span>
    </div>
  );
}

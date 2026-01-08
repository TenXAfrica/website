import type { APIRoute } from 'astro';

interface SiteStatus {
  site: string;
  url: string;
  status: boolean;
  httpStatus: number | null;
  responseTime: number;
}

async function checkSite(url: string): Promise<SiteStatus> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TenX-SystemMonitor/1.0',
      },
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    // Check if we got a successful response (2xx-3xx)
    const isHealthy = response.status >= 200 && response.status < 400;

    return {
      site: url.split('/')[2], // Extract domain from URL
      url,
      status: isHealthy,
      httpStatus: response.status,
      responseTime,
    };
  } catch (error) {
    return {
      site: url.split('/')[2],
      url,
      status: false,
      httpStatus: null,
      responseTime: Date.now() - startTime,
    };
  }
}

export const GET: APIRoute = async () => {
  const sitesToCheck = [
    'https://cal.tenxafrica.co.za',
    'https://tenxafrica.co.za',
  ];

  // Check both sites in parallel
  const results = await Promise.all(sitesToCheck.map((url) => checkSite(url)));

  // Calculate uptime
  const calStatus = results[0]; // cal.tenxafrica.co.za
  const mainStatus = results[1]; // tenxafrica.co.za

  // If cal is up, count 3 systems (n8n, crm, cal)
  // If cal is down, count 0 systems
  const subdomainSystemsUp = calStatus.status ? 3 : 0;
  const mainSystemUp = mainStatus.status ? 1 : 0;

  const totalSystems = 4;
  const systemsUp = subdomainSystemsUp + mainSystemUp;
  const percentageUp = Math.round((systemsUp / totalSystems) * 100);
  const allOnline = systemsUp === totalSystems;

  return new Response(
    JSON.stringify({
      allOnline,
      systemsUp,
      totalSystems,
      percentageUp,
      timestamp: new Date().toISOString(),
      details: {
        subdomains: {
          name: 'Subdomains (n8n, crm, cal)',
          representative: calStatus.site,
          status: calStatus.status,
          httpStatus: calStatus.httpStatus,
          responseTime: calStatus.responseTime,
        },
        main: {
          name: 'Main Domain',
          site: mainStatus.site,
          status: mainStatus.status,
          httpStatus: mainStatus.httpStatus,
          responseTime: mainStatus.responseTime,
        },
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
};

import { describe, expect, it } from 'vitest';
import { checkUrl, fetchPage, htmlText, MAX_PAGE_BYTES, PageRefused, privateAddress, type Lookup } from './page';

// The URL guard (PRD 774, decision 11), with a stubbed resolver and fetch: `http:`, private, loopback
// and link-local hosts are refused, and a redirect to one; a page over 1 MB is cut. Nothing leaves.

const DNS: Record<string, string[]> = {
  'vertuoza.com': ['76.76.21.21'],
  'www.vertuoza.com': ['76.76.21.22', '2606:4700::6810:84e5'],
  'intranet.example.com': ['10.0.0.8'],
  'sneaky.example.com': ['76.76.21.23', '192.168.1.1'],
  'metadata.example.com': ['169.254.169.254'],
  'v6loop.example.com': ['::1'],
};
const lookup: Lookup = async (host) => DNS[host] ?? [];

const refused = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(PageRefused);
  return (error as Error).message;
};

describe('privateAddress', () => {
  it.each(['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'not an address'])('refuses %s', (address) => {
    expect(privateAddress(address)).toBe(true);
  });

  it.each(['76.76.21.21', '172.32.0.1', '8.8.8.8', '2606:4700::6810:84e5', '::ffff:8.8.8.8'])('lets %s through', (address) => {
    expect(privateAddress(address)).toBe(false);
  });
});

describe('checkUrl', () => {
  it('takes an https page on a public host', async () => {
    expect((await checkUrl('https://vertuoza.com/pricing', lookup)).toString()).toBe('https://vertuoza.com/pricing');
  });

  it('refuses http:', async () => {
    expect(await refused(checkUrl('http://vertuoza.com/pricing', lookup))).toBe('Only https:// pages can be read.');
  });

  it.each([
    'https://intranet.example.com/',
    'https://sneaky.example.com/',
    'https://metadata.example.com/latest',
    'https://v6loop.example.com/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://192.168.1.10/admin',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/',
    'https://printer.local/',
  ])('refuses %s', async (url) => {
    expect(await refused(checkUrl(url, lookup))).toBe('That address is not on the public internet.');
  });

  it('refuses what is not an address, and a host that cannot be found', async () => {
    expect(await refused(checkUrl('pricing page', lookup))).toBe('That is not a web address.');
    expect(await refused(checkUrl('https://nowhere.example.org/', lookup))).toBe('That address cannot be found.');
  });
});

type Route = { status?: number; headers?: Record<string, string>; body?: string };

function site(routes: Record<string, Route>) {
  const asked: string[] = [];
  const fetch = (async (input: URL | string, init: RequestInit) => {
    const url = String(input);
    asked.push(url);
    expect(init.redirect).toBe('manual');
    const route = routes[url];
    if (!route) return new Response('missing', { status: 404 });
    return new Response(route.body ?? '', { status: route.status ?? 200, headers: route.headers ?? { 'content-type': 'text/html' } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, asked };
}

describe('fetchPage', () => {
  it('reads an HTML page as its text', async () => {
    const { fetch } = site({ 'https://vertuoza.com/pricing': { body: '<html><head><style>p{}</style><script>x()</script></head><body><h1>Pricing</h1><p>For construction&nbsp;firms in <b>Belgium</b> &amp; France.</p></body></html>' } });
    expect(await fetchPage('https://vertuoza.com/pricing', { fetch, lookup })).toBe('Pricing\nFor construction firms in Belgium & France.');
  });

  it('follows a redirect to a public page, checking it again', async () => {
    const { fetch, asked } = site({
      'https://vertuoza.com/': { status: 301, headers: { location: 'https://www.vertuoza.com/en' } },
      'https://www.vertuoza.com/en': { body: 'Welcome', headers: { 'content-type': 'text/plain' } },
    });
    expect(await fetchPage('https://vertuoza.com/', { fetch, lookup })).toBe('Welcome');
    expect(asked).toEqual(['https://vertuoza.com/', 'https://www.vertuoza.com/en']);
  });

  it('refuses a redirect to a private host, and never asks it', async () => {
    const { fetch, asked } = site({ 'https://vertuoza.com/go': { status: 302, headers: { location: 'https://metadata.example.com/latest' } } });
    expect(await refused(fetchPage('https://vertuoza.com/go', { fetch, lookup }))).toBe('That address is not on the public internet.');
    expect(asked).toEqual(['https://vertuoza.com/go']);
  });

  it('refuses a redirect to http:', async () => {
    const { fetch } = site({ 'https://vertuoza.com/go': { status: 302, headers: { location: 'http://vertuoza.com/' } } });
    expect(await refused(fetchPage('https://vertuoza.com/go', { fetch, lookup }))).toBe('Only https:// pages can be read.');
  });

  it('cuts a page over 1 MB', async () => {
    const big = 'a'.repeat(MAX_PAGE_BYTES + 5000);
    const { fetch } = site({ 'https://vertuoza.com/big': { body: big, headers: { 'content-type': 'text/plain' } } });
    expect((await fetchPage('https://vertuoza.com/big', { fetch, lookup })).length).toBe(MAX_PAGE_BYTES);
  });

  it('refuses an answer that is not ok, or not text', async () => {
    const { fetch } = site({
      'https://vertuoza.com/gone': { status: 500 },
      'https://vertuoza.com/deck.pdf': { body: '%PDF', headers: { 'content-type': 'application/pdf' } },
    });
    expect(await refused(fetchPage('https://vertuoza.com/gone', { fetch, lookup }))).toBe('The page answered 500.');
    expect(await refused(fetchPage('https://vertuoza.com/deck.pdf', { fetch, lookup }))).toBe('The page is not text.');
  });
});

describe('htmlText', () => {
  it('decodes numeric entities and keeps plain text as it is', () => {
    expect(htmlText('Caf&#233; &#x2014; ok')).toBe('Café — ok');
    expect(htmlText('no tags here')).toBe('no tags here');
  });
});

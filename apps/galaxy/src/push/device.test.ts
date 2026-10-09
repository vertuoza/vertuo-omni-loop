import { describe, expect, it } from 'vitest';
import { AlertChannels, applicationServerKey, deviceLabel, PushDevice, pushSupport } from './device';

// A device's Web Push subscription and a person's alert switches (PRD 1322 s9), as the browser sends
// them and the routes read them: the shapes, whether this browser can be subscribed at all, the label
// a device is stored with, and the VAPID public key turned into the bytes the Push API wants.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAC_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:127.0) Gecko/20100101 Firefox/127.0';
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0';

const browser = (userAgent: string, over: Partial<Parameters<typeof pushSupport>[0]> = {}) =>
  ({ userAgent, standalone: false, serviceWorker: true, pushManager: true, ...over });

describe('pushSupport', () => {
  it('an iPhone or an iPad not added to the home screen is told to add it first', () => {
    expect(pushSupport(browser(IPHONE, { pushManager: false }))).toBe('add-to-home-screen');
    expect(pushSupport(browser(IPAD))).toBe('add-to-home-screen');
  });

  it('an iPhone opened from the home screen subscribes', () => {
    expect(pushSupport(browser(IPHONE, { standalone: true }))).toBe('ready');
  });

  it('a browser with a service worker and a push manager subscribes', () => {
    expect(pushSupport(browser(ANDROID))).toBe('ready');
    expect(pushSupport(browser(MAC_CHROME))).toBe('ready');
  });

  it('a browser without either cannot', () => {
    expect(pushSupport(browser(MAC_CHROME, { serviceWorker: false }))).toBe('unsupported');
    expect(pushSupport(browser(MAC_CHROME, { pushManager: false }))).toBe('unsupported');
    expect(pushSupport(browser(IPHONE, { standalone: true, pushManager: false }))).toBe('unsupported');
  });
});

describe('deviceLabel', () => {
  it('names the device and the browser in a few words', () => {
    expect(deviceLabel(IPHONE)).toBe('iPhone · Safari');
    expect(deviceLabel(IPAD)).toBe('iPad · Safari');
    expect(deviceLabel(ANDROID)).toBe('Android · Chrome');
    expect(deviceLabel(MAC_CHROME)).toBe('Mac · Chrome');
    expect(deviceLabel(MAC_FIREFOX)).toBe('Mac · Firefox');
    expect(deviceLabel(WINDOWS_EDGE)).toBe('Windows · Edge');
  });

  it('an unknown agent reads as a browser', () => {
    expect(deviceLabel('curl/8.0')).toBe('A browser');
    expect(deviceLabel('')).toBe('A browser');
  });
});

describe('applicationServerKey', () => {
  it('decodes the base64url key, padding it as needed', () => {
    expect([...applicationServerKey('AQID')]).toEqual([1, 2, 3]);
    expect([...applicationServerKey('-_8')]).toEqual([251, 255]);
    expect([...applicationServerKey('AQ')]).toEqual([1]);
  });
});

describe('PushDevice', () => {
  const device = { endpoint: 'https://push.example/abc', keys: { p256dh: 'BPk', auth: 'xyz' }, label: 'Mac · Chrome' };

  it('reads a subscription as the browser serialises it, the label beside it', () => {
    expect(PushDevice.parse(device)).toEqual(device);
  });

  it('refuses an endpoint that is not https, a missing key, or a label too long', () => {
    expect(PushDevice.safeParse({ ...device, endpoint: 'http://push.example/abc' }).success).toBe(false);
    expect(PushDevice.safeParse({ ...device, keys: { p256dh: 'BPk' } }).success).toBe(false);
    expect(PushDevice.safeParse({ ...device, keys: { p256dh: '', auth: 'xyz' } }).success).toBe(false);
    expect(PushDevice.safeParse({ ...device, label: 'x'.repeat(121) }).success).toBe(false);
    expect(PushDevice.safeParse({ ...device, endpoint: `https://push.example/${'a'.repeat(2000)}` }).success).toBe(false);
  });
});

describe('AlertChannels', () => {
  it('is both switches, each a boolean', () => {
    expect(AlertChannels.parse({ push: true, email: false })).toEqual({ push: true, email: false });
    expect(AlertChannels.safeParse({ push: 'yes', email: false }).success).toBe(false);
    expect(AlertChannels.safeParse({ push: true }).success).toBe(false);
  });
});

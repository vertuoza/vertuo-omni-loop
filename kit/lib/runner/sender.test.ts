// The sender line (PRD 1830; PRD 2433 s2): a person's job names the person, an API key's job names the key
// and never a person.
import { describe, expect, it } from 'vitest';
import { senderLine } from './sender.ts';

describe('senderLine', () => {
  it("names the person who sent a job, with an @ in front of the login and one only", () => {
    expect(senderLine({ sentBy: 'ada', runner: 'box-1' })).toBe('Sent from the Omni app by @ada on runner box-1');
    expect(senderLine({ sentBy: '@ada', runner: 'box-1' })).toBe('Sent from the Omni app by @ada on runner box-1');
    expect(senderLine({ sentBy: ' ada ', sentByKey: null, runner: ' box-1 ' })).toBe('Sent from the Omni app by @ada on runner box-1');
  });

  it("names the key of a job an API key sent, with no @ and no login (PRD 2433)", () => {
    expect(senderLine({ sentByKey: 'deploy bot', runner: 'box-1' })).toBe('Sent through the Omni API by API key deploy bot on runner box-1');
    expect(senderLine({ sentBy: null, sentByKey: ' deploy bot ', runner: ' box-1 ' })).toBe('Sent through the Omni API by API key deploy bot on runner box-1');
  });

  it("never names the person behind a key's job, whatever its sender carries", () => {
    expect(senderLine({ sentBy: 'API key deploy bot (@ada)', sentByKey: 'deploy bot', runner: 'box-1' })).toBe('Sent through the Omni API by API key deploy bot on runner box-1');
  });

  it('leaves out the @ of a key named like a login, so the line mentions no one', () => {
    expect(senderLine({ sentByKey: '@ada', runner: 'box-1' })).toBe('Sent through the Omni API by API key ada on runner box-1');
    expect(senderLine({ sentByKey: 'fix @ada and @bob', runner: 'box-1' })).toBe('Sent through the Omni API by API key fix ada and bob on runner box-1');
  });

  it('keeps a key name on one line', () => {
    expect(senderLine({ sentByKey: 'deploy\n  bot', runner: 'box-1' })).toBe('Sent through the Omni API by API key deploy bot on runner box-1');
  });

  it('writes no line when it has no sender, no runner, or only blanks', () => {
    expect(senderLine(null)).toBeNull();
    expect(senderLine({ sentBy: ' ', runner: 'box-1' })).toBeNull();
    expect(senderLine({ sentBy: 'ada', runner: ' ' })).toBeNull();
    expect(senderLine({ sentByKey: ' ', runner: 'box-1' })).toBeNull();
    expect(senderLine({ sentByKey: '@', runner: 'box-1' })).toBeNull();
    expect(senderLine({ sentByKey: 'deploy bot', runner: '' })).toBeNull();
    expect(senderLine({ sentBy: null, sentByKey: null, runner: 'box-1' })).toBeNull();
  });
});

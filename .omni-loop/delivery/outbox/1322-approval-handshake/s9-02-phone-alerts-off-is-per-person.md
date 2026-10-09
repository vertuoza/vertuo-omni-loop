---
id: s9-02-phone-alerts-off-is-per-person
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Someone uses phone alerts on two devices and turns them off on one. Should the other device keep getting alerts?

## The decision, in plain words

Turning phone alerts off on one device removes that device and turns phone alerts off for the person, so none of their devices is alerted until they turn it on again.

## The intro, for fun

Two phones, one switch, and a polite disagreement about who is in charge.

## The punchline, for fun

Off means off, everywhere, until someone says otherwise.

## The options, in plain words

A. Off on one device turns phone alerts off for the person and removes that device (what was built).
B. Off on one device removes only that device; the person stays on while any other device is subscribed.

## What I had to decide

Whether turning phone alerts off is for this device only or for the person.

## What I did meanwhile

The switch is stored once per person, as the spec's tables hold it; off also removes this device's subscription. Other devices keep their subscription but are not sent anything while the switch is off.

## What it costs to change later

A constant: a per-device switch would only change what the off press saves, and the sender's check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the switch is per person and the subscription per device, but not what off on one of several devices means (author).

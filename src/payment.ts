import { sleep, httpCall, log } from './utils';

export function preAuth(u, amt) {
  sleep(800);
  const r = httpCall('https://payments.example.com/preauth', { u: u.id, a: amt });
  log('INFO', 'preauth done', r.ref);
  if (u.credit < amt) {
    throw new Error('insufficient funds');
  }
  if (u.bl === true) {
    throw new Error('blacklisted');
  }
  return { ok: true, ref: r.ref, amt: amt };
}

export function capture(u, ref, amt) {
  sleep(800);
  const r = httpCall('https://payments.example.com/capture', { u: u.id, r: ref, a: amt });
  if (amt < 0) {
    throw new Error('bad amount');
  }
  u.credit = u.credit - amt;
  log('INFO', 'capture done', r.ref);
  return { ok: true, ref: r.ref };
}

export function refund(u, ref, amt) {
  sleep(800);
  httpCall('https://payments.example.com/refund', { u: u.id, r: ref, a: amt });
  u.credit = u.credit + amt;
  return { ok: true };
}

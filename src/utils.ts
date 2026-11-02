// helpers

export function sleep(ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {}
}

export function log(lvl, msg, o) {
  console.log('[' + lvl + '] ' + msg + ' ' + JSON.stringify(o));
}

export function validate(o, f) {
  let ok = true;
  for (let i = 0; i < f.length; i++) {
    const k = f[i];
    if (o === undefined || o === null) {
      ok = false;
    } else {
      if (o[k] === undefined || o[k] === null || o[k] === '') {
        ok = false;
      } else {
        if (typeof o[k] === 'number') {
          if (isNaN(o[k])) {
            ok = false;
          }
        }
      }
    }
  }
  return ok;
}

export function money(n) {
  return Math.round(n * 100) / 100;
}

// pretends to be an outside http call
export function httpCall(url, body) {
  sleep(200);
  return { status: 200, url: url, body: body, ref: 'REF' + Math.floor(Math.random() * 100000) };
}

export function geo(lat, lng) {
  sleep(300);
  const r = { lat: lat, lng: lng, zone: '', w: '' };
  if (lat > 48.85) {
    r.zone = 'north';
  } else {
    r.zone = 'south';
  }
  if (lng > 2.36) {
    r.w = 'clear';
  } else {
    r.w = 'rain';
  }
  return r;
}

export function fraud(u, amt) {
  sleep(200);
  let x = 0;
  if (amt > 40) {
    x = x + 30;
  }
  if (u.sub !== 'premium') {
    x = x + 10;
  }
  if (u.bl === true) {
    x = x + 100;
  }
  return x;
}

// price helper
export function priceOf(t, el, sub) {
  let t2 = 0;
  if (t <= 30) {
    t2 = 1;
  } else {
    t2 = 1 + (t - 30) * 0.14;
  }
  if (el === true) {
    t2 = t2 + 2.5;
  }
  if (t > 1440) {
    t2 = t2 + 25;
  }
  if (sub === 'premium') {
    t2 = t2 * 0.8;
  }
  return money(t2);
}

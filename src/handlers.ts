import { stations, bikes, users, rentals, nextRentalId } from './db';
import { sleep, log, validate, money, geo, fraud, priceOf } from './utils';
import { preAuth, capture } from './payment';

export function handleRent(req, res) {
  const b = req.body;
  if (!validate(b, ['userId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    let u = null;
    for (let i = 0; i < users.length; i++) {
      if (users[i].id === Number(b.userId)) {
        u = users[i];
      }
    }
    if (u === null) {
      res.status(404).json({ msg: 'no user' });
    } else {
      let s = null;
      for (let i = 0; i < stations.length; i++) {
        if (stations[i].id === Number(b.stationId)) {
          s = stations[i];
        }
      }
      if (s === null) {
        res.status(404).json({ msg: 'no station' });
      } else {
        const d = [];
        for (let i = 0; i < bikes.length; i++) {
          const e = bikes[i];
          if (e.st === s.id) {
            if (e.s === 0) {
              d.push(e);
            } else {
              if (e.s === 3) {
                log('WARN', 'broken bike at station', e.id);
              }
            }
          }
        }
        let x = null;
        if (b.bikeId !== undefined && b.bikeId !== null) {
          for (let i = 0; i < d.length; i++) {
            if (d[i].id === Number(b.bikeId)) {
              x = d[i];
            }
          }
        } else {
          let tmp = -1;
          for (let i = 0; i < d.length; i++) {
            if (tmp === -1) {
              tmp = i;
            } else {
              if (d[i].km < d[tmp].km) {
                tmp = i;
              }
            }
          }
          if (tmp >= 0) {
            x = d[tmp];
          }
        }
        if (x === null) {
          res.status(409).json({ msg: 'no bike available' });
        } else {
          let acc = 0;
          for (let i = 0; i < rentals.length; i++) {
            if (rentals[i].u === u.id) {
              if (rentals[i].end === null) {
                acc = acc + 1;
              }
            }
          }
          if (acc > 0) {
            res.status(409).json({ msg: 'already renting' });
          } else {
            if (u.credit < 5) {
              res.status(402).json({ msg: 'not enough credit' });
            } else {
              let t2 = 5;
              if (x.el === true) {
                t2 = t2 + 2.5;
              }
              const y2 = fraud(u, t2);
              if (y2 >= 100) {
                res.status(403).json({ msg: 'refused' });
              } else {
                let val = null;
                let tmp2 = null;
                try {
                  val = preAuth(u, t2);
                } catch (e) {
                  tmp2 = e;
                }
                const obj = {
                  id: nextRentalId(),
                  u: u.id,
                  b: x.id,
                  st: s.id,
                  end: null,
                  endSt: null,
                  start: Date.now(),
                  ref: val === null ? null : val.ref,
                  pre: t2,
                  el: x.el,
                  s: 1
                };
                rentals.push(obj);
                x.s = 1;
                const arr = [];
                for (let i = 0; i < s.b.length; i++) {
                  if (s.b[i] !== x.id) {
                    arr.push(s.b[i]);
                  }
                }
                s.b = arr;
                try {
                  sleep(100);
                  log('INFO', 'rental created', obj.id);
                } catch (e) {}
                if (tmp2 !== null) {
                  res.send('ok');
                } else {
                  res.json({
                    msg: 'ok',
                    rentalId: obj.id,
                    bikeId: x.id,
                    station: s.name,
                    preAuth: money(t2),
                    ref: obj.ref
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}

export function handleReturn(req, res) {
  const b = req.body;
  if (!validate(b, ['rentalId', 'stationId'])) {
    res.status(400).json({ msg: 'bad request' });
  } else {
    let e = null;
    for (let i = 0; i < rentals.length; i++) {
      if (rentals[i].id === Number(b.rentalId)) {
        e = rentals[i];
      }
    }
    if (e === null) {
      res.status(404).json({ msg: 'no rental' });
    } else {
      if (e.end !== null) {
        res.status(409).json({ msg: 'already returned' });
      } else {
        let s = null;
        for (let i = 0; i < stations.length; i++) {
          if (stations[i].id === Number(b.stationId)) {
            s = stations[i];
          }
        }
        if (s === null) {
          res.status(404).json({ msg: 'no station' });
        } else {
          if (s.b.length >= s.cap) {
            res.status(409).json({ msg: 'station full' });
          } else {
            let u = null;
            for (let i = 0; i < users.length; i++) {
              if (users[i].id === e.u) {
                u = users[i];
              }
            }
            const r2 = e.b;
            let x = null;
            for (let i = 0; i < bikes.length; i++) {
              if (bikes[i].id === r2) {
                x = bikes[i];
              }
            }
            const t = Math.floor((Date.now() - e.start) / (1000 * 60));
            let t2 = 0;
            if (t <= 30) {
              t2 = 1;
            } else {
              t2 = 1 + (t - 30) * 0.15;
            }
            if (e.el === true) {
              t2 = t2 + 2.5;
            }
            if (t > 1440) {
              t2 = t2 + 25;
            }
            if (u !== null) {
              if (u.sub === 'premium') {
                t2 = t2 * 0.8;
              }
            }
            t2 = money(t2);
            let res2 = null;
            try {
              res2 = capture(u, e.ref, t2);
            } catch (er) {}
            e.end = Date.now();
            e.endSt = s.id;
            e.s = 2;
            e.price = t2;
            if (x !== null) {
              x.s = 0;
              x.st = s.id;
              x.km = x.km + Math.floor(t / 4);
              s.b.push(x.id);
            }
            let acc = 0;
            for (let i = 0; i < stations.length; i++) {
              acc = acc + stations[i].b.length;
            }
            const tmp = acc / stations.length;
            if (s.b.length > tmp * 1.5) {
              try {
                sleep(150);
                log('INFO', 'rebalancing triggered', s.id);
              } catch (er) {}
            }
            res.json({
              msg: 'ok',
              rentalId: e.id,
              minutes: t,
              price: t2,
              station: s.name,
              captured: res2 === null ? false : true
            });
          }
        }
      }
    }
  }
}

export function handleStations(req, res) {
  const arr = [];
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const g = geo(s.lat, s.lng);
    let acc = 0;
    let t2 = 0;
    const d = [];
    for (let j = 0; j < bikes.length; j++) {
      const e = bikes[j];
      if (e.st === s.id) {
        if (e.s === 0) {
          acc = acc + 1;
          if (e.el === true) {
            t2 = t2 + 1;
          }
          d.push({ id: e.id, el: e.el, km: e.km });
        } else {
          if (e.s === 3) {
            d.push({ id: e.id, el: e.el, km: e.km, broken: true });
          }
        }
        d.sort(function (a, b2) {
          return a.km - b2.km;
        });
      }
    }
    arr.push({
      id: s.id,
      name: s.name,
      zone: g.zone,
      weather: g.w,
      free: acc,
      electric: t2,
      slots: s.cap - s.b.length,
      bikes: d
    });
  }
  res.json(arr);
}

export function handleRentalById(req, res) {
  let e = null;
  for (let i = 0; i < rentals.length; i++) {
    if (rentals[i].id === Number(req.params.id)) {
      e = rentals[i];
    }
  }
  if (e === null) {
    res.status(404).json({ msg: 'no rental' });
  } else {
    let u = null;
    for (let i = 0; i < users.length; i++) {
      if (users[i].id === e.u) {
        u = users[i];
      }
    }
    let t = 0;
    if (e.end === null) {
      t = Math.floor((Date.now() - e.start) / (1000 * 60));
    } else {
      t = Math.floor((e.end - e.start) / (1000 * 60));
    }
    let t2 = 0;
    if (t <= 30) {
      t2 = 1;
    } else {
      t2 = 1 + (t - 30) * 0.15;
    }
    if (e.el === true) {
      t2 = t2 + 2.5;
    }
    if (t > 1440) {
      t2 = t2 + 25;
    }
    if (u !== null) {
      if (u.sub === 'premium') {
        t2 = t2 * 0.8;
      }
    }
    const val = priceOf(t, e.el, u === null ? 'basic' : u.sub);
    res.json({
      msg: 'ok',
      id: e.id,
      bikeId: e.b,
      minutes: t,
      price: money(t2),
      estimate: val,
      open: e.end === null
    });
  }
}

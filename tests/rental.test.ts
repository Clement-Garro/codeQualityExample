import request from 'supertest';
import { app } from '../src/index';

// NOTE: these tests share the in-memory database and must run in order.

describe('rental api', () => {
  it('works', async () => {
    const r = await request(app).post('/rent').send({ userId: 1, stationId: 1 });
    expect(r.status).toBe(200);
    expect(r.body.msg).toContain('ok');
    expect(typeof r.body.rentalId).toBe('number');
  });

  it('returns something', async () => {
    const r = await request(app).post('/return').send({ rentalId: 1, stationId: 2 });
    expect(r.status).toBe(200);
    expect(typeof r.body.price).toBe('number');
    expect(r.body.msg).toContain('ok');
  });

  it('lists stuff', async () => {
    const r = await request(app).get('/stations');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
  });
});

import http from 'http';
import { app } from '../src/index';

const CONCURRENCY = 20;

function get(port: number, path: string): Promise<number> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path }, (res) => {
      res.resume();
      res.on('end', () => resolve(Date.now() - started));
    });
    req.on('error', reject);
  });
}

async function main() {
  const server = app.listen(0);
  const port = (server.address() as any).port;

  console.log(`Firing ${CONCURRENCY} parallel GET /stations requests...`);
  const started = Date.now();
  const latencies = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => get(port, '/stations'))
  );
  const total = Date.now() - started;

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);

  console.log('---');
  console.log(`total wall time : ${total} ms`);
  console.log(`mean latency    : ${Math.round(sum / latencies.length)} ms`);
  console.log(`min latency     : ${latencies[0]} ms`);
  console.log(`max latency     : ${latencies[latencies.length - 1]} ms`);
  console.log(`p95 latency     : ${latencies[Math.floor(latencies.length * 0.95) - 1]} ms`);
  console.log('---');
  console.log('If max latency grows linearly with concurrency, requests are serialised.');

  server.close();
}

main();

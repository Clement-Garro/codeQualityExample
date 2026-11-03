import http from 'http';
import { app } from '../src/index';

const CONCURRENCY = 20;

function measureGetLatency(port: number, path: string): Promise<number> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const request = http.get({ port, path }, (response) => {
      response.resume();
      response.on('end', () => resolve(Date.now() - startTime));
    });
    request.on('error', reject);
  });
}

async function runLoadTest() {
  const server = app.listen(0);
  const port = (server.address() as any).port;

  console.log(`Firing ${CONCURRENCY} parallel GET /stations requests...`);
  const startTime = Date.now();
  const latencies = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => measureGetLatency(port, '/stations'))
  );
  const totalWallTime = Date.now() - startTime;

  latencies.sort((firstLatency, secondLatency) => firstLatency - secondLatency);
  const latencySum = latencies.reduce((sum, latency) => sum + latency, 0);

  console.log('---');
  console.log(`total wall time : ${totalWallTime} ms`);
  console.log(`mean latency    : ${Math.round(latencySum / latencies.length)} ms`);
  console.log(`min latency     : ${latencies[0]} ms`);
  console.log(`max latency     : ${latencies[latencies.length - 1]} ms`);
  console.log(`p95 latency     : ${latencies[Math.floor(latencies.length * 0.95) - 1]} ms`);
  console.log('---');
  console.log('If max latency grows linearly with concurrency, requests are serialised.');

  server.close();
}

runLoadTest();

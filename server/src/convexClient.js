import { ConvexHttpClient } from 'convex/browser';

let convexClient = null;

export function createConvexClient(url = process.env.CONVEX_URL) {
  if (!url) {
    throw new Error('CONVEX_URL is required to create the Convex HTTP client');
  }

  return new ConvexHttpClient(url);
}

export function getConvexClient() {
  if (!convexClient) {
    convexClient = createConvexClient();
  }

  return convexClient;
}

export function setConvexClientForTests(testClient) {
  convexClient = testClient ?? null;
}

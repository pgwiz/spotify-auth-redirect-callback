'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Set env vars before requiring the app so dotenv doesn't overwrite them
process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:3000/callback';

const request = require('supertest');
const app = require('../index.js');

// ─── GET / ─────────────────────────────────────────────────────────────────
describe('GET /', () => {
  it('returns endpoint listing', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.ok(res.body.endpoints);
    assert.ok(res.body.endpoints['GET /login']);
    assert.ok(res.body.endpoints['GET /callback']);
    assert.ok(res.body.endpoints['GET /refresh_token']);
    assert.ok(res.body.endpoints['GET /health']);
  });
});

// ─── GET /health ───────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.timestamp);
  });
});

// ─── GET /login ────────────────────────────────────────────────────────────
describe('GET /login', () => {
  it('redirects to Spotify authorization URL', async () => {
    const res = await request(app).get('/login').redirects(0);
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('https://accounts.spotify.com/authorize'));
    const url = new URL(res.headers.location);
    assert.equal(url.searchParams.get('client_id'), 'test_client_id');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.ok(url.searchParams.get('state'));
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/callback');
  });
});

// ─── GET /callback ─────────────────────────────────────────────────────────
describe('GET /callback', () => {
  it('returns 400 when Spotify sends an error', async () => {
    const res = await request(app).get('/callback?error=access_denied&state=abc');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'access_denied');
  });

  it('returns 400 when no code and no error are present', async () => {
    const res = await request(app).get('/callback');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'missing_code');
  });
});

// ─── GET /refresh_token ────────────────────────────────────────────────────
describe('GET /refresh_token', () => {
  it('returns 400 when refresh_token query param is missing', async () => {
    const res = await request(app).get('/refresh_token');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'missing_refresh_token');
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────
describe('Unknown route', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'not_found');
  });
});

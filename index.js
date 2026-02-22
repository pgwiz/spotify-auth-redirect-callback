'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration (loaded from environment) ───────────────────────────────
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const PORT = process.env.PORT || 3000;

// Scopes requested from Spotify
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-read',
  'user-top-read',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random state string to prevent CSRF.
 * @param {number} length
 * @returns {string}
 */
function generateState(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Exchange an authorization code or refresh token for tokens via Spotify.
 * @param {URLSearchParams} body
 * @returns {Promise<object>}
 */
async function requestSpotifyTokens(body) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });
  return response.json();
}

// ─── Middleware: require env vars ──────────────────────────────────────────
app.use((req, res, next) => {
  if (['/health', '/'].includes(req.path)) return next();
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).json({
      error: 'server_misconfigured',
      message:
        'SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI must be set in environment variables.',
    });
  }
  next();
});

// ─── Endpoints ────────────────────────────────────────────────────────────

/**
 * GET /
 * Home — lists available endpoints.
 */
app.get('/', (req, res) => {
  res.json({
    name: 'spotify-auth-redirect-callback',
    endpoints: {
      'GET /health': 'Health check',
      'GET /login': 'Redirect to Spotify authorization page',
      'GET /callback': 'Spotify OAuth2 callback (handles success & failure)',
      'GET /refresh_token': 'Refresh an access token (query: refresh_token)',
    },
  });
});

/**
 * GET /health
 * Health check — used by Koyeb, Heroku, Vercel, and other platforms.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /login
 * Redirects the user to the Spotify authorization page.
 * A random `state` value is appended to guard against CSRF.
 */
app.get('/login', (req, res) => {
  const state = generateState();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

/**
 * GET /callback
 * Spotify redirects here after the user authorizes (or denies) access.
 *
 * Success: Spotify sends `code` and `state`.
 * Failure: Spotify sends `error` (e.g. "access_denied") and `state`.
 */
app.get('/callback', async (req, res) => {
  const { code, error, state } = req.query;

  // ── Authorization denied or errored by Spotify ──────────────────────────
  if (error) {
    return res.status(400).json({
      success: false,
      error,
      message: `Spotify authorization failed: ${error}`,
      state: state || null,
    });
  }

  // ── Missing code ─────────────────────────────────────────────────────────
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'missing_code',
      message: 'No authorization code was returned by Spotify.',
    });
  }

  // ── Exchange code for tokens ─────────────────────────────────────────────
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    });

    const data = await requestSpotifyTokens(body);

    if (data.error) {
      return res.status(400).json({
        success: false,
        error: data.error,
        message: data.error_description || 'Token exchange failed.',
      });
    }

    return res.json({
      success: true,
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'token_exchange_error',
      message: err.message,
    });
  }
});

/**
 * GET /refresh_token
 * Issues a new access token given a valid refresh token.
 *
 * Query params:
 *   - refresh_token (required)
 */
app.get('/refresh_token', async (req, res) => {
  const { refresh_token } = req.query;

  if (!refresh_token) {
    return res.status(400).json({
      success: false,
      error: 'missing_refresh_token',
      message: 'Query parameter "refresh_token" is required.',
    });
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    });

    const data = await requestSpotifyTokens(body);

    if (data.error) {
      return res.status(400).json({
        success: false,
        error: data.error,
        message: data.error_description || 'Token refresh failed.',
      });
    }

    return res.json({
      success: true,
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
      expires_in: data.expires_in,
      // Spotify may return a new refresh_token; pass it along if present
      ...(data.refresh_token && { refresh_token: data.refresh_token }),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'refresh_token_error',
      message: err.message,
    });
  }
});

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─── Start server ─────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`spotify-auth-redirect-callback listening on port ${PORT}`);
  });
}

module.exports = app;

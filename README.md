# spotify-auth-redirect-callback

A lightweight **Node.js / Express** service that implements the [Spotify Authorization Code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow).  
It exposes multiple endpoints so your frontend can authenticate users, receive the access token, and refresh it without touching any secrets.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Lists all available endpoints |
| `GET` | `/health` | Health check (used by Koyeb, Heroku, and other platforms) |
| `GET` | `/login` | Redirects the browser to Spotify's authorization page |
| `GET` | `/callback` | Handles Spotify's redirect — returns tokens on success, error details on failure |
| `GET` | `/refresh_token?refresh_token=<token>` | Exchanges a refresh token for a new access token |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-domain.com/callback
PORT=3000                        # optional, defaults to 3000
```

> **Never commit your `.env` file.** It is already excluded by `.gitignore`.

---

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.example .env
#    edit .env with your Spotify Dashboard credentials

# 3. Start the server
npm start
# → Listening on http://localhost:3000
```

Then open `http://localhost:3000/login` in your browser to start the OAuth flow.

---

## Deployment

### Heroku

```bash
heroku create my-spotify-auth
heroku config:set SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy SPOTIFY_REDIRECT_URI=https://my-spotify-auth.herokuapp.com/callback
git push heroku main
```

The `Procfile` (`web: node index.js`) tells Heroku how to start the app.

---

### Koyeb

1. Create a new **Web Service** pointing at this repository.  
2. Set the **Run command** to `node index.js` (or leave it; Koyeb reads the `Procfile`).  
3. Add the three environment variables in the Koyeb dashboard.  
4. Koyeb sets `PORT` automatically; the server reads it.

---

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Set the environment variables in the Vercel project settings or via:

```bash
vercel env add SPOTIFY_CLIENT_ID
vercel env add SPOTIFY_CLIENT_SECRET
vercel env add SPOTIFY_REDIRECT_URI
```

The `vercel.json` file routes all requests through `index.js`.

---

### VPS (Ubuntu / Debian)

```bash
# Clone and install
git clone https://github.com/your-org/spotify-auth-redirect-callback.git
cd spotify-auth-redirect-callback
npm install --omit=dev

# Set env vars (e.g. via /etc/environment or a systemd unit)
export SPOTIFY_CLIENT_ID=xxx
export SPOTIFY_CLIENT_SECRET=yyy
export SPOTIFY_REDIRECT_URI=https://your-domain.com/callback
export PORT=3000

# Run (or manage with PM2 / systemd)
npm start
```

---

## Testing

```bash
npm test
```

---

## OAuth Flow — Quick Summary

```
Browser  →  GET /login
           ↓
         Spotify authorization page (user logs in & consents)
           ↓
         GET /callback?code=AUTH_CODE&state=RANDOM
           ↓ (server exchanges code for tokens)
         JSON: { success: true, access_token, refresh_token, ... }

Later:   GET /refresh_token?refresh_token=REFRESH_TOKEN
           ↓
         JSON: { success: true, access_token, expires_in, ... }
```

---

## License

MIT

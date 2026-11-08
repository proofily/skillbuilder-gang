# Group chat

## Run locally
    npm install
    npm start
Open http://localhost:3000

## Deploy: frontend on GitHub Pages, server on Render

### 1. Server (Render)
1. Push this whole folder to a GitHub repo.
2. Render -> New -> Web Service -> pick the repo.
3. Build command: `npm install`   Start command: `npm start`
4. Add env var `ALLOWED_ORIGIN` = `https://YOURUSER.github.io` (no trailing slash, no path).
5. Deploy. Copy the URL Render gives you (https://something.onrender.com).

### 2. Frontend (GitHub Pages)
1. Edit `public/config.js` and set `window.SERVER_URL` to your Render URL.
2. Commit and push.
3. Repo -> Settings -> Pages -> deploy from a branch -> choose the branch and the `/public` folder
   (if `/public` isn't offered, move the contents of `public/` to a `docs/` folder and pick `/docs`).
4. Your chat lives at https://YOURUSER.github.io/REPO/

### Heads up
- Render's free tier sleeps after inactivity (first load can take ~30-60 s) and its disk is
  temporary, so `chat.db` (message history and custom channels) resets on restarts/redeploys.
  For permanent history you'd need a persistent disk or an external database.

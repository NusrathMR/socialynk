# Sandbox Social Media

A standalone social-post publishing simulator and feed for local Socialynk integration. It accepts posts from Socialynk, stores them in MongoDB, and displays the received posts in a responsive React app. It does **not** publish to real social networks.

## Requirements

- Node.js 18 or newer and npm
- MongoDB Community Server running locally, or another MongoDB connection string

## Project layout

- `backend/` — Express/Mongoose API on port 5000
- `frontend/` — Vite/React application on port 5173

## Setup

1. Start MongoDB. The default local connection is `mongodb://127.0.0.1:27017/fake_social_db`; MongoDB creates the database when the first post is written.
2. In `backend/`, copy `.env.example` to `.env`. Set `MONGODB_URI`, `PORT`, and a private, randomly generated `FAKE_SOCIAL_API_KEY`. The included `.env` contains a local development placeholder; replace it before use beyond a trusted local machine.
3. In `frontend/`, copy `.env.example` to `.env` if you need to change the API URL. The default is `http://localhost:5000/api`. The API key is never used by or bundled into the frontend.
4. Install and start each application in separate terminals:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). The API health check is `http://localhost:5000/api/health`.

For production, run `npm start` in `backend/` and build the frontend with `npm run build` in `frontend/`, then serve `frontend/dist/` using your chosen static host.

## API

All responses are JSON and use `success` to indicate request outcome.

### Publish/simulate a post

`POST http://localhost:5000/api/posts` — requires `x-api-key`; the public feed endpoints do not.

Headers:

```http
Content-Type: application/json
x-api-key: YOUR_FAKE_SOCIAL_API_KEY
```

Body:

```json
{
  "platform": "instagram",
  "text": "Hello from Socialynk!",
  "authorName": "Socialynk User",
  "sourcePostId": "unique_socialynk_post_id"
}
```

Newly created posts return HTTP `201` with `published: true`. Repeated requests for the same `(platform, sourcePostId)` return HTTP `200`, `published: false`, and the existing post. A unique compound MongoDB index makes that guarantee safe when identical requests arrive concurrently. `platform` must be one of `instagram`, `facebook`, `linkedin`, `twitter`, `tiktok`, or `youtube`; required strings must be non-empty.

### List posts

`GET http://localhost:5000/api/posts?page=1&limit=12&platform=instagram`

- `platform` is optional and accepts the six supported platforms.
- `page` defaults to 1; `limit` defaults to 12 and must be from 1 to 100.
- Posts are sorted newest first.
- Response includes `data` and `pagination` (`page`, `limit`, `total`, `pages`, `hasNextPage`, `hasPreviousPage`).

### Retrieve a post

`GET http://localhost:5000/api/posts/:id` — returns the post or `404`. Invalid MongoDB IDs return `400`.

### Health check

`GET http://localhost:5000/api/health`

## Postman / cURL checks

In Postman, create a `POST` request to `http://localhost:5000/api/posts`, add the `x-api-key` and `Content-Type: application/json` headers above, and paste the sample JSON body. Send it twice: expect `201` then `200` with `published: false`. Then try `GET http://localhost:5000/api/posts`, `GET http://localhost:5000/api/posts?platform=instagram&page=1&limit=5`, and `GET http://localhost:5000/api/posts/<returned-id>` without an API key.

Equivalent PowerShell examples:

```powershell
$headers = @{ "x-api-key" = "YOUR_FAKE_SOCIAL_API_KEY" }
$body = @{
  platform = "instagram"
  text = "Hello from Socialynk!"
  authorName = "Socialynk User"
  sourcePostId = "unique_socialynk_post_id"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/posts" `
  -Headers $headers -ContentType "application/json" -Body $body
Invoke-RestMethod -Uri "http://localhost:5000/api/posts?platform=instagram&page=1&limit=5"
```

## Connect Socialynk

Configure Socialynk's sandbox publishing destination to send the JSON body above to `http://localhost:5000/api/posts` and include the backend `FAKE_SOCIAL_API_KEY` as the `x-api-key` header. Keep the key only in trusted server-side configuration; never put it in frontend code. For a Socialynk process on another machine/container, use a reachable backend hostname instead of `localhost`. The endpoint simulates publishing only and does not contact Instagram, Facebook, LinkedIn, X, TikTok, or YouTube.

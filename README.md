# MatchLens

MatchLens is a football analytics and match intelligence web application that aggregates live league standings, fixtures, football news, and AI-powered match insights in a clean, interactive interface.

- **Live Deployed App:** [MatchLens Live](https://app.matchlensapp.tech)
- **Demo Video:** [Watch Demo Video](INSERT_YOUR_DEMO_VIDEO_LINK_HERE) *(Replace with your YouTube/Vimeo/Loom link — max 2 minutes)*

---

## Features

- **Live Standings & Fixtures:** Browse real-time league tables, team badges, and upcoming/recent match results across major football competitions.
- **Interactive Filtering & Pagination:** Filter data by competition or tab and dynamically load additional fixtures and news articles.
- **Curated Football News:** Fetches up-to-date football headlines with built-in server-side caching to minimize redundant API calls and stay within rate limits.
- **AI Match Insights:** Uses Google Gemini to generate concise match context and analysis.
- **Graceful Error Handling:** Handles upstream API rate limits, network timeouts, and invalid query parameters with clear user feedback.

---

## Tech Stack & Architecture

- **Backend:** Node.js (v22), Express
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Process Manager:** PM2 (keeps the Node.js application running across sessions and server reboots)
- **Reverse Proxy:** Nginx (on `web-01` and `web-02`, forwarding port `80` traffic to Node on port `5500`)
- **Load Balancer & SSL:** HAProxy on `lb-01` with Let's Encrypt / Certbot SSL termination (`https://app.matchlensapp.tech`) distributing traffic via `roundrobin`

### Infrastructure Topology

```text
Client (HTTPS :443)
        │
        ▼
  lb-01 (HAProxy — 18.171.53.106)
   ├── Round-Robin ──► web-01 (Nginx :80 -> Node :5500 — 3.8.148.34)
   └── Round-Robin ──► web-02 (Nginx :80 -> Node :5500 — 13.40.44.66)
```

---

## Local Setup & Installation

### Prerequisites
- Node.js (v18 or higher; v22 recommended)
- npm and Git
- API keys for Football-Data.org, Google Gemini, and GNews

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/kevinishimwe2/MatchLens.git
   cd MatchLens
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory (excluded from version control via `.gitignore`):
   ```env
   API_URL=https://api.football-data.org/v4
   TOKEN=your_football_data_api_key
   GEMINI_API_KEY=your_gemini_api_key
   GNEWS_API_KEY=your_gnews_api_key
   PORT=5500
   ```

4. **Run the application locally:**
   ```bash
   node server.js
   ```
   Open `http://localhost:5500` in your browser.

---

## Multi-Server Deployment Guide

MatchLens is deployed across two application servers (`7137-web-01` and `7137-web-02`) behind an HAProxy load balancer (`7137-lb-01`).

### 1. Application Servers (`web-01` & `web-02`)
On both `3.8.148.34` (`7137-web-01`) and `13.40.44.66` (`7137-web-02`):

1. **Install Node.js v22, Git, Nginx, and PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git nginx
   sudo npm install -g pm2
   ```

2. **Clone the repository and configure `.env`:**
   ```bash
   git clone https://github.com/kevinishimwe2/MatchLens.git
   cd MatchLens
   npm install
   # Create .env with production API keys and PORT=5500
   ```

3. **Start the Node.js server with PM2:**
   ```bash
   pm2 start server.js --name matchlens
   pm2 save
   pm2 startup
   # Execute the generated startup command, then run `pm2 save` again
   ```

4. **Configure Nginx as a reverse proxy (`/etc/nginx/sites-available/default`):**
   ```nginx
   server {
       listen 80 default_server;
       listen [::]:80 default_server;
       server_name _;

       add_header X-Served-By $hostname always;

       location / {
           proxy_pass http://127.0.0.1:5500;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Test and reload Nginx:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

### 2. DNS & Load Balancer (`lb-01`)
1. **DNS Configuration:** Added an `A` record for `app.matchlensapp.tech` pointing to `18.171.53.106` (`7137-lb-01`).
2. **SSL Certificate:** Generated a TLS certificate using Certbot standalone mode and combined `fullchain.pem` and `privkey.pem` into `/etc/haproxy/certs/app.matchlensapp.tech.pem`.
3. **HAProxy Configuration (`/etc/haproxy/haproxy.cfg`):**
   ```haproxy
   frontend http_front
       bind *:80
       mode http
       http-request redirect scheme https code 301

   frontend https_front
       bind *:443 ssl crt /etc/haproxy/certs/
       mode http
       http-request set-header X-Forwarded-Proto https
       default_backend web_servers

   backend web_servers
       mode http
       balance roundrobin
       server 7137-web-01 3.8.148.34:80 check
       server 7137-web-02 13.40.44.66:80 check
   ```

### 3. Verification
Load balancing and server alternation were verified via HTTP response headers:
```bash
for i in {1..4}; do curl -sI https://app.matchlensapp.tech | grep -iE "HTTP|X-Served-By"; done
```
Responses alternate between `x-served-by: 7137-web-01` and `x-served-by: 7137-web-02` with `HTTP/1.1 200 OK`.

---

## Challenges & Solutions
- **Challenges:
- The web servers being down;
- api not responding;
- laptop lagging.

- **Solutions:
- I requested a new server on platform;
- I tried other apis to replace those weren't working;


---

## API & Resource Credits

- **[Football-Data.org API](https://www.football-data.org/documentation/quickstart):** Match fixtures, league standings, and team crest data.
- **[Google Gemini API](https://ai.google.dev/gemini-api/docs):** AI-powered match analysis and insights.
- **[GNews API](https://gnews.io/docs/v4):** Real-time sports and football news headlines.
- **[PM2](https://pm2.keymetrics.io/), [Nginx](https://nginx.org/), and [HAProxy](https://www.haproxy.org/):** Process management, reverse proxying, and load balancing.
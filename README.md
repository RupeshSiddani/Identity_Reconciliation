# Identity Reconciliation API

A REST API that identifies and links customer contacts across multiple email/phone combinations, built for the Bitespeed backend task.

## Live Endpoint

```
POST https://<your-render-url>/identify
```

> **Replace** `<your-render-url>` with your deployed Render.com URL after deployment.

---

## How It Works

The `/identify` endpoint consolidates contact records so that one real person is always linked under a single **primary** contact, no matter how many different email/phone combinations they use.

### Business Rules

| Scenario | Behaviour |
|---|---|
| No match found | Create a new **primary** contact |
| Partial match (new info) | Create a **secondary** contact linked to the existing primary |
| Exact match | Return existing consolidated contact (no new row) |
| Two separate primaries linked | Older stays primary; newer demoted + its children re-linked |

---

## Request

```http
POST /identify
Content-Type: application/json

{
  "email": "mcfly@hillvalley.edu",       // optional
  "phoneNumber": "123456"                 // optional (can be number or string)
}
```

At least one of `email` or `phoneNumber` must be provided.

## Response

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- A PostgreSQL connection string (free tier: [neon.tech](https://neon.tech))

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/identity-reconciliation.git
cd identity-reconciliation

# 2. Install dependencies
npm install

# 3. Add your database URL
# Edit .env and replace the placeholder:
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# 4. Run database migrations
npx prisma migrate deploy

# 5. Start development server
npm run dev
# → Server running on http://localhost:3000
```

---

## Deployment (Render.com + Neon.tech)

### Database — [neon.tech](https://neon.tech) (Free PostgreSQL)
1. Create a free account → New Project
2. Copy the **Connection String**
3. Run `npx prisma migrate deploy` with the production `DATABASE_URL`

### Backend — [render.com](https://render.com) (Free Web Service)
1. Push this repo to GitHub
2. Render → New → Web Service → connect repo
3. Set:
   - **Build Command:** `npm install && npx prisma generate && npx tsc`
   - **Start Command:** `node dist/index.js`
   - **Environment Variable:** `DATABASE_URL` = your Neon connection string
4. Deploy → your live URL will be `https://<app>.onrender.com`

---

## Project Structure

```
src/
├── index.ts                    # Express app entry
├── routes/identify.ts          # POST /identify route
├── controllers/
│   └── identifyController.ts   # Request validation & response
├── services/
│   └── contactService.ts       # All business logic
├── db/prisma.ts                # Prisma client singleton
└── types/index.ts              # TypeScript interfaces
prisma/
└── schema.prisma               # Contact model
prisma.config.ts                # Prisma 7 datasource config
```

---

## Quick Test (curl)

```bash
# New contact
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phoneNumber":"999"}'

# Partial match → secondary created
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"other@example.com","phoneNumber":"999"}'

# Two primaries merge
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"george@example.com","phoneNumber":"111"}'

curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phoneNumber":"111"}'
```

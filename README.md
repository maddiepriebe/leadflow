# leadflow
A SaaS-style web application that helps small-to-medium B2B sales teams discover high-potential prospects, automate personalized outreach, track interactions in real time, and visualize pipeline health.

## Architecture 
### Frontend (User-Facing App)
- **React** with Vite for fast development
- **Tailwind CSS** for consistent design, styling
- **React Router** for navigation
- **Axios** for API communication
- **Radix UI** accessible features
- **Recharts** for funnel and Ops charts, data visualization

### Backend (Logic and APIs)
- **Node.js** with express framework for API gateway and webhooks
- **MangoDB and Mongoose**
- **JWT Authentication** for short lives access tokens
- **Azure OpenAI** for AI powered analysis
- **BullMQ + Redis** for queue and workers, handle jobs off request path
- **Bull Board or Tashforce.sh** for visibility into jobs, monitor of latency and failure

### External Integrations
- **Lead Sourcing (LinkedIn, Apollo, Hunter, Meta)** - information and enrichment providers
- **Trengo** - outbound and inbound messaging
- **Azure OpenAI** - personalization, scoring, classification

## Project Structure 

```tree
🏗️ Project Architecture
leadflow/ (Turbo Monorepo)
│
├── apps/
│   ├── web/                    # Frontend React App (Port 3000)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── leads/      → Lead Management UI
│   │   │   │   ├── icp/        → Ideal Customer Profile
│   │   │   │   ├── sequences/  → Outreach Sequences
│   │   │   │   ├── inbox/      → Message Center
│   │   │   │   └── analytics/  → Dashboard & Metrics
│   │   │   ├── components/     → Layout components
│   │   │   └── lib/            → Utilities
│   │   └── Tech: React 18 + Vite + Tailwind + TypeScript
│   │
│   └── api/                    # Backend Express Server (Port 5000)
│       ├── src/
│       │   ├── routes/         → REST API endpoints
│       │   ├── queues/         → Job queue config
│       │   ├── workers/        → Background processors
│       │   └── providers/      → External integrations
│       ├── prisma/             → Database schema & migrations
│       └── Tech: Express + Prisma + PostgreSQL + Redis
│
└── packages/
    ├── types/                  # Shared TypeScript types
    │   └── Lead, Campaign, Sequence, Message, ICP interfaces
    │
    └── ui/                     # Reusable React components
        └── Button, Card, etc.
```
```tree 
🔄 System Flow Diagram
┌──────────────────────────────────────────────────────────┐
│                  User Browser                             │
│                  localhost:3000                           │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ React Router Pages:
                     │ /leads /icp /sequences /inbox /analytics
                     │
┌────────────────────▼─────────────────────────────────────┐
│          apps/web (React + Vite)                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Components use @leadflow/types & @leadflow/ui   │    │
│  │ Axios HTTP calls to /api/*                       │    │
│  └──────────────────┬───────────────────────────────┘    │
└─────────────────────┼────────────────────────────────────┘
                      │
                      │ API Proxy (Vite forwards to :5000)
                      │
┌─────────────────────▼────────────────────────────────────┐
│          apps/api (Express Server)                       │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Routes:                                          │    │
│  │  • GET/POST /api/leads                           │    │
│  │  • GET/POST /api/sequences                       │    │
│  │  • GET/POST /api/inbox                           │    │
│  │  • GET /api/analytics/dashboard                  │    │
│  └──────┬──────────────────────┬────────────────────┘    │
└─────────┼──────────────────────┼─────────────────────────┘
          │                      │
          │                      │
    ┌─────▼──────┐        ┌─────▼──────┐
    │PostgreSQL  │        │   Redis    │
    │  (Prisma)  │        │  (BullMQ)  │
    │            │        │            │
    │ • Leads    │        │ • Jobs     │
    │ • Campaigns│        │ • Workers  │
    │ • Sequences│        │ • Queues   │
    │ • Messages │        │            │
    │ • ICP      │        │            │
    └────────────┘        └────────────┘
```

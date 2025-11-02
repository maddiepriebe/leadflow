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
```


# Quick Start: Build Your First Page

This guide will walk you through building your first professional-looking page in **10 minutes**.

## Prerequisites

Make sure your dev server is running:
```bash
cd apps/web
npm run dev
```

Your app should be running at http://localhost:3000

---

## Step 1: Create a New Page (2 min)

Create a file: `apps/web/src/pages/dashboard/DashboardPage.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react'

export default function DashboardPage() {
  // Sample data (later you'll fetch this from your API)
  const stats = [
    {
      title: 'Total Leads',
      value: '2,345',
      change: '+12.5%',
      icon: Users,
    },
    {
      title: 'Conversion Rate',
      value: '18.2%',
      change: '+4.3%',
      icon: TrendingUp,
    },
    {
      title: 'Revenue',
      value: '$45,231',
      change: '+8.1%',
      icon: DollarSign,
    },
    {
      title: 'Active Campaigns',
      value: '12',
      change: '+2',
      icon: Activity,
    },
  ]

  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{stat.change}</span> from last month
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your recent activity will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Step 2: Add the Route (1 min)

Open `apps/web/src/App.tsx` and add:

```tsx
import DashboardPage from './pages/dashboard/DashboardPage'

// Inside your <Routes>:
<Route path="/dashboard" element={<DashboardPage />} />
```

---

## Step 3: Add Navigation Link (1 min)

Open `apps/web/src/components/Layout.tsx` and add a link to your new page in the navigation.

Find the `<nav>` section and add:

```tsx
<Link to="/dashboard">Dashboard</Link>
```

---

## Step 4: View Your Page! (1 min)

Go to http://localhost:3000/dashboard

You should see your new dashboard page with:
- A header
- 4 stat cards in a responsive grid
- A recent activity card

**Congratulations!** You just built a professional-looking page with shadcn/ui.

---

## Step 5: Customize It (5 min)

### Add Real Data

Replace the static `stats` array with data from your API:

```tsx
import { useState, useEffect } from 'react'
import axios from 'axios'

export default function DashboardPage() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await axios.get('/api/analytics/dashboard')
        setStats(response.data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) return <div>Loading...</div>

  // ... rest of your component
}
```

### Change Colors

Want a different color scheme? Update `apps/web/src/index.css`:

```css
:root {
  --primary: 142 76% 36%;  /* Green */
  --secondary: 217 33% 17%; /* Dark Blue */
}
```

### Add Interactivity

Make the cards clickable:

```tsx
<Card
  key={stat.title}
  className="cursor-pointer hover:shadow-lg transition-shadow"
  onClick={() => alert(`Clicked ${stat.title}`)}
>
  {/* ... */}
</Card>
```

---

## Next Steps

Now that you've built your first page, try these:

1. **Add more cards** - Create a card for "Tasks" or "Notifications"
2. **Add a chart** - Use Recharts (already installed) to add a line chart
3. **Create a form** - Build a "Create Lead" form with Input and Button
4. **Add filtering** - Add a date picker to filter stats by date range

---

## Common Patterns You'll Use

### Pattern 1: Display a List

```tsx
<div className="space-y-4">
  {items.map((item) => (
    <Card key={item.id}>
      <CardContent className="p-4">
        <h3>{item.name}</h3>
      </CardContent>
    </Card>
  ))}
</div>
```

### Pattern 2: Button Actions

```tsx
<Button onClick={() => handleAction()}>
  Click Me
</Button>

<Button variant="outline" onClick={() => handleSecondary()}>
  Secondary Action
</Button>
```

### Pattern 3: Show/Hide Content

```tsx
const [showDetails, setShowDetails] = useState(false)

return (
  <>
    <Button onClick={() => setShowDetails(!showDetails)}>
      Toggle Details
    </Button>

    {showDetails && (
      <Card>
        <CardContent>Details here...</CardContent>
      </Card>
    )}
  </>
)
```

---

## Helpful Tips

1. **Use the guide** - Refer to `FRONTEND_GUIDE.md` for detailed explanations
2. **Check examples** - Look at `LeadsPageExample.tsx` for a complete example
3. **Inspect components** - Read the code in `components/ui/` to understand how they work
4. **Use TypeScript** - Let your editor autocomplete and catch errors
5. **Start simple** - Build small, test often, iterate

---

## Troubleshooting

**Page not showing?**
- Check that you added the route in `App.tsx`
- Make sure the path matches (e.g., `/dashboard`)
- Check the browser console for errors (F12)

**Styles not working?**
- Make sure you're importing from `@/components/ui/`
- Check that `index.css` has the CSS variables
- Restart the dev server (`npm run dev`)

**TypeScript errors?**
- Define your types/interfaces at the top of the file
- Use `any` temporarily if stuck (but try to fix later)
- Check that you installed `@leadflow/types`

---

## Resources

- [Full Frontend Guide](./FRONTEND_GUIDE.md) - Complete guide with all patterns
- [shadcn/ui Docs](https://ui.shadcn.com) - Component documentation
- [Tailwind CSS](https://tailwindcss.com/docs) - CSS utility classes
- [React Docs](https://react.dev) - React fundamentals

---

**Ready to build more?** Open `FRONTEND_GUIDE.md` for the complete guide!

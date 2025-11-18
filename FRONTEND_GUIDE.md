# Frontend Development Guide for LeadFlow

## Welcome! 👋

This guide will teach you how to build a professional frontend from scratch, even if you've never coded frontend before. We'll use **shadcn/ui** - a collection of beautiful, accessible components built with React and Tailwind CSS.

---

## Table of Contents

1. [Understanding the Stack](#understanding-the-stack)
2. [Key Concepts](#key-concepts)
3. [Project Structure](#project-structure)
4. [How to Build a Page (Step-by-Step)](#how-to-build-a-page-step-by-step)
5. [Common Patterns](#common-patterns)
6. [Component Library Reference](#component-library-reference)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Understanding the Stack

### What is each technology?

**React** - A JavaScript library for building user interfaces
- Think of it like LEGO blocks - you build small pieces (components) and combine them
- Components are reusable pieces of UI (like a button, card, or entire page)

**TypeScript** - JavaScript with types
- Helps catch errors before you run your code
- Gives you autocomplete in your editor (makes coding faster!)

**Tailwind CSS** - A utility-first CSS framework
- Instead of writing custom CSS, you use pre-made classes
- Example: `bg-blue-500 text-white p-4` = blue background, white text, padding

**shadcn/ui** - A component library
- Pre-built, beautiful components (buttons, cards, tables, etc.)
- Copy-paste ready, fully customizable
- Built on Radix UI (accessible by default)

**Vite** - Build tool and dev server
- Super fast development server
- Hot reload: see changes instantly without refreshing

---

## Key Concepts

### 1. Components

A component is a function that returns HTML-like code (JSX):

```tsx
function Greeting() {
  return <h1>Hello, World!</h1>
}
```

### 2. Props

Props are how you pass data to components (like function parameters):

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}

// Usage:
<Greeting name="Alice" />
```

### 3. State

State is data that can change over time:

```tsx
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  )
}
```

### 4. Hooks

Hooks are special functions that let you use React features:
- `useState` - manage state
- `useEffect` - run code when component loads or updates
- `useNavigate` - navigate to different pages

---

## Project Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (Button, Card, etc.)
│   │   └── Layout.tsx       # Navigation/header wrapper
│   ├── pages/               # Your app pages
│   │   ├── leads/
│   │   ├── icp/
│   │   ├── sequences/
│   │   ├── inbox/
│   │   └── analytics/
│   ├── lib/
│   │   └── utils.ts         # Helper functions (like cn for classNames)
│   ├── App.tsx              # Main app with routes
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles + Tailwind config
```

**Where to put your code:**
- **Pages** → `src/pages/` - Full page views
- **Reusable components** → `src/components/` - Used across multiple pages
- **UI primitives** → `src/components/ui/` - shadcn/ui components (already set up!)

---

## How to Build a Page (Step-by-Step)

Let's build a complete page from scratch! We'll create a Lead Detail page.

### Step 1: Create the page file

Create `apps/web/src/pages/leads/LeadDetailPage.tsx`

```tsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function LeadDetailPage() {
  // Get the lead ID from the URL
  const { id } = useParams()

  // State to store lead data
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch lead data when page loads
  useEffect(() => {
    async function fetchLead() {
      try {
        const response = await fetch(`/api/leads/${id}`)
        const data = await response.json()
        setLead(data)
      } catch (error) {
        console.error('Error fetching lead:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLead()
  }, [id]) // Run when 'id' changes

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!lead) {
    return <div className="p-8">Lead not found</div>
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.email}</p>
        </div>
        <Badge variant={lead.status === 'hot' ? 'default' : 'secondary'}>
          {lead.status}
        </Badge>
      </div>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Company:</span> {lead.company}
          </div>
          <div>
            <span className="font-medium">Title:</span> {lead.title}
          </div>
          <div>
            <span className="font-medium">Phone:</span> {lead.phone}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button>Send Email</Button>
        <Button variant="outline">Add to Sequence</Button>
      </div>
    </div>
  )
}
```

### Step 2: Add the route

Open `apps/web/src/App.tsx` and add the route:

```tsx
import LeadDetailPage from './pages/leads/LeadDetailPage'

// Inside your <Routes>:
<Route path="/leads/:id" element={<LeadDetailPage />} />
```

### Step 3: Test it!

```bash
npm run dev
```

Visit: `http://localhost:3000/leads/123`

---

## Common Patterns

### Pattern 1: Fetching Data from API

```tsx
import { useState, useEffect } from 'react'

function MyComponent() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/endpoint')
        const json = await response.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, []) // Empty array = run once on mount

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return <div>{/* Render your data */}</div>
}
```

### Pattern 2: Displaying a List

```tsx
import { Card, CardContent } from '@/components/ui/card'

function LeadList({ leads }: { leads: Lead[] }) {
  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <Card key={lead.id}>
          <CardContent className="p-4">
            <h3 className="font-semibold">{lead.name}</h3>
            <p className="text-sm text-muted-foreground">{lead.email}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### Pattern 3: Form with Input

```tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function CreateLeadForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault() // Prevent page reload

    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email })
    })

    if (response.ok) {
      alert('Lead created!')
      setName('')
      setEmail('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit">Create Lead</Button>
    </form>
  )
}
```

### Pattern 4: Table Display

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function LeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>{lead.name}</TableCell>
            <TableCell>{lead.email}</TableCell>
            <TableCell>{lead.company}</TableCell>
            <TableCell>{lead.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Pattern 5: Conditional Rendering

```tsx
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={
      status === 'hot' ? 'default' :
      status === 'warm' ? 'secondary' :
      'outline'
    }>
      {status}
    </Badge>
  )
}
```

---

## Component Library Reference

### Button

```tsx
import { Button } from '@/components/ui/button'

// Variants
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
```

### Card

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Input

```tsx
import { Input } from '@/components/ui/input'

<Input type="text" placeholder="Enter name..." />
<Input type="email" placeholder="Email..." />
<Input type="password" placeholder="Password..." />
<Input disabled placeholder="Disabled" />
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="destructive">Error</Badge>
```

### Table

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## Best Practices

### 1. Component Organization

```tsx
// ✅ Good: One component per file
// LeadCard.tsx
export default function LeadCard({ lead }) {
  return <Card>...</Card>
}

// ❌ Bad: Multiple unrelated components in one file
```

### 2. TypeScript Types

```tsx
// ✅ Good: Define types for props
interface LeadCardProps {
  lead: Lead
  onSelect: (id: string) => void
}

function LeadCard({ lead, onSelect }: LeadCardProps) {
  // ...
}

// ❌ Bad: Using 'any' everywhere
function LeadCard({ lead }: { lead: any }) {
  // ...
}
```

### 3. Naming Conventions

- **Components**: PascalCase (e.g., `LeadCard`, `UserProfile`)
- **Files**: PascalCase for components (e.g., `LeadCard.tsx`)
- **Functions**: camelCase (e.g., `handleClick`, `fetchLeads`)
- **Variables**: camelCase (e.g., `userName`, `isLoading`)

### 4. Folder Structure for Pages

```
pages/
└── leads/
    ├── LeadsPage.tsx           # Main listing page
    ├── LeadDetailPage.tsx      # Single lead view
    └── components/             # Components used only in leads pages
        ├── LeadCard.tsx
        └── LeadFilters.tsx
```

### 5. Loading and Error States

Always handle loading and error states:

```tsx
function MyPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data found</div>

  return <div>{/* Render data */}</div>
}
```

---

## Tailwind CSS Cheat Sheet

### Layout
```tsx
<div className="container mx-auto">     {/* Centered container */}
<div className="flex">                   {/* Flexbox */}
<div className="grid grid-cols-3">      {/* 3-column grid */}
<div className="space-y-4">             {/* Vertical spacing */}
<div className="space-x-2">             {/* Horizontal spacing */}
```

### Spacing
```tsx
p-4      {/* padding: 1rem (16px) */}
px-4     {/* padding-left & right */}
py-4     {/* padding-top & bottom */}
m-4      {/* margin: 1rem */}
mt-8     {/* margin-top: 2rem */}
```

### Text
```tsx
text-sm           {/* Small text */}
text-lg           {/* Large text */}
text-3xl          {/* Extra large */}
font-bold         {/* Bold */}
font-semibold     {/* Semi-bold */}
text-center       {/* Centered */}
```

### Colors (using shadcn theme)
```tsx
bg-background           {/* Background color */}
text-foreground         {/* Text color */}
bg-primary              {/* Primary color */}
text-muted-foreground   {/* Muted text */}
border                  {/* Border color */}
```

### Common Utilities
```tsx
rounded-md      {/* Rounded corners */}
shadow-sm       {/* Small shadow */}
hover:bg-accent {/* Hover effect */}
cursor-pointer  {/* Pointer cursor */}
w-full          {/* Full width */}
h-screen        {/* Full viewport height */}
```

---

## Developer Workflow

### Daily Development Flow

1. **Start the dev server**
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Make changes to your code**
   - Files auto-save in VS Code
   - Browser auto-refreshes (hot reload)

3. **Check for errors**
   - Look at terminal for build errors
   - Look at browser console (F12) for runtime errors

4. **Test in browser**
   - Click around, try different scenarios
   - Test on different screen sizes

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add lead detail page"
   ```

### Adding a New Page Checklist

- [ ] Create page file in `src/pages/`
- [ ] Import necessary components from `@/components/ui/`
- [ ] Add route in `App.tsx`
- [ ] Test the page loads
- [ ] Add data fetching if needed
- [ ] Handle loading/error states
- [ ] Style with Tailwind classes
- [ ] Test responsiveness (mobile, tablet, desktop)

### Adding a New Component Checklist

- [ ] Create component file in `src/components/`
- [ ] Define TypeScript interface for props
- [ ] Use shadcn/ui components as building blocks
- [ ] Add proper className styling
- [ ] Export component as default
- [ ] Import and use in your page

---

## Troubleshooting

### Problem: "Module not found"

**Solution:** Check your import path
```tsx
// ✅ Correct (using @ alias)
import { Button } from '@/components/ui/button'

// ❌ Wrong
import { Button } from 'components/ui/button'
```

### Problem: Styles not applying

**Solution:** Make sure you're using the `cn()` utility for className
```tsx
// ✅ Correct
import { cn } from '@/lib/utils'
<div className={cn("p-4", className)}>

// ❌ Wrong
<div className={"p-4 " + className}>
```

### Problem: Component not re-rendering

**Solution:** Make sure you're using `setState` not direct mutation
```tsx
// ✅ Correct
setLeads([...leads, newLead])

// ❌ Wrong
leads.push(newLead) // This won't trigger re-render!
```

### Problem: API calls not working

**Solution:** Check Vite proxy config in `vite.config.ts`
```tsx
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
```

---

## Learning Resources

### Official Docs
- [React Docs](https://react.dev) - Learn React fundamentals
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Learn TypeScript
- [Tailwind CSS](https://tailwindcss.com/docs) - All Tailwind classes
- [shadcn/ui](https://ui.shadcn.com) - Component examples

### YouTube Channels
- Fireship (quick overviews)
- Web Dev Simplified (beginner-friendly)
- Theo - t3.gg (advanced patterns)

### Practice
- Build small projects (todo list, weather app)
- Clone existing UIs (Twitter, Instagram)
- Read other people's code on GitHub

---

## Next Steps

1. **Start with a simple page** - Pick the easiest page in your app and rebuild it
2. **Add one feature at a time** - Don't try to build everything at once
3. **Use the components** - Leverage shadcn/ui components, don't reinvent the wheel
4. **Ask questions** - Use ChatGPT/Claude when stuck, check Stack Overflow
5. **Iterate** - Your first version won't be perfect, and that's okay!

---

## Quick Reference: File Templates

### New Page Template

```tsx
// src/pages/example/ExamplePage.tsx
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ExamplePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch data here
    setLoading(false)
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Page Title</h1>

      <Card>
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Your content here */}
        </CardContent>
      </Card>
    </div>
  )
}
```

### New Component Template

```tsx
// src/components/ExampleComponent.tsx
import { cn } from '@/lib/utils'

interface ExampleComponentProps {
  title: string
  className?: string
}

export default function ExampleComponent({
  title,
  className
}: ExampleComponentProps) {
  return (
    <div className={cn("p-4 border rounded-md", className)}>
      <h3 className="font-semibold">{title}</h3>
    </div>
  )
}
```

---

**You're ready to build! 🚀**

Start with the examples above, experiment, break things (it's okay!), and learn by doing. Every professional developer started exactly where you are now.

Good luck!

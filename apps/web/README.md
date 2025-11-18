# LeadFlow Web App

Professional frontend built with React, TypeScript, and shadcn/ui.

## Getting Started

### Start Development Server

```bash
npm run dev
```

Your app will be available at http://localhost:3000

### Build for Production

```bash
npm run build
```

---

## 📚 Documentation for New Frontend Developers

If you're new to frontend development, start here:

### 1. **[Quick Start Guide](../../QUICKSTART.md)** ⚡
Build your first page in 10 minutes! A hands-on tutorial that gets you coding immediately.

### 2. **[Complete Frontend Guide](../../FRONTEND_GUIDE.md)** 📖
Comprehensive guide covering:
- Understanding React, TypeScript, and Tailwind
- Component patterns and best practices
- Step-by-step examples
- Common patterns you'll use daily
- Troubleshooting tips

### 3. **Component Showcase** 🎨
See all available components in action:
- Add this route to `App.tsx`:
  ```tsx
  import ComponentShowcase from './pages/ComponentShowcase'
  <Route path="/showcase" element={<ComponentShowcase />} />
  ```
- Visit http://localhost:3000/showcase

### 4. **Example Files** 💡
- `src/pages/leads/LeadsPageExample.tsx` - Full-featured page example
- `src/components/LeadCard.tsx` - Reusable component example
- Compare with original `LeadsPage.tsx` to see the improvements!

---

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (Button, Card, etc.)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   └── table.tsx
│   ├── Layout.tsx       # Navigation wrapper
│   └── LeadCard.tsx     # Example reusable component
├── pages/               # Your application pages
│   ├── leads/
│   ├── icp/
│   ├── sequences/
│   ├── inbox/
│   ├── analytics/
│   └── ComponentShowcase.tsx
├── lib/
│   └── utils.ts         # Utility functions (cn for classNames)
├── App.tsx              # Main app with routes
├── main.tsx             # Entry point
└── index.css            # Global styles + theme configuration
```

---

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library
- **React Router v6** - Client-side routing
- **Axios** - HTTP client
- **Lucide React** - Icon library

---

## Available Components

All components are in `src/components/ui/`:

- **Button** - Buttons with multiple variants and sizes
- **Card** - Container for content (Header, Content, Footer)
- **Input** - Text input fields
- **Badge** - Status indicators and labels
- **Table** - Data tables with sorting and styling

### Adding More Components

shadcn/ui has 50+ components available! To add more:

1. Visit https://ui.shadcn.com/docs/components
2. Find the component you want
3. Copy the code into `src/components/ui/[component-name].tsx`
4. Import and use it!

Popular components to add:
- Dialog/Modal
- Dropdown Menu
- Select
- Tabs
- Toast notifications
- Date Picker
- Form components

---

## How to Add a New Page

### 1. Create the page file

```tsx
// src/pages/example/ExamplePage.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ExamplePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">My Page</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your content here</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 2. Add the route

```tsx
// src/App.tsx
import ExamplePage from './pages/example/ExamplePage'

<Route path="/example" element={<ExamplePage />} />
```

### 3. Add navigation link

```tsx
// src/components/Layout.tsx
<Link to="/example">Example</Link>
```

---

## Common Patterns

### Fetch Data from API

```tsx
import { useState, useEffect } from 'react'
import axios from 'axios'

function MyPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/endpoint')
      .then(response => setData(response.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Loading...</div>

  return <div>{/* render data */}</div>
}
```

### Handle Form Input

```tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function MyForm() {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await axios.post('/api/endpoint', { name })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit">Submit</Button>
    </form>
  )
}
```

### Display a List

```tsx
function MyList({ items }: { items: any[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <h3>{item.name}</h3>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

---

## Styling with Tailwind

### Common Classes

```tsx
// Layout
<div className="container mx-auto p-8">         {/* Centered container */}
<div className="flex gap-4">                     {/* Flex with gap */}
<div className="grid grid-cols-3 gap-4">        {/* 3-column grid */}

// Spacing
<div className="p-4 m-4">                        {/* Padding & margin */}
<div className="space-y-4">                      {/* Vertical spacing */}

// Text
<h1 className="text-3xl font-bold">             {/* Large bold text */}
<p className="text-sm text-muted-foreground">   {/* Small muted text */}

// Colors (use theme variables)
<div className="bg-primary text-primary-foreground">
<div className="bg-background text-foreground">
```

### Responsive Design

```tsx
// Mobile first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

---

## TypeScript Tips

### Define Props Interface

```tsx
interface MyComponentProps {
  title: string
  count: number
  onSave: () => void
  optional?: boolean
}

function MyComponent({ title, count, onSave, optional }: MyComponentProps) {
  // ...
}
```

### Use Types from @leadflow/types

```tsx
import { Lead, Campaign } from '@leadflow/types'

function LeadList({ leads }: { leads: Lead[] }) {
  // TypeScript knows all Lead properties!
}
```

---

## Development Workflow

1. **Start dev server** - `npm run dev`
2. **Make changes** - Files auto-reload in browser
3. **Check console** - F12 to see errors
4. **Test in browser** - Click around, try features
5. **Commit changes** - `git add . && git commit -m "message"`

---

## Troubleshooting

### Import errors?
Make sure you're using the `@/` alias:
```tsx
import { Button } from '@/components/ui/button'  // ✅ Correct
import { Button } from 'components/ui/button'   // ❌ Wrong
```

### Styles not working?
1. Check `index.css` has the CSS variables
2. Restart dev server: `npm run dev`
3. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)

### Component not updating?
Make sure you're using state setters:
```tsx
setData([...data, newItem])  // ✅ Correct
data.push(newItem)           // ❌ Won't trigger re-render
```

---

## Learning Resources

- [QUICKSTART.md](../../QUICKSTART.md) - Build your first page
- [FRONTEND_GUIDE.md](../../FRONTEND_GUIDE.md) - Complete guide
- [shadcn/ui](https://ui.shadcn.com) - Component docs
- [Tailwind CSS](https://tailwindcss.com/docs) - Styling reference
- [React Docs](https://react.dev) - React fundamentals

---

## Next Steps

1. **Explore examples** - Check out `LeadsPageExample.tsx` and `LeadCard.tsx`
2. **View showcase** - Add the ComponentShowcase route and see all components
3. **Build something!** - Start with a simple page, iterate
4. **Read the guides** - QUICKSTART.md for hands-on, FRONTEND_GUIDE.md for depth

**Need help?** Check the guides above or ask your team!

Happy coding! 🚀

/**
 * Component Showcase Page
 *
 * This page demonstrates all available shadcn/ui components
 * Use this as a reference while building your pages!
 *
 * To view: Add this route to App.tsx:
 * <Route path="/showcase" element={<ComponentShowcase />} />
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Mail, Search, Download } from 'lucide-react'

export default function ComponentShowcase() {
  const [inputValue, setInputValue] = useState('')

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div>
        <h1 className="text-4xl font-bold mb-2">Component Showcase</h1>
        <p className="text-muted-foreground">
          All available shadcn/ui components with examples
        </p>
      </div>

      {/* ========== BUTTONS ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Buttons</h2>
        <Card>
          <CardHeader>
            <CardTitle>Button Variants</CardTitle>
            <CardDescription>
              Different styles of buttons for different actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Destructive</Button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                With Icon
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            Code: <code>{'<Button variant="outline">Click me</Button>'}</code>
          </CardFooter>
        </Card>
      </section>

      {/* ========== BADGES ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Badges</h2>
        <Card>
          <CardHeader>
            <CardTitle>Badge Variants</CardTitle>
            <CardDescription>
              Use badges to show status, labels, or counts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            Code: <code>{'<Badge variant="default">Status</Badge>'}</code>
          </CardFooter>
        </Card>
      </section>

      {/* ========== INPUTS ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Inputs</h2>
        <Card>
          <CardHeader>
            <CardTitle>Input Fields</CardTitle>
            <CardDescription>
              Form inputs for user data entry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Input</label>
              <Input
                placeholder="Type something..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Input</label>
              <Input type="email" placeholder="email@example.com" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password Input</label>
              <Input type="password" placeholder="••••••••" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Disabled Input</label>
              <Input disabled placeholder="Disabled input" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Input with Icon</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search..." />
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            Code: <code>{'<Input placeholder="Type..." />'}</code>
          </CardFooter>
        </Card>
      </section>

      {/* ========== CARDS ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Simple Card</CardTitle>
              <CardDescription>A basic card with header and content</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cards are containers for related content and actions.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Card with Footer</CardTitle>
              <CardDescription>This card has action buttons</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use CardFooter for actions related to the card content.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button size="sm">Accept</Button>
              <Button size="sm" variant="outline">Cancel</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">2,345</div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-green-600">+12.5%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This card has hover effects (try hovering over it!)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== TABLES ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tables</h2>
        <Card>
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
            <CardDescription>
              Display structured data in rows and columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">John Doe</TableCell>
                  <TableCell>
                    <Badge>Active</Badge>
                  </TableCell>
                  <TableCell>john@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Jane Smith</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Pending</Badge>
                  </TableCell>
                  <TableCell>jane@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bob Johnson</TableCell>
                  <TableCell>
                    <Badge variant="outline">Inactive</Badge>
                  </TableCell>
                  <TableCell>bob@example.com</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ========== LAYOUTS ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Layout Examples</h2>

        <Card>
          <CardHeader>
            <CardTitle>Grid Layout</CardTitle>
            <CardDescription>Responsive grid with cards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="font-medium">Grid Item {i}</div>
                  <p className="text-sm text-muted-foreground">
                    This is a grid item
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flex Layout</CardTitle>
            <CardDescription>Horizontal flex layout with gap</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] border rounded-lg p-4">
                <div className="font-medium">Flex Item 1</div>
              </div>
              <div className="flex-1 min-w-[200px] border rounded-lg p-4">
                <div className="font-medium">Flex Item 2</div>
              </div>
              <div className="flex-1 min-w-[200px] border rounded-lg p-4">
                <div className="font-medium">Flex Item 3</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ========== USAGE TIPS ========== */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Usage Tips</h2>
        <Card>
          <CardHeader>
            <CardTitle>How to Use These Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Import the component</h3>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {`import { Button } from '@/components/ui/button'`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">2. Use it in your JSX</h3>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {`<Button variant="outline" onClick={() => alert('Clicked!')}>
  Click Me
</Button>`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">3. Customize with props</h3>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {`<Button
  variant="destructive"
  size="lg"
  disabled={loading}
>
  Delete
</Button>`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Style with Tailwind classes</h3>
              <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                {`<Button className="w-full mt-4">
  Full Width Button
</Button>`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

/**
 * EXAMPLE: LeadCard Component
 *
 * This is a reusable component that displays a single lead's information.
 * It demonstrates how to:
 * 1. Create a component that accepts props
 * 2. Use TypeScript for type safety
 * 3. Compose shadcn/ui components
 * 4. Handle user interactions (onClick)
 */

import { Lead } from '@leadflow/types'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Building2, Phone } from 'lucide-react'

// PROPS INTERFACE: Define what data this component needs
interface LeadCardProps {
  lead: Lead // The lead object
  onView?: (leadId: string) => void // Optional callback when "View" is clicked
  onEmail?: (leadId: string) => void // Optional callback when "Email" is clicked
}

export default function LeadCard({ lead, onView, onEmail }: LeadCardProps) {
  // HELPER: Get badge color based on status
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'qualified':
        return 'default'
      case 'contacted':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      {/* HEADER: Name and Status Badge */}
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h3 className="text-lg font-semibold">
            {lead.firstName} {lead.lastName}
          </h3>
          {lead.position && (
            <p className="text-sm text-muted-foreground">{lead.position}</p>
          )}
        </div>
        <Badge variant={getStatusVariant(lead.status)}>{lead.status}</Badge>
      </CardHeader>

      {/* CONTENT: Contact Details */}
      <CardContent className="space-y-3">
        {/* Email */}
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span>{lead.email}</span>
        </div>

        {/* Company */}
        {lead.company && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{lead.company}</span>
          </div>
        )}

        {/* Phone */}
        {lead.phoneNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{lead.phoneNumber}</span>
          </div>
        )}

        {/* Score */}
        {lead.score && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lead Score</span>
              <span className="text-lg font-bold">{lead.score}/100</span>
            </div>
            {/* Visual score bar */}
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${lead.score}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* FOOTER: Action Buttons */}
      <CardFooter className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={() => onView?.(lead.id)}
        >
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEmail?.(lead.id)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Email
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * HOW TO USE THIS COMPONENT:
 *
 * import LeadCard from '@/components/LeadCard'
 *
 * function MyPage() {
 *   const lead = { ... } // Your lead data
 *
 *   return (
 *     <LeadCard
 *       lead={lead}
 *       onView={(id) => console.log('View lead:', id)}
 *       onEmail={(id) => console.log('Email lead:', id)}
 *     />
 *   )
 * }
 *
 * OR in a grid layout:
 *
 * <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 *   {leads.map((lead) => (
 *     <LeadCard key={lead.id} lead={lead} onView={handleView} />
 *   ))}
 * </div>
 */

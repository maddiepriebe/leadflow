/**
 * EXAMPLE: Simple LeadCard Component (No Icons Version)
 *
 * This is a simpler version without external icon dependencies.
 * Perfect for learning the basics!
 */

import { Lead } from '@leadflow/types'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface LeadCardSimpleProps {
  lead: Lead
  onView?: (leadId: string) => void
  onEmail?: (leadId: string) => void
}

export default function LeadCardSimple({ lead, onView, onEmail }: LeadCardSimpleProps) {
  // Get badge color based on status
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
      {/* HEADER: Name and Status */}
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
      <CardContent className="space-y-2">
        <div className="text-sm">
          <span className="font-medium">Email:</span> {lead.email}
        </div>

        {lead.company && (
          <div className="text-sm">
            <span className="font-medium">Company:</span> {lead.company}
          </div>
        )}

        {lead.phoneNumber && (
          <div className="text-sm">
            <span className="font-medium">Phone:</span> {lead.phoneNumber}
          </div>
        )}

        {/* Score */}
        {lead.score && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Lead Score</span>
              <span className="text-lg font-bold">{lead.score}/100</span>
            </div>
            {/* Visual score bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${lead.score}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* FOOTER: Actions */}
      <CardFooter className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={() => onView?.(lead.id)}
        >
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEmail?.(lead.id)}
        >
          Email
        </Button>
      </CardFooter>
    </Card>
  )
}

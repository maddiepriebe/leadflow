export interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    company?: string;
    position?: string;
    linkedinURL?: string;
    source: 'linkedIn' | 'website' | 'apollo' | 'hunter' |'meta' | 'other';
    enrichmentData?: any;
    score?: number;
    status: 'new' | 'enriched' | 'scored' | 'contacted' | 'unqualified' | 'qualified' | 'converted';
    createdAt: Date;
    updatedAt: Date;
}

export interface Campaign {
    id: string;
    name: string;
    description?: string;
    status: 'draft' |'active' | 'completed' | 'paused';
    createdAt: Date;
    updatedAt: Date;
}

export interface Sequence {
    id: string;
    name: string;
    steps: SequenceStep[];
    campaignId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SequenceStep {
    id: string;
    order: number;
    type: 'email' | 'whatsapp' | 'delay' | 'dms';
    content?: string;
    delayInDays?: number;
}

export interface Message {
    id: string;
    leadId: string;
    content: string;
    direction: 'inbound' | 'outbound';
    channel: 'email' | 'whatsapp' | 'dms';
    sentAt: Date;
    createdAt: Date;
    status: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced';
}

export interface ICP{
    id: string;
    name: string;
    criteria: {
        industries?: string[];
        companySize?: string[];
        locations?: string[];
        jobTitles?: string[];
        technologies?: string[];
    };
    createdAt: Date;
    updatedAt: Date;
}
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// ==========================================
// CONFIGURATION
// ==========================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const TRENGO_API_KEY = process.env.TRENGO_API_KEY || '';
const TRENGO_API_URL = 'https://app.trengo.com/api/v2';
const TRENGO_CHANNEL_ID = process.env.TRENGO_WHATSAPP_CHANNEL_ID || '';

// Rate limiting: 10 messages per minute
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_MESSAGES = 10;
let messagesSentInWindow = 0;
let windowStartTime = Date.now();

// Create Redis connection
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});

// ==========================================
// TYPES
// ==========================================

type Channel = 'whatsapp' | 'email' | 'instagram';
type LeadStatus = 'new' | 'enriched' | 'qualified' | 'contacted' | 'responded' | 'converted' | 'lost';

interface Lead {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    position?: string | null;
    linkedinUrl?: string | null;
    source: string;
    status: string;
    score?: number | null;
    currentScore?: number | null;
    enrichmentData?: any;
    icpId?: string | null;
}

interface ICP {
    id: string;
    name: string;
    criteria: any;
}

interface MessageJob {
    type: 'send-message' | 'bulk-send';
    data: {
        leadId?: string;
        leadIds?: string[];
        channel: Channel;
        customPrompt?: string;
    };
}

interface GeneratedMessage {
    message: string;
    reasoning: string;
    personalization: {
        painPoint: string;
        valueProp: string;
        roleContext: string;
    };
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

// ==========================================
// COMPANY CONTEXT
// ==========================================

const COMPANY_CONTEXT = {
    name: "Zbooni",
    description: "cCommerce platform enabling personalized commerce experiences. We help businesses capture orders, accept payments, sell more, and track orders.",
    targetCustomers: "E-commerce businesses, retail stores, SMBs in MENA region",
    channels: ["WhatsApp", "Instagram", "Email"],
    keyBenefits: [
        "Recover lost sales through personalized WhatsApp checkout",
        "40% more completed orders for e-commerce",
        "Bridge online/offline sales seamlessly",
        "Enterprise tools at SMB-friendly prices",
        "No technical expertise required"
    ]
};

// ==========================================
// PAIN POINTS BY ROLE
// ==========================================

const PAIN_POINTS_BY_ROLE: Record<string, string[]> = {
    'ceo': [
        "Revenue growth stagnation",
        "High customer acquisition costs",
        "Scaling operations efficiently",
        "Competing with larger players"
    ],
    'founder': [
        "Revenue growth stagnation",
        "High customer acquisition costs",
        "Scaling operations efficiently",
        "Building sustainable growth"
    ],
    'cto': [
        "System integration complexity",
        "Technical debt slowing innovation",
        "Automation gaps in workflows",
        "Building vs buying decisions"
    ],
    'marketing': [
        "Low lead-to-customer conversion",
        "Poor campaign ROI",
        "Customer engagement dropping",
        "Attribution challenges"
    ],
    'sales': [
        "Pipeline leakage",
        "Long sales cycles",
        "Outreach efficiency",
        "Deal closing bottlenecks"
    ],
    'operations': [
        "Manual process bottlenecks",
        "Order management chaos",
        "Fulfillment delays",
        "Inventory sync issues"
    ],
    'ecommerce': [
        "Cart abandonment rates",
        "Checkout friction",
        "Customer retention",
        "Multi-channel complexity"
    ],
    'default': [
        "Operational efficiency",
        "Revenue optimization",
        "Customer experience improvement",
        "Process streamlining"
    ]
};

// ==========================================
// VALUE PROPOSITIONS BY INDUSTRY
// ==========================================

const VALUE_PROPS_BY_INDUSTRY: Record<string, {
    mainProp: string;
    stat: string;
    useCase: string;
}> = {
    'ecommerce': {
        mainProp: "Reduce cart abandonment and increase average order value",
        stat: "40% more completed orders",
        useCase: "personalized WhatsApp checkout that recovers abandoned carts"
    },
    'e-commerce': {
        mainProp: "Reduce cart abandonment and increase average order value",
        stat: "40% more completed orders",
        useCase: "personalized WhatsApp checkout that recovers abandoned carts"
    },
    'retail': {
        mainProp: "Bridge online and offline sales seamlessly",
        stat: "30% increase in repeat purchases",
        useCase: "unified commerce experience across all channels"
    },
    'b2b': {
        mainProp: "Automate order processing and improve buyer experience",
        stat: "50% faster order processing",
        useCase: "streamlined B2B ordering via conversational commerce"
    },
    'saas': {
        mainProp: "Improve customer onboarding and reduce churn",
        stat: "25% better activation rates",
        useCase: "personalized onboarding sequences via WhatsApp"
    },
    'hospitality': {
        mainProp: "Increase direct bookings and guest satisfaction",
        stat: "35% more direct bookings",
        useCase: "instant booking confirmations and concierge via WhatsApp"
    },
    'healthcare': {
        mainProp: "Streamline patient communication and appointments",
        stat: "40% reduction in no-shows",
        useCase: "automated appointment reminders and follow-ups"
    },
    'default': {
        mainProp: "Streamline customer communication and boost sales",
        stat: "35% increase in customer engagement",
        useCase: "conversational commerce that meets customers where they are"
    }
};

// ==========================================
// CHANNEL CONSTRAINTS
// ==========================================

const CHANNEL_CONSTRAINTS: Record<Channel, {
    minLength: number;
    maxLength: number;
    emojiCount: { min: number; max: number };
    formatting: string;
}> = {
    'whatsapp': {
        minLength: 150,
        maxLength: 300,
        emojiCount: { min: 2, max: 3 },
        formatting: "Short paragraphs, casual but professional, include emojis"
    },
    'email': {
        minLength: 200,
        maxLength: 500,
        emojiCount: { min: 0, max: 1 },
        formatting: "Professional structure with greeting, body, and sign-off"
    },
    'instagram': {
        minLength: 100,
        maxLength: 250,
        emojiCount: { min: 2, max: 4 },
        formatting: "Casual, friendly, visual-friendly with line breaks"
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function normalizeRole(position: string | null | undefined): string {
    if (!position) return 'default';

    const pos = position.toLowerCase();

    if (pos.includes('ceo') || pos.includes('chief executive')) return 'ceo';
    if (pos.includes('founder') || pos.includes('owner') || pos.includes('co-founder')) return 'founder';
    if (pos.includes('cto') || pos.includes('chief technology') || pos.includes('tech lead')) return 'cto';
    if (pos.includes('cmo') || pos.includes('marketing') || pos.includes('growth')) return 'marketing';
    if (pos.includes('sales') || pos.includes('business development') || pos.includes('account')) return 'sales';
    if (pos.includes('operations') || pos.includes('coo') || pos.includes('supply chain')) return 'operations';
    if (pos.includes('ecommerce') || pos.includes('e-commerce') || pos.includes('digital')) return 'ecommerce';

    return 'default';
}

function normalizeIndustry(enrichmentData: any): string {
    const industry = enrichmentData?.companyIndustry ||
                     enrichmentData?.industry ||
                     enrichmentData?.apolloData?.organization?.industry ||
                     '';

    const ind = industry.toLowerCase();

    if (ind.includes('ecommerce') || ind.includes('e-commerce') || ind.includes('retail online')) return 'ecommerce';
    if (ind.includes('retail') || ind.includes('store')) return 'retail';
    if (ind.includes('b2b') || ind.includes('wholesale') || ind.includes('distribution')) return 'b2b';
    if (ind.includes('saas') || ind.includes('software') || ind.includes('technology')) return 'saas';
    if (ind.includes('hospitality') || ind.includes('hotel') || ind.includes('restaurant')) return 'hospitality';
    if (ind.includes('health') || ind.includes('medical') || ind.includes('clinic')) return 'healthcare';

    return 'default';
}

function getPainPointsForRole(position: string | null | undefined, industry: string): string[] {
    const role = normalizeRole(position);
    const rolePainPoints = PAIN_POINTS_BY_ROLE[role] || PAIN_POINTS_BY_ROLE['default'];

    // Add industry-specific context if available
    const industryKey = normalizeIndustry({ industry });
    if (industryKey !== 'default' && PAIN_POINTS_BY_ROLE[industryKey]) {
        return [...rolePainPoints.slice(0, 2), ...PAIN_POINTS_BY_ROLE[industryKey].slice(0, 2)];
    }

    return rolePainPoints;
}

function getValuePropForIndustry(enrichmentData: any): typeof VALUE_PROPS_BY_INDUSTRY['default'] {
    const industry = normalizeIndustry(enrichmentData);
    return VALUE_PROPS_BY_INDUSTRY[industry] || VALUE_PROPS_BY_INDUSTRY['default'];
}

function getCompanySize(enrichmentData: any): string {
    const size = enrichmentData?.companySize ||
                 enrichmentData?.apolloData?.organization?.estimated_num_employees ||
                 enrichmentData?.employees;

    if (!size) return 'growing business';

    if (typeof size === 'number') {
        if (size < 10) return 'startup';
        if (size < 50) return 'small business';
        if (size < 200) return 'mid-size company';
        return 'enterprise';
    }

    // Handle string ranges like "11-50"
    const sizeStr = size.toString().toLowerCase();
    if (sizeStr.includes('1-10') || sizeStr.includes('startup')) return 'startup';
    if (sizeStr.includes('11-50') || sizeStr.includes('small')) return 'small business';
    if (sizeStr.includes('51-200') || sizeStr.includes('medium')) return 'mid-size company';

    return 'growing business';
}

// ==========================================
// AI PROMPT BUILDING
// ==========================================

function buildAIPrompt(lead: Lead, icp: ICP | null, channel: Channel): string {
    const role = normalizeRole(lead.position);
    const industry = normalizeIndustry(lead.enrichmentData);
    const painPoints = getPainPointsForRole(lead.position, industry);
    const valueProp = getValuePropForIndustry(lead.enrichmentData);
    const companySize = getCompanySize(lead.enrichmentData);
    const constraints = CHANNEL_CONSTRAINTS[channel];

    const systemPrompt = `You are an expert SDR (Sales Development Representative) for Zbooni, a cCommerce platform. Your goal is to write a highly personalized, engaging first-touch message that gets responses.

ABOUT ZBOONI:
${COMPANY_CONTEXT.description}
Key benefits: ${COMPANY_CONTEXT.keyBenefits.join(', ')}

YOUR WRITING STYLE:
- Professional but conversational (not corporate)
- Confident but not pushy
- Focus on value, not features
- Use specific numbers and stats when relevant
- Never use generic phrases like "I hope this message finds you well"
- Never use placeholders like [Name] or {Company}
- Write like a human, not a template`;

    const userPrompt = `Write a ${channel} message for this lead:

LEAD DETAILS:
- First Name: ${lead.firstName}
- Last Name: ${lead.lastName}
- Company: ${lead.company || 'their company'}
- Role: ${lead.position || 'Business Leader'}
- Industry: ${industry !== 'default' ? industry : 'business services'}
- Company Size: ${companySize}
- Lead Score: ${(lead as any).currentScore || 'N/A'}/100
- ICP Match: ${icp?.name || 'General'}

ROLE-SPECIFIC PAIN POINTS (choose the most relevant):
${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

INDUSTRY VALUE PROPOSITION:
- Main benefit: ${valueProp.mainProp}
- Key stat: ${valueProp.stat}
- Use case: ${valueProp.useCase}

CHANNEL REQUIREMENTS (${channel}):
- Length: ${constraints.minLength}-${constraints.maxLength} characters
- Emojis: ${constraints.emojiCount.min}-${constraints.emojiCount.max} emojis
- Style: ${constraints.formatting}

MESSAGE MUST INCLUDE:
1. Lead's first name (${lead.firstName})
2. Reference to their company (${lead.company || 'their business'})
3. One specific pain point relevant to their role
4. Zbooni's value proposition with a specific stat
5. Clear, low-pressure call-to-action
6. Opt-out: "Reply STOP to unsubscribe"

DO NOT:
- Use generic templates
- Include any placeholders
- Be pushy or salesy
- Use corporate jargon
- Exceed the character limit

Respond ONLY with a JSON object in this exact format:
{
  "message": "The complete message text here",
  "reasoning": "Brief explanation of personalization choices",
  "personalization": {
    "painPoint": "The pain point you addressed",
    "valueProp": "The value prop you highlighted",
    "roleContext": "Why this resonates with their role"
  }
}`;

    return JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
    });
}

// ==========================================
// AI MESSAGE GENERATION
// ==========================================

async function generateMessageWithAI(lead: Lead, icp: ICP | null, channel: Channel): Promise<GeneratedMessage> {
    const requestBody = buildAIPrompt(lead, icp, channel);

    console.log(`🤖 Generating AI message for ${lead.firstName} ${lead.lastName}...`);

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: requestBody
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Empty response from OpenAI');
    }

    try {
        const parsed = JSON.parse(content);
        return {
            message: parsed.message,
            reasoning: parsed.reasoning || 'AI-generated message',
            personalization: parsed.personalization || {
                painPoint: 'General business optimization',
                valueProp: 'Conversational commerce',
                roleContext: 'Business leadership'
            }
        };
    } catch (parseError) {
        // If JSON parsing fails, try to extract the message
        console.warn('⚠️ Failed to parse AI response as JSON, using raw content');
        return {
            message: content.slice(0, CHANNEL_CONSTRAINTS[channel].maxLength),
            reasoning: 'Fallback extraction from AI response',
            personalization: {
                painPoint: 'General',
                valueProp: 'Zbooni platform',
                roleContext: lead.position || 'Business'
            }
        };
    }
}

// ==========================================
// FALLBACK MESSAGE GENERATION
// ==========================================

function generateFallbackMessage(lead: Lead, icp: ICP | null, channel: Channel): GeneratedMessage {
    const firstName = lead.firstName || 'there';
    const company = lead.company || 'your business';
    const industry = normalizeIndustry(lead.enrichmentData);
    const valueProp = getValuePropForIndustry(lead.enrichmentData);
    const role = normalizeRole(lead.position);

    const templates: Record<Channel, string[]> = {
        'whatsapp': [
            `Hi ${firstName}! 👋\n\nI noticed you're at ${company}. Most ${industry !== 'default' ? industry : 'business'} leaders struggle with ${valueProp.mainProp.toLowerCase()}.\n\nZbooni helps companies like yours achieve ${valueProp.stat} through ${valueProp.useCase}.\n\nWorth a quick 15-min chat? 🚀\n\nReply STOP to unsubscribe`,
            `Hey ${firstName}! 👋\n\nQuick question - how's ${company} handling customer orders via WhatsApp?\n\nWe help ${industry !== 'default' ? industry : 'growing'} businesses achieve ${valueProp.stat} with conversational commerce.\n\nOpen to learning more? 📱\n\nReply STOP to unsubscribe`,
            `Hi ${firstName}! 🙌\n\nI came across ${company} and thought you might be interested in how similar ${industry !== 'default' ? industry : ''} businesses are using WhatsApp to ${valueProp.mainProp.toLowerCase()}.\n\nOur customers see ${valueProp.stat}. Worth exploring?\n\nReply STOP to unsubscribe`
        ],
        'email': [
            `Hi ${firstName},\n\nI noticed ${company} is in the ${industry !== 'default' ? industry : 'commerce'} space, and I wanted to share how similar companies are tackling ${valueProp.mainProp.toLowerCase()}.\n\nZbooni's conversational commerce platform helps businesses achieve ${valueProp.stat} through ${valueProp.useCase}.\n\nWould you be open to a brief 15-minute call to explore if this could help ${company}?\n\nBest,\nZbooni Team\n\nP.S. Reply STOP to unsubscribe`,
            `Hi ${firstName},\n\nAs someone leading ${role !== 'default' ? role : 'initiatives'} at ${company}, you're likely focused on ${valueProp.mainProp.toLowerCase()}.\n\nI'd love to share how Zbooni is helping ${industry !== 'default' ? industry : 'growing'} businesses achieve ${valueProp.stat}.\n\nDo you have 15 minutes this week for a quick chat?\n\nBest regards,\nZbooni Team\n\nReply STOP to unsubscribe`
        ],
        'instagram': [
            `Hey ${firstName}! 👋\n\n${company} caught my attention! 🎯\n\nWe help ${industry !== 'default' ? industry : 'growing'} brands achieve ${valueProp.stat}\n\nInterested in learning how? 💬\n\nReply STOP to opt out`,
            `Hi ${firstName}! ✨\n\nLove what ${company} is doing! Quick Q - how are you handling customer convos?\n\nWe help brands like yours ${valueProp.mainProp.toLowerCase()} 📈\n\nDM us to chat! 🚀\n\nSTOP to unsubscribe`
        ]
    };

    const channelTemplates = templates[channel];
    const selectedTemplate = channelTemplates[Math.floor(Math.random() * channelTemplates.length)];

    return {
        message: selectedTemplate,
        reasoning: 'Fallback template used due to AI generation failure',
        personalization: {
            painPoint: valueProp.mainProp,
            valueProp: valueProp.stat,
            roleContext: role
        }
    };
}

// ==========================================
// MESSAGE VALIDATION
// ==========================================

function validateMessage(message: string, lead: Lead, channel: Channel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const constraints = CHANNEL_CONSTRAINTS[channel];

    // Check length
    if (message.length < constraints.minLength) {
        errors.push(`Message too short: ${message.length} chars (min: ${constraints.minLength})`);
    }
    if (message.length > constraints.maxLength) {
        warnings.push(`Message too long: ${message.length} chars (max: ${constraints.maxLength})`);
    }

    // Check for placeholders
    const placeholderPatterns = [
        /\[.*?\]/g,           // [Name], [Company]
        /\{.*?\}/g,           // {name}, {company}
        /\<.*?\>/g,           // <Name>, <Company>
        /\{\{.*?\}\}/g,       // {{name}}
        /\$\{.*?\}/g          // ${name}
    ];

    for (const pattern of placeholderPatterns) {
        if (pattern.test(message)) {
            errors.push(`Message contains unfilled placeholder: ${message.match(pattern)?.[0]}`);
        }
    }

    // Check for lead's first name
    if (lead.firstName && !message.toLowerCase().includes(lead.firstName.toLowerCase())) {
        warnings.push('Message does not include lead\'s first name');
    }

    // Check for opt-out
    if (!message.toLowerCase().includes('stop') && !message.toLowerCase().includes('unsubscribe')) {
        warnings.push('Message should include opt-out option (Reply STOP)');
    }

    // Check for spam words
    const spamWords = ['urgent', 'act now', 'limited time', 'exclusive offer', 'guaranteed', 'winner', 'free money'];
    for (const word of spamWords) {
        if (message.toLowerCase().includes(word)) {
            warnings.push(`Message contains potential spam trigger: "${word}"`);
        }
    }

    // Check emoji count for WhatsApp/Instagram
    if (channel === 'whatsapp' || channel === 'instagram') {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojiCount = (message.match(emojiRegex) || []).length;

        if (emojiCount < constraints.emojiCount.min) {
            warnings.push(`Consider adding more emojis (found: ${emojiCount}, recommended: ${constraints.emojiCount.min}-${constraints.emojiCount.max})`);
        }
        if (emojiCount > constraints.emojiCount.max) {
            warnings.push(`Too many emojis (found: ${emojiCount}, max: ${constraints.emojiCount.max})`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// ==========================================
// CHANNEL FORMATTING
// ==========================================

function formatMessageForChannel(message: string, channel: Channel): string {
    switch (channel) {
        case 'whatsapp':
            // Ensure proper line breaks and trim
            return message
                .replace(/\n{3,}/g, '\n\n')  // Max 2 line breaks
                .trim();

        case 'email':
            // Ensure proper email structure
            if (!message.includes('\n\n')) {
                // Add paragraph breaks if missing
                const sentences = message.split('. ');
                if (sentences.length > 3) {
                    const firstPara = sentences.slice(0, 2).join('. ') + '.';
                    const secondPara = sentences.slice(2).join('. ');
                    return `${firstPara}\n\n${secondPara}`;
                }
            }
            return message.trim();

        case 'instagram':
            // Keep it short and punchy
            return message
                .replace(/\n{2,}/g, '\n\n')
                .slice(0, CHANNEL_CONSTRAINTS.instagram.maxLength)
                .trim();

        default:
            return message.trim();
    }
}

// ==========================================
// TRENGO INTEGRATION
// ==========================================

async function sendViaTrengo(phone: string, message: string, leadId: string): Promise<{
    success: boolean;
    trengoMessageId?: string;
    error?: string;
}> {
    console.log(`📤 Sending WhatsApp message via Trengo to ${phone}...`);

    // Format phone number (ensure it has country code)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('+')) {
        // Assume UAE if no country code (adjust as needed)
        if (!formattedPhone.startsWith('971')) {
            formattedPhone = '971' + formattedPhone;
        }
        formattedPhone = '+' + formattedPhone;
    }

    try {
        // First, create or find contact in Trengo
        const contactResponse = await fetch(`${TRENGO_API_URL}/contacts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TRENGO_API_KEY}`
            },
            body: JSON.stringify({
                identifier: formattedPhone,
                channel_id: parseInt(TRENGO_CHANNEL_ID),
                name: `Lead ${leadId}`
            })
        });

        let contactId: string;

        if (contactResponse.ok) {
            const contactData = await contactResponse.json() as { id: string };
            contactId = contactData.id;
        } else {
            // Contact might already exist, try to find by phone
            const searchResponse = await fetch(`${TRENGO_API_URL}/contacts?term=${encodeURIComponent(formattedPhone)}`, {
                headers: {
                    'Authorization': `Bearer ${TRENGO_API_KEY}`
                }
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json() as { data?: { id: string }[] };
                contactId = searchData.data?.[0]?.id ?? '';

                if (!contactId) {
                    throw new Error('Could not create or find contact in Trengo');
                }
            } else {
                throw new Error('Failed to search for contact in Trengo');
            }
        }

        // Send message via Trengo
        const messageResponse = await fetch(`${TRENGO_API_URL}/wa_sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TRENGO_API_KEY}`
            },
            body: JSON.stringify({
                recipient_phone_number: formattedPhone,
                hsm_id: null, // For template messages, set this
                channel_id: parseInt(TRENGO_CHANNEL_ID),
                message: message
            })
        });

        if (!messageResponse.ok) {
            const errorData = await messageResponse.json().catch(() => ({}));
            throw new Error(`Trengo API error: ${messageResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const messageData = await messageResponse.json() as { id?: string | number; message_id?: string | number };

        console.log(`✅ Message sent via Trengo, ID: ${messageData.id || messageData.message_id}`);

        return {
            success: true,
            trengoMessageId: messageData.id?.toString() || messageData.message_id?.toString()
        };

    } catch (error: any) {
        console.error(`❌ Trengo send failed:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// RATE LIMITING
// ==========================================

async function checkRateLimit(): Promise<boolean> {
    const now = Date.now();

    // Reset window if expired
    if (now - windowStartTime >= RATE_LIMIT_WINDOW_MS) {
        messagesSentInWindow = 0;
        windowStartTime = now;
    }

    if (messagesSentInWindow >= RATE_LIMIT_MAX_MESSAGES) {
        const waitTime = RATE_LIMIT_WINDOW_MS - (now - windowStartTime);
        console.log(`⏳ Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        messagesSentInWindow = 0;
        windowStartTime = Date.now();
    }

    return true;
}

function incrementRateLimit(): void {
    messagesSentInWindow++;
}

// ==========================================
// MAIN MESSAGE SENDING LOGIC
// ==========================================

async function sendMessageToLead(data: {
    leadId: string;
    channel: Channel;
    customPrompt?: string;
}): Promise<{
    success: boolean;
    leadId: string;
    messageId?: string;
    trengoMessageId?: string;
    error?: string;
    message?: string;
}> {
    const { leadId, channel, customPrompt } = data;

    console.log(`\n📨 Processing message for lead ${leadId} via ${channel}...`);

    // Fetch lead with ICP
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { icp: true }
    });

    if (!lead) {
        return { success: false, leadId, error: 'Lead not found' };
    }

    // Check if lead has phone number for WhatsApp
    if (channel === 'whatsapp' && !lead.phone) {
        console.log(`⚠️ Lead ${leadId} has no phone number, skipping WhatsApp`);
        return { success: false, leadId, error: 'No phone number for WhatsApp' };
    }

    // Check lead score (only send to qualified leads)
    const leadScore = (lead as any).currentScore as number | null;
    if (leadScore !== null && leadScore !== undefined && leadScore < 70) {
        console.log(`⚠️ Lead ${leadId} score too low (${leadScore}), skipping`);
        return { success: false, leadId, error: `Lead score ${leadScore} below threshold (70)` };
    }

    // Check if already contacted
    if (lead.status === 'contacted') {
        console.log(`⚠️ Lead ${leadId} already contacted, skipping`);
        return { success: false, leadId, error: 'Lead already contacted' };
    }

    // Check rate limit
    await checkRateLimit();

    // Generate message with AI (with retry)
    let generatedMessage: GeneratedMessage;
    let usedFallback = false;

    try {
        generatedMessage = await generateMessageWithAI(lead, lead.icp, channel);
    } catch (aiError: any) {
        console.warn(`⚠️ First AI attempt failed: ${aiError.message}, retrying...`);

        try {
            // Wait 1 second and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            generatedMessage = await generateMessageWithAI(lead, lead.icp, channel);
        } catch (retryError: any) {
            console.warn(`⚠️ AI retry failed: ${retryError.message}, using fallback template`);
            generatedMessage = generateFallbackMessage(lead, lead.icp, channel);
            usedFallback = true;
        }
    }

    // Format message for channel
    let finalMessage = formatMessageForChannel(generatedMessage.message, channel);

    // Validate message
    const validation = validateMessage(finalMessage, lead, channel);

    if (!validation.isValid) {
        console.warn(`⚠️ Message validation failed:`, validation.errors);

        // Try fallback if validation fails
        if (!usedFallback) {
            console.log('🔄 Trying fallback template...');
            generatedMessage = generateFallbackMessage(lead, lead.icp, channel);
            finalMessage = formatMessageForChannel(generatedMessage.message, channel);

            const fallbackValidation = validateMessage(finalMessage, lead, channel);
            if (!fallbackValidation.isValid) {
                return {
                    success: false,
                    leadId,
                    error: `Message validation failed: ${fallbackValidation.errors.join(', ')}`
                };
            }
        } else {
            return {
                success: false,
                leadId,
                error: `Message validation failed: ${validation.errors.join(', ')}`
            };
        }
    }

    if (validation.warnings.length > 0) {
        console.log(`⚠️ Validation warnings:`, validation.warnings);
    }

    console.log(`📝 Generated message (${finalMessage.length} chars):`);
    console.log(`---\n${finalMessage}\n---`);
    console.log(`💡 Reasoning: ${generatedMessage.reasoning}`);

    // Send via appropriate channel
    let sendResult: { success: boolean; trengoMessageId?: string; error?: string };

    if (channel === 'whatsapp') {
        sendResult = await sendViaTrengo(lead.phone!, finalMessage, leadId);
    } else {
        // For email/instagram, log but don't send (implement later)
        console.log(`📧 ${channel} sending not yet implemented, logging message...`);
        sendResult = { success: true, trengoMessageId: `mock_${Date.now()}` };
    }

    if (!sendResult.success) {
        return { success: false, leadId, error: sendResult.error };
    }

    // Save message to database
    const savedMessage = await prisma.message.create({
        data: {
            leadId: lead.id,
            content: finalMessage,
            direction: 'outbound',
            channel: channel,
            status: 'sent',
            trengoMessageId: sendResult.trengoMessageId,
            sentAt: new Date()
        }
    });

    // Update lead status to 'contacted'
    await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'contacted' }
    });

    // Increment rate limit counter
    incrementRateLimit();

    console.log(`✅ Message sent and saved (ID: ${savedMessage.id})`);

    return {
        success: true,
        leadId,
        messageId: savedMessage.id,
        trengoMessageId: sendResult.trengoMessageId,
        message: finalMessage
    };
}

// ==========================================
// BULK SEND
// ==========================================

async function bulkSendMessages(data: {
    leadIds: string[];
    channel: Channel;
}): Promise<{
    success: boolean;
    total: number;
    sent: number;
    failed: number;
    results: any[];
}> {
    const { leadIds, channel } = data;

    console.log(`\n📬 Starting bulk send to ${leadIds.length} leads via ${channel}...`);

    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const leadId of leadIds) {
        try {
            const result = await sendMessageToLead({ leadId, channel });
            results.push(result);

            if (result.success) {
                sent++;
            } else {
                failed++;
            }

            // Small delay between messages to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
            console.error(`❌ Error sending to lead ${leadId}:`, error.message);
            results.push({ success: false, leadId, error: error.message });
            failed++;
        }
    }

    console.log(`\n📊 Bulk send complete: ${sent} sent, ${failed} failed`);

    return {
        success: true,
        total: leadIds.length,
        sent,
        failed,
        results
    };
}

// ==========================================
// WORKER DEFINITION
// ==========================================

export const messageWorker = new Worker(
    'send',  // Queue name (matches sendQueue in queues/index.ts)
    async (job: Job<MessageJob>) => {
        console.log(`\n🔄 Processing message job ${job.id}...`);

        const { type, data } = job.data;

        try {
            switch (type) {
                case 'send-message':
                    if (!data.leadId) {
                        throw new Error('Missing leadId for send-message job');
                    }
                    return await sendMessageToLead({
                        leadId: data.leadId,
                        channel: data.channel,
                        customPrompt: data.customPrompt
                    });

                case 'bulk-send':
                    if (!data.leadIds || data.leadIds.length === 0) {
                        throw new Error('Missing leadIds for bulk-send job');
                    }
                    return await bulkSendMessages({
                        leadIds: data.leadIds,
                        channel: data.channel
                    });

                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        } catch (error: any) {
            console.error(`❌ Failed to process message job ${job.id}:`, error.message);
            throw error;  // Job will retry
        }
    },
    {
        connection,
        concurrency: 2,  // Process 2 jobs at once (conservative for rate limiting)
        limiter: {
            max: 10,
            duration: 60000  // 10 jobs per minute
        }
    }
);

// ==========================================
// EVENT HANDLERS
// ==========================================

messageWorker.on('completed', (job) => {
    console.log(`✅ Message job ${job.id} completed`);
});

messageWorker.on('failed', (job, err) => {
    console.error(`❌ Message job ${job?.id} failed:`, err.message);
});

messageWorker.on('error', (err) => {
    console.error('❌ Message worker error:', err);
});

console.log('📨 Message worker started');

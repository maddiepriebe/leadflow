import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
    console.log('🌱 Seeding database...');

    try {
        // Check if ICPs already exist
        const existingICPs = await prisma.iCP.count();

        if (existingICPs > 0) {
            console.log(`✅ Database already has ${existingICPs} ICPs. Skipping seed.`);
            return;
        }

        console.log('📦 Database is empty. Creating initial ICPs...');

        // Seed ICP profiles
        const icps = [
            {
                id: 'LS1',
                name: 'High-Intent Instagram Commerce Sellers',
                isActive: true,
                criteria: {
                jobTitles: ['Owner', 'Founder', 'Social Media Manager', 'E-commerce Manager'],
                industries: [
                    'Fashion', 'Apparel', 'Beauty', 'Cosmetics', 'Jewelry', 
                    'Home Decor', 'Lifestyle Products'
                ],
                companySize: ['1-10', '11-50'],
                locations: ['UAE', 'Saudi Arabia', 'Kuwait', 'Qatar'],
                technologies: ['Instagram Shopping', 'Meta Commerce', 'WhatsApp Business'],
                keywords: [
                    'DM to order',
                    'WhatsApp order',
                    'cash on delivery',
                    'handmade',
                    'boutique',
                    'online shop'
                ],
                fundingStages: ['Bootstrap'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },

            {
                id: 'LS2',
                name: 'WhatsApp-First SMEs With Manual Sales Processes',
                isActive: true, 
                criteria: {
                jobTitles: ['Sales Manager', 'General Manager', 'Founder', 'Operations Lead'],
                industries: [
                    'Electronics', 'Furniture', 'Appliances', 
                    'Automotive Accessories', 'Home Services'
                ],
                companySize: ['5-200', '50-500'],
                locations: ['UAE', 'Saudi Arabia', 'Egypt', 'Pakistan'],
                technologies: ['WhatsApp Business API', 'CRM', 'Shopify', 'Zoho'],
                keywords: [
                    'send quote',
                    'WhatsApp support',
                    'manual invoicing',
                    'manual sales',
                    'COD deliveries'
                ],
                fundingStages: ['Bootstrap', 'Seed', 'Series A'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },

            {
                id: 'LS3',
                name: 'Service Businesses With High Booking Friction',
                isActive: true,
                criteria: {
                jobTitles: [
                    'Owner', 'Clinic Manager', 'Salon Manager', 
                    'Customer Service Manager', 'Operations Manager'
                ],
                industries: [
                    'Beauty Services', 'Clinics', 'Salons', 'Wellness', 
                    'Cleaning Services', 'Maintenance Services', 'Pet Grooming'
                ],
                companySize: ['1-50', '11-100'],
                locations: ['UAE', 'Saudi Arabia', 'Kuwait', 'Bahrain'],
                technologies: ['Booking systems', 'Calendly', 'WhatsApp Business'],
                keywords: [
                    'appointment booking',
                    'WhatsApp confirmations',
                    'deposit required',
                    'customer follow-up'
                ],
                fundingStages: ['Bootstrap', 'Seed'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },

            {
                id: 'LS4',
                name: 'Instagram Micro-Merchants With High Engagement Ratios',
                isActive: true,
                criteria: {
                jobTitles: ['Owner', 'Self-Employed'],
                industries: ['Beauty', 'Gifts', 'Handmade Goods', 'Food Delivery'],
                companySize: ['1-5', '1-10'],
                locations: ['UAE', 'Saudi Arabia', 'Egypt', 'Jordan'],
                technologies: ['Instagram', 'WhatsApp'],
                keywords: [
                    'dm for order',
                    'handmade business',
                    'micro merchant',
                    'whatsapp delivery',
                    'daily orders'
                ],
                fundingStages: ['Bootstrap'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },

            {
                id: 'LS5',
                name: 'B2B SMEs Using WhatsApp for Quotations',
                isActive: true, 
                criteria: {
                jobTitles: ['Sales Manager', 'Commercial Manager', 'Operations Lead', 'Founder'],
                industries: [
                    'Wholesale', 'Industrial Supplies',
                    'Office Supplies', 'Events Equipment',
                    'Construction Materials'
                ],
                companySize: ['10-500'],
                locations: ['UAE', 'Saudi Arabia', 'Oman', 'Jordan'],
                technologies: ['ERP', 'CRM', 'WhatsApp Business API'],
                keywords: [
                    'RFQ',
                    'quotation',
                    'invoice link',
                    'whatsapp quote',
                    'b2b inquiry'
                ],
                fundingStages: ['Bootstrap', 'Seed'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS6',
                name: 'High-Growth D2C Brands Expanding to WhatsApp Sales',
                isActive: true, 
                criteria: {
                jobTitles: ['Founder', 'Head of Growth', 'E-commerce Manager'],
                industries: [
                    'Beauty & Cosmetics',
                    'Fashion',
                    'Fitness & Supplements',
                    'Consumer Goods'
                ],
                companySize: ['10-200', '50-500'],
                locations: ['UAE', 'Saudi Arabia', 'Kuwait'],
                technologies: ['Shopify', 'Meta Commerce', 'CRM', 'WhatsApp API'],
                keywords: [
                    'scaling',
                    'conversion rate',
                    'customer retention',
                    'abandoned cart',
                    'whatsapp checkout'
                ],
                fundingStages: ['Seed', 'Series A', 'Series B'],
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS7',
                name: 'Beauty Salons in UAE',
                criteria: {
                    industries: ['Beauty Salon', 'Hair Salon', 'Spa', 'Beauty Services'],
                    locations: ['Dubai', 'Abu Dhabi', 'Sharjah', 'UAE'],
                    keywords: ['beauty', 'salon', 'spa', 'hair'],
                    companySize: ['1-10', '11-50']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS8',
                name: 'Small Tech Startups in Saudi Arabia',
                criteria: {
                    industries: ['Technology', 'Software', 'SaaS', 'IT Services'],
                    locations: ['Riyadh', 'Jeddah', 'Saudi Arabia'],
                    keywords: ['startup', 'tech', 'software', 'digital'],
                    companySize: ['1-10', '11-50'],
                    fundingStages: ['seed', 'series_a']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS9',
                name: 'E-commerce Businesses in MENA',
                criteria: {
                    industries: ['E-commerce', 'Retail', 'Online Shopping'],
                    locations: ['Dubai', 'Riyadh', 'Cairo', 'Amman'],
                    keywords: ['ecommerce', 'online store', 'retail', 'shopping'],
                    companySize: ['11-50', '51-200']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS10',
                name: 'Restaurant Owners in Dubai',
                criteria: {
                    industries: ['Restaurant', 'Food Service', 'Cafe', 'Dining'],
                    locations: ['Dubai', 'UAE'],
                    keywords: ['restaurant', 'cafe', 'food', 'dining'],
                    companySize: ['1-10', '11-50']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS11',
                name: 'Marketing Agencies in UAE',
                criteria: {
                    industries: ['Marketing', 'Advertising', 'Digital Marketing', 'PR'],
                    locations: ['Dubai', 'Abu Dhabi', 'UAE'],
                    keywords: ['marketing', 'advertising', 'digital', 'social media'],
                    companySize: ['11-50', '51-200'],
                    jobTitles: ['Marketing Manager', 'CEO', 'Founder', 'CMO']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS12',
                name: 'Real Estate Agencies in UAE',
                criteria: {
                    industries: ['Real Estate', 'Property Management'],
                    locations: ['Dubai', 'Abu Dhabi', 'UAE'],
                    keywords: ['real estate', 'property', 'broker', 'agent'],
                    companySize: ['11-50', '51-200']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS13',
                name: 'Fitness Centers and Gyms',
                criteria: {
                    industries: ['Fitness', 'Gym', 'Health Club', 'Wellness'],
                    locations: ['Dubai', 'Abu Dhabi', 'Riyadh'],
                    keywords: ['fitness', 'gym', 'training', 'wellness'],
                    companySize: ['1-10', '11-50']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'LS14',
                name: 'Healthcare Clinics in GCC',
                criteria: {
                    industries: ['Healthcare', 'Medical', 'Clinic', 'Dental'],
                    locations: ['Dubai', 'Riyadh', 'Kuwait', 'Doha'],
                    keywords: ['clinic', 'medical', 'healthcare', 'dental'],
                    companySize: ['1-10', '11-50', '51-200']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            
        ];

        for (const icpData of icps) {
            const icp = await prisma.iCP.create({
                data: icpData
            });
            console.log(`✅ Created ICP: ${icp.name}`);
        }

        console.log(`\n🎉 Seeded ${icps.length} ICP profiles successfully!`);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
};

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 
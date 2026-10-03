const en = {
  // Nav
  nav: {
    home: 'Home',
    products: 'Products',
    reviews: 'Reviews',
    faq: 'FAQ',
    services: 'Services',
    works: 'Work',
    process: 'Process',
    stack: 'Stack',
    contact: 'Contact',
    cta: 'Discuss a Project',
  },

  // Hero
  hero: {
    available: 'Available for new projects',
    words: ['automate', 'accelerate', 'transform', 'optimize'],
    headline1: 'I',
    headline2: 'businesses through',
    headline3: 'artificial',
    headline4: 'intelligence',
    sub: 'I build AI systems, intelligent agents, CRMs and automation that work while you sleep. For businesses ready to operate at the next level.',
    ctaPrimary: 'Discuss a Project',
    ctaSecondary: 'View Work',
    stats: [
      { label: 'products in the catalogue' },
      { label: '1C extensions' },
      { label: 'bots and services' },
      { label: '1C configurations: BuhKz and KA' },
    ],
  },

  // Services
  services: {
    label: 'Services',
    title: 'What I Build',
    items: [
      {
        title: 'AI Automation',
        tag: 'FLAGSHIP',
        desc: 'I embed AI into your core business processes — intelligent agents, automated data pipelines, predictive analytics. Your operation runs 24/7 without manual intervention.',
        items: ['AI agents & bots', 'Document workflow automation', 'Predictive analytics', 'NLP data processing'],
      },
      {
        title: 'AI Agents',
        tag: 'PREMIUM',
        desc: 'I develop fully autonomous AI agents powered by OpenAI, Claude, and custom LLMs. Agents that plan, execute tasks, and make decisions independently.',
        items: ['Autonomous AI agents', 'Multi-agent systems', 'LLM fine-tuning', 'RAG architectures'],
      },
      {
        title: 'CRM Systems',
        tag: 'POPULAR',
        desc: 'I build custom CRMs with deep AI integration — smart sales funnels, automated follow-ups, and full client journey analytics.',
        items: ['Custom CRM engine', 'AI-powered sales funnel', 'Messenger integrations', 'Analytics & reporting'],
      },
      {
        title: '1C Development',
        tag: 'EXPERT',
        desc: 'Senior 1C Architect. Custom configuration development, integration with external systems, performance optimization, and AI extensions for 1C.',
        items: ['Custom configurations', 'AI integration', 'Performance optimization', 'Support and updates'],
      },
      {
        title: 'Websites & Apps',
        tag: 'FULL STACK',
        desc: 'I create premium web products and mobile applications — bespoke design, performance-first architecture, and built-in AI capabilities.',
        items: ['Web applications', 'Mobile applications', 'AI integrations', 'Performance optimization'],
      },
    ],
  },

  // Works
  works: {
    label: 'Portfolio',
    detail: {
      open: 'View details',
      description: 'About the project',
      result: 'Result',
      stack: 'Technologies',
      cta: 'I want something similar',
      ctaSecondary: 'Message on Telegram',
    },
    emptyText: 'Projects in this category will appear here.',
    title: 'Selected',
    title2: 'Projects',
    sub: 'Problems I have solved. A selection.',
    tabs: ['All', 'AI Agent', 'CRM', 'Automation', 'Integration', 'Analytics', 'AI Platform', 'Full Stack'],
    footer: (count) => `Showing ${count} projects · Full portfolio available on request`,
    projects: [
      { title: 'YUVEMA Ecosystem', desc: 'A comprehensive AI business management platform featuring autonomous agents, real-time analytics, CRM and document workflows.' },
      { title: 'Restaurant AI + iiko', desc: 'Full restaurant automation — Telegram order intake, kitchen-iiko integration, and load analytics.' },
      { title: 'Hotel Smart Booking', desc: 'AI front desk for a hotel: automated reservations, guest notifications, Booking.com and 2GIS integrations.' },
      { title: 'AI CRM for Sports Club', desc: 'Fitness club CRM — membership tracking, AI reminders, Kaspi payments, and trainer dashboard.' },
      { title: 'Beauty Clinic CRM', desc: 'Client scheduling system, procedure history, AI reminders, WhatsApp notifications, and practitioner analytics.' },
      { title: 'E-commerce AI Consultant', desc: 'Smart chatbot for an online store — answers product questions, assists selection, and processes orders.' },
      { title: '1C + Marketplace Sync', desc: 'Bidirectional sync between 1C and Kaspi.kz, Wildberries, and OZON — inventory, pricing, and orders in real time.' },
      { title: 'AI Sales Analytics', desc: 'AI-powered dashboard with revenue forecasting, customer segmentation, LTV scoring, and assortment recommendations.' },
      { title: 'Telegram AI Operator', desc: 'An AI agent that fully replaces a live operator in Telegram — responds, qualifies leads, and routes to CRM.' },
      { title: 'WhatsApp AI Manager', desc: 'Inbound WhatsApp automation for a wholesale company — pricelists, availability, and order placement.' },
      { title: 'Business Intelligence Dashboard', desc: 'Unified business management dashboard with real-time KPIs, AI-generated insights, and one-click report exports.' },
      { title: 'AI Request Processing Platform', desc: 'Automated inbound request handling for B2B — classification, routing, and AI-generated responses.' },
      { title: 'Warehouse Management System', desc: 'Inventory tracking integrated with 1C and Kaspi, automated stock-taking, and low-stock alerts.' },
      { title: 'AI Customer Support Agent', desc: 'Autonomous first-line support agent that handles 80% of inbound tickets without human involvement.' },
      { title: 'AI Document Processing', desc: 'Automated data extraction from PDFs, invoices, and contracts with automatic 1C and CRM population.' },
      { title: 'Learning Management Platform', desc: 'LMS with an AI tutor — personalised learning paths, automated assignment grading, and progress analytics.' },
    ],
  },

  // Process
  process: {
    label: 'Process',
    title: 'How We Work',
    sub: "The client journey from first message to a live product — transparent, with no surprises",
    prototypeLabel: 'Prototype',
    prototypeVal: '7 days',
    prototypeDesc: 'from signed brief',
    guaranteeLabel: 'Guarantee',
    guaranteeVal: '3–6 months',
    guaranteeDesc: 'bug-fix warranty',
    note: 'Every stage is approved by you. Nothing moves to production without your sign-off.',
    liveLabel: 'client_journey.live',
    steps: [
      { title: 'Initial Consultation', sub: 'Free · up to 30 minutes', tag: 'Start', desc: 'You walk me through your business and the challenge. I ask questions to understand the real problem — the root cause, not just the symptoms. No generic proposals until I fully understand your context.' },
      { title: 'Business Process Discovery', sub: 'Audit · 1–3 days', tag: 'Analysis', desc: "We map out your current processes in detail — where time, money, and clients are being lost. I identify where AI or automation will deliver the highest impact." },
      { title: 'Brief & Architecture Design', sub: 'Document · 2–5 days', tag: 'Planning', desc: 'I produce a detailed technical brief — tech stack, architecture, integrations, milestones, timelines, and cost. You see the full picture before a single line of code is written.' },
      { title: 'Prototype / Design / Solution Blueprint', sub: 'Prototype · 7 days', tag: 'Prototype', desc: 'I build a clickable prototype or MVP. You interact with the product hands-on before full development begins. All adjustments happen here, before costs escalate.' },
      { title: 'Development: AI Agents, CRM, Website, Automation', sub: 'Iterations · as agreed', tag: 'Development', desc: 'I write the code, configure AI agents, and build the automation logic. Weekly demos keep you in the loop — you can request changes at every stage.' },
      { title: 'Integrations: WhatsApp, Telegram, 1C, Kaspi, Halyk, iiko', sub: 'Connection · 3–10 days', tag: 'Integrations', desc: 'I connect the solution to your full ecosystem — messengers, payment gateways, ERP, POS systems, CRMs and external APIs. Everything works as a single, unified organism.' },
      { title: 'Testing & Approval', sub: 'QA · 3–7 days', tag: 'QA', desc: 'Full end-to-end testing of all scenarios, load conditions, and edge cases. We review the results together — nothing goes live without your explicit approval.' },
      { title: 'Launch', sub: 'Go Live', tag: 'Launch', desc: 'Zero-downtime deployment. Team onboarding and training. The first two weeks are under close monitoring.' },
      { title: 'Support & Ongoing Development', sub: 'by agreement', tag: 'Support', desc: 'System monitoring, rapid fixes, AI model updates, and feature expansions. As your business grows, the system scales with it.' },
    ],
  },

  // Stack
  stack: {
    label: 'Technology',
    title: 'Technology Stack',
    sub: 'I select the best tool for each job — not what\'s trendy, but what actually fits',
    note: 'The stack is chosen individually for every project. If your tool isn\'t on the list, I\'ve most likely already worked with it.',
  },

  // Reviews
  reviews: {
    label: 'Testimonials',
    emptyText: 'No reviews yet: the products are just reaching their first clients. Only real, verified reviews will appear here.',
    title: 'Client Feedback',
    countLabel: (n) => `${n} ${n === 1 ? 'review' : 'reviews'}`,
    pauseHint: 'Hover over a card to pause scrolling',
    items: [],
  },

  // FAQ
  faq: {
    label: 'FAQ',
    title: 'Frequently Asked',
    title2: 'Questions',
    sub: "If your question isn't here, message me on Telegram — I reply within the hour.",
    cta: 'Get in Touch Directly',
    items: [
      { q: 'Can we work under a contract?', a: 'Yes. The contract is signed with me as a private individual: I have no legal entity. The scope of work, deadlines, amount and acceptance procedure are fixed in writing before the work starts.' },
      { q: 'How does payment work?', a: 'By bank transfer or to a card. The usual order: part at the start, the rest on acceptance; for longer work — by stages. The amount is named before the work begins and does not change without agreement.' },
      { q: 'Will there be closing documents?', a: 'A work completion act is signed at the end, if you need it for your internal accounting. Proof of payment is always provided. A VAT invoice is not possible when the contractor is a private individual — that is a separate arrangement, see the next question.' },
      { q: 'We need a bank transfer with VAT. Is that possible?', a: "It is possible through a partner's sole proprietorship. In that case the contract, invoice and closing documents come from them, while I do the work. This is agreed before the work starts, so that your accounting is not left unable to process the payment." },
      { q: 'Who is responsible for the result if there is no company?', a: 'The contractor under the agreement is responsible — that is, me personally. Liability and the procedure for fixing defects are written into that same contract. The absence of a legal entity cancels neither the obligations nor the guarantee on what was done.' },
    ],
  },

  // Contact
  contact: {
    label: "Let's Start",
    line1: 'Have an idea?',
    line2: "Let's build",
    line3: 'something great.',
    cta: 'Message on Telegram',
  },

  // Footer
  footer: {
    subtitle: 'AI Automation Engineer · Kazakhstan',
    rights: '© {year} · All rights reserved',
    privacy: 'Privacy policy',
    cookieSettings: 'Cookie settings',
  },

  // Consent to personal data processing: checkbox line in forms and chat prompt.
  consent: {
    text: 'I agree that Albert Gaan (Tinker studio) processes my personal data to answer my request, including transfer to services outside Kazakhstan.',
    link: 'Consent terms',
    required: 'Please tick the consent to personal data processing.',
    chatAsk: 'To pass your contact to the team, we need your consent to personal data processing: Albert Gaan (Tinker studio) will receive your name, contact and message to answer you. Data may be transferred to services outside Kazakhstan. Term — 12 months from your last request.',
    chatYes: 'I agree',
    chatNo: 'Do not send',
    chatDeclined: 'OK, your contact is not passed anywhere. You can write to us directly in Telegram — the button below the chat window.',
  },

  // /privacy page
  privacy: {
    notice: 'This document is published in Russian.',
  },

  // Home
  home: {
    aiLabel: 'AI at work',
    aiTitle: 'Not a demo deck,',
    aiTitle2: 'a system that runs',
    aiSub: 'We build tools people use every day: agents answering customers, a CRM moving deals forward, integrations keeping data in sync. The scene on the right is live — go ahead and grab it.',
    aiCta: 'Discuss your task',
    aiCtaSecondary: 'Ready solutions',
    aiHint: 'Drag to spin the robot — or give it a tap',
  },
  // Consultant
  consultant: {
    name: 'Keen',
    title: 'Keen',
    role: 'Tinker consultant for 1C',
    online: 'online',
    placeholder: 'Describe what happened...',
    greeting: 'Hello, I am Keen — the Tinker AI consultant (an AI answers; a person confirms prices and dates). I answer about 1C: what broke, what a job costs, what it includes.\n\nTell me what is happening — and which configuration you run, if you know.',
    disclaimer: 'Answered by a bot. The team gives exact estimates.',
  },

};

export default en;

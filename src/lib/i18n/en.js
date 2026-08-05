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
      { label: 'projects delivered' },
      { label: 'AI domains' },
      { label: 'years of experience' },
      { label: 'AI always on' },
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
        items: ['Custom configurations', 'AI integration', 'Performance optimization', '24/7 technical support'],
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
    sub: '120+ projects over 5 years. Here are the highlights.',
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
      { title: 'Marketplace AI', desc: 'AI marketplace with a recommendation engine, intelligent search, and automated content moderation.' },
      { title: 'Telegram AI Operator', desc: 'An AI agent that fully replaces a live operator in Telegram — responds, qualifies leads, and routes to CRM.' },
      { title: 'WhatsApp AI Manager', desc: 'Inbound WhatsApp automation for a wholesale company — pricelists, availability, and order placement.' },
      { title: 'B2B Wholesale CRM', desc: 'Full-featured CRM for wholesale sales — pipeline, manager KPIs, automated invoicing, and 1C integration.' },
      { title: 'Kaspi / Halyk Integration', desc: 'Payment acceptance via Kaspi QR and Halyk for a retail chain — auto receipts, cash reconciliation, and reporting.' },
      { title: 'Business Intelligence Dashboard', desc: 'Unified business management dashboard with real-time KPIs, AI-generated insights, and one-click report exports.' },
      { title: 'AI Request Processing Platform', desc: 'Automated inbound request handling for B2B — classification, routing, and AI-generated responses.' },
      { title: 'Warehouse Management System', desc: 'Inventory tracking integrated with 1C and Kaspi, automated stock-taking, and low-stock alerts.' },
      { title: 'AI Customer Support Agent', desc: 'Autonomous first-line support agent that handles 80% of inbound tickets without human involvement.' },
      { title: 'Medical Centre Online Booking', desc: 'Patient scheduling system, WhatsApp reminders, visit history, and physician performance analytics.' },
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
    guaranteeVal: '6 months',
    guaranteeDesc: 'on everything',
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
      { title: 'Support & Ongoing Development', sub: '24/7 · continuous', tag: 'Support', desc: 'System monitoring, rapid fixes, AI model updates, and feature expansions. As your business grows, the system scales with it.' },
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
    emptyText: 'Testimonials will appear here.',
    title: 'Client Feedback',
    countLabel: (n) => `${n} reviews · diverse industries`,
    pauseHint: 'Hover over a card to pause scrolling',
    items: [
      { text: 'We brought in an AI system to automate our request handling. Managers now focus on closing deals, not entering data. It\'s been running flawlessly for 8 months.' },
      { text: 'The Telegram bot plus iiko integration turned complete chaos into order. Waiters stopped mixing up orders and the kitchen sees everything in real time. Solid work.' },
      { text: 'We needed an AI agent fast. The prototype was ready in a week. Clean code, solid architecture. We\'re continuing to iterate together.' },
      { text: 'Bookings used to run on Excel and phone calls. Now everything\'s in the system and guests receive automated confirmations. Wish we\'d done it sooner.' },
      { text: 'The 1C to Kaspi.kz sync was set up in three weeks. Stock levels now update automatically — no more discrepancies. We saved one full-time role.' },
      { text: 'The CRM stopped us from losing clients. WhatsApp reminders go out on their own, appointments don\'t get lost. Customers tell us it\'s much more convenient.' },
      { text: 'The AI consultant handles questions around the clock. Chat conversion improved noticeably — even I was surprised. Support is quick too.' },
      { text: 'The driver and route dashboard eliminated the need for two analysts. Real-time data, one-click reports.' },
      { text: 'Membership tracking became simple. Clients pay via Kaspi, the system logs everything automatically. No more notebooks.' },
      { text: 'The CRM was tailored to our actual process, not a generic template. Pipeline, tasks, history — exactly how we needed it. The team picked it up quickly.' },
      { text: 'We automated course enrollment and payments. The admin used to be overwhelmed; now it all runs on its own. Students are happy.' },
      { text: 'Integrating 1C with our materials tracking system was a complex job. Albert worked through it and delivered on time. The data now stays consistent.' },
      { text: 'Small business, but the Telegram order bot genuinely made a difference. Wholesale clients now message the bot instead of calling at all hours.' },
      { text: 'Patient scheduling, reminders, visit history — all in one system. Runs without issues. I\'d recommend it to any medical practice.' },
      { text: 'The sales analytics helped us see which products were dragging us down. We cut them and profit grew. Simple but genuinely useful.' },
      { text: 'Loan application processing was automated with AI. Review time dropped from days to hours. Integration with our existing systems went smoothly.' },
      { text: 'An AI agent to handle inbound leads — exactly what we needed. No request gets lost now. Setup took a couple of days.' },
      { text: 'Warehouse inventory was integrated with 1C and Kaspi. Stocktaking is no longer a headache — everything reconciles automatically.' },
      { text: 'The WhatsApp bot answers tour questions and helps with selection. Managers only deal with closing. The season ran smoothly.' },
      { text: 'We needed a fast AI MVP. Albert had a working version in 10 days. We showed it to investors — it landed well. We\'re still iterating together.' },
    ],
  },

  // FAQ
  faq: {
    label: 'FAQ',
    title: 'Frequently Asked',
    title2: 'Questions',
    sub: "If your question isn't here, message me on Telegram — I reply within the hour.",
    cta: 'Get in Touch Directly',
    items: [
      { q: 'What are the typical timelines?', a: 'Prototype delivery in 7 days. Full projects typically range from 4 to 16 weeks depending on scope. I work in weekly iterations with live demos, so you always know where things stand.' },
      { q: 'How does payment work?', a: '30% upfront to begin, 40% on prototype approval, 30% on delivery. For larger projects, monthly milestone-based payments are available.' },
      { q: 'Do you work with international clients?', a: 'Yes. I work with clients in Kazakhstan, Russia, the CIS, and internationally. Communication takes place via Telegram, Notion, and Zoom.' },
      { q: 'Can AI be integrated into an existing 1C setup?', a: "Yes — this is one of my core specialisations. I can add an AI layer on top of any existing 1C configuration: automation, predictive analytics, voice interfaces." },
      { q: 'What does post-launch support include?', a: '24/7 monitoring, AI model updates, bug fixes, and feature development. I offer support packages starting at 50,000 ₸/month.' },
      { q: 'Do you provide any guarantees?', a: 'Yes. All work carries a 6-month guarantee. If the system doesn\'t behave as agreed, I fix it at no charge. I also offer a KPI agreement for AI projects.' },
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
  },

  // Home
  home: {
    aiLabel: 'AI at work',
    aiTitle: 'Not a demo deck,',
    aiTitle2: 'a system that runs',
    aiSub: 'We build tools people use every day: agents answering customers, a CRM moving deals forward, integrations keeping data in sync. The scene on the right is live — go ahead and grab it.',
    aiCta: 'Discuss your task',
    aiCtaSecondary: 'Ready solutions',
    aiHint: 'Drag the scene to rotate it',
  },
  // Consultant
  consultant: {
    title: 'Oberon consultant',
    online: 'online',
    placeholder: 'Describe your task...',
    greeting: 'Hello. Happy to work out which solution fits your case.\n\nWhat does your business do, and what would you like to automate?',
    disclaimer: 'Answered by a bot. The team gives exact estimates.',
  },

};

export default en;

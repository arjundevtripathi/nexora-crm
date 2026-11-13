import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

export const dynamic = 'force-dynamic';

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);

export async function POST(req: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) {
      return Response.json(
        { error: 'Sign in to access your CRM chatbot.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    const message = (body.message || '').trim();
    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const q = message.toLowerCase();

    // Query user's real CRM records from D1
    let contacts: any[] = [];
    let deals: any[] = [];
    let tasks: any[] = [];

    if (env.DB) {
      try {
        const rows = await env.DB.prepare(
          'SELECT kind, data FROM records WHERE owner = ? LIMIT 1000'
        )
          .bind(user.userId)
          .all<{ kind: string; data: string }>();

        for (const row of rows.results || []) {
          try {
            const parsed = JSON.parse(row.data);
            if (row.kind === 'contacts') contacts.push(parsed);
            else if (row.kind === 'deals') deals.push(parsed);
            else if (row.kind === 'tasks') tasks.push(parsed);
          } catch {}
        }
      } catch (dbErr) {
        console.error('Error querying DB for chatbot context:', dbErr);
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeDeals = deals.filter((d) => !['Won', 'Lost'].includes(d.stage));
    const wonDeals = deals.filter((d) => d.stage === 'Won');
    const lostDeals = deals.filter((d) => d.stage === 'Lost');
    const totalPipeline = activeDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const closedCount = wonDeals.length + lostDeals.length;
    const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

    const pendingTasks = tasks.filter((t) => !t.completed);
    const completedTasks = tasks.filter((t) => t.completed);
    const overdueTasks = pendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr);
    const highPriorityTasks = pendingTasks.filter((t) => t.priority === 'High');

    let reply = '';
    let suggestions: string[] = [];

    const hasAny = (...words: string[]) => words.some((w) => q.includes(w));

    // 1. GREETINGS
    if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|yo|hola)(\s|[!?,.]|$)/i.test(q)) {
      reply = `Hello ${user.displayName}! 👋\n\n` +
        `Welcome to your **Nexora CRM Workspace**.\n\n` +
        `• **Active Pipeline**: ${money(totalPipeline)} across ${activeDeals.length} active deal${activeDeals.length === 1 ? '' : 's'}.\n` +
        `• **Pending Follow-ups**: ${pendingTasks.length} task${pendingTasks.length === 1 ? '' : 's'} scheduled${overdueTasks.length ? ` (⚠️ ${overdueTasks.length} overdue)` : ''}.\n\n` +
        `What would you like to work on right now?`;
      suggestions = ['📊 Pipeline summary', '🎯 Top opportunities', '⏳ Pending tasks', '💡 Sales advice'];
    }
    // 2. EMAIL DRAFTING (Check BEFORE general words like "client" so "Draft email for client" works!)
    else if (hasAny('email', 'draft', 'template', 'write a message', 'follow up email', 'outreach', 'cold pitch')) {
      reply = `Here is an **Executive Follow-up Email Template** customized for your CRM workflow:\n\n` +
        `**Subject:** Quick check-in & next steps regarding our discussion\n\n` +
        `> Hi [Client Name],\n>\n` +
        `> Thank you for sharing your team's priorities during our recent conversation regarding [Project / Deal Name].\n>\n` +
        `> I wanted to confirm whether you had any questions on the proposal, deliverables, or proposed timeline.\n>\n` +
        `> Would you have 10 minutes this Thursday or Friday afternoon for a brief call to align on the next steps?\n>\n` +
        `> Best regards,\n` +
        `> **${user.displayName}**\n` +
        `> Nexora CRM Workspace\n\n` +
        `💡 *Pro-tip: Send follow-ups within 24 hours of your meeting to keep deals moving quickly.*`;
      suggestions = ['Negotiation advice', 'Top opportunities', 'Show pending tasks'];
    }
    // 3. SALES ADVICE & PRICING & NEGOTIATION
    else if (hasAny('pricing', 'discount', 'advice', 'tip', 'tips', 'strategy', 'how to close', 'close deal', 'negotiat', 'objection', 'tactics')) {
      reply = `Here are **3 Battle-Tested B2B Sales Tactics** for your pipeline:\n\n` +
        `1. **Focus on Decision Timeline**: Ask your prospects: *"What needs to happen on your side before we can kick this off next month?"*\n\n` +
        `2. **Never Discount Without Concession**: If a prospect asks for a price discount, offer it only in exchange for an annual upfront payment or a shorter billing cycle.\n\n` +
        `3. **Lock Down the Next Touchpoint**: Never end a conversation with *"I'll follow up soon"*. Always book the calendar invite for the next touchpoint before hanging up.`;
      suggestions = ['Top opportunities', 'Draft follow-up email', 'Pipeline summary'];
    }
    // 4. SPECIFIC DEAL STAGES (Won, Lost, Proposal, Negotiation)
    else if (hasAny('won deal', 'won revenue', 'deals won', 'how many won', 'closed won')) {
      if (wonDeals.length === 0) {
        reply = `You haven't marked any deals as **Won** yet.\n\n` +
          `You have **${activeDeals.length} active opportunities** totaling **${money(totalPipeline)}**. Focus on moving deals in *Proposal* or *Negotiation* to *Won*!`;
        suggestions = ['Top opportunities', 'Negotiation advice', 'Pipeline summary'];
      } else {
        const list = wonDeals.map((d, i) => `${i + 1}. **${d.name}** (${d.company || 'Private'}) — **${money(Number(d.value) || 0)}** on ${d.closeDate || 'Recent'}`).join('\n');
        reply = `🎉 **Closed Won Deals** (${wonDeals.length} deals totaling **${money(wonRevenue)}**):\n\n${list}\n\n` +
          `Your all-time win rate is **${winRate}%** (${wonDeals.length}/${closedCount} closed deals).`;
        suggestions = ['Pipeline summary', 'Top opportunities', 'Show pending tasks'];
      }
    }
    else if (hasAny('lost deal', 'lost revenue', 'deals lost', 'how many lost')) {
      if (lostDeals.length === 0) {
        reply = `You have **0 lost deals** recorded! That's a clean track record. Keep qualifying prospects early to maintain high win rates.`;
        suggestions = ['Pipeline summary', 'Top opportunities', 'Show pending tasks'];
      } else {
        const list = lostDeals.map((d, i) => `${i + 1}. **${d.name}** (${d.company || 'Private'}) — ${money(Number(d.value) || 0)}`).join('\n');
        reply = `**Closed Lost Deals** (${lostDeals.length}):\n\n${list}\n\n💡 *Tip: Conduct brief win/loss reviews on lost deals to uncover competitor or pricing patterns.*`;
        suggestions = ['Pipeline summary', 'Sales advice', 'Top opportunities'];
      }
    }
    else if (hasAny('proposal', 'in proposal', 'proposals')) {
      const proposalDeals = deals.filter((d) => d.stage === 'Proposal');
      if (proposalDeals.length === 0) {
        reply = `You currently have no deals in the **Proposal** stage.`;
        suggestions = ['Pipeline summary', 'Top opportunities', 'How to add a deal'];
      } else {
        const val = proposalDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
        const list = proposalDeals.map((d, i) => `${i + 1}. **${d.name}** (${d.company || 'Private'}) — **${money(Number(d.value) || 0)}** (Target: ${d.closeDate || 'TBD'})`).join('\n');
        reply = `📄 **Deals in Proposal Stage** (${proposalDeals.length} deals totaling **${money(val)}**):\n\n${list}\n\n` +
          `Would you like an executive email template to follow up on these proposals?`;
        suggestions = ['✉️ Draft follow-up email', 'Negotiation tips', 'Top opportunities'];
      }
    }
    // 5. DEALS & OPPORTUNITIES (Broad & Specific)
    else if (hasAny('deal', 'deals', 'opportunity', 'opportunities', 'top deal', 'highest deal', 'biggest deal', 'highest value')) {
      if (deals.length === 0) {
        reply = `You don't have any deals registered yet in your workspace.\n\n` +
          `To get started, click **"New deal"** in the top action bar or use **"Explore with sample data"** to load realistic sample deals.`;
        suggestions = ['Explore with sample data', 'How to add a deal', 'Tell me about contacts'];
      } else {
        const sorted = [...deals].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
        const top = sorted.slice(0, 5);
        const list = top
          .map((d, idx) => `${idx + 1}. **${d.name}** (${d.company || 'Private'}) — **${money(Number(d.value) || 0)}** [Stage: *${d.stage}*]`)
          .join('\n');

        reply = `Here is an overview of your **Opportunities** (${deals.length} total, **${money(totalPipeline)}** active pipeline):\n\n` +
          `${list}\n\n` +
          `• **Active deals**: ${activeDeals.length}\n` +
          `• **Closed Won**: ${wonDeals.length} (${money(wonRevenue)})\n` +
          `• **Win Rate**: ${winRate}%`;
        suggestions = ['📊 Pipeline summary', 'Show pending tasks', 'Draft follow-up email'];
      }
    }
    // 6. PIPELINE & METRICS
    else if (hasAny('pipeline', 'summary', 'metric', 'metrics', 'overview', 'stats', 'analytics', 'revenue', 'how much money', 'sales total', 'win rate')) {
      if (deals.length === 0 && contacts.length === 0) {
        reply = `Your workspace is currently empty.\n\n` +
          `Click **"Explore with sample data"** on your dashboard to instantly load sample contacts, deals, and tasks!`;
        suggestions = ['Explore with sample data', 'How to add a contact', 'How to add a deal'];
      } else {
        const stageCounts: Record<string, number> = {};
        for (const d of activeDeals) {
          stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
        }
        const stageSummary = Object.entries(stageCounts)
          .map(([stage, count]) => `• **${stage}**: ${count} deal${count > 1 ? 's' : ''}`)
          .join('\n');

        reply = `📊 **Sales Pipeline & Workspace Metrics**:\n\n` +
          `• **Total Active Pipeline**: **${money(totalPipeline)}** across ${activeDeals.length} opportunities\n` +
          `• **Closed Won Revenue**: **${money(wonRevenue)}** (${wonDeals.length} won)\n` +
          `• **Win Rate**: **${winRate}%** (${wonDeals.length}/${closedCount || 0} closed deals)\n` +
          `• **Total Contacts**: **${contacts.length}**\n` +
          `• **Pending Follow-up Tasks**: **${pendingTasks.length}**\n\n` +
          `**Active Stage Breakdown**:\n${stageSummary || '• No active deals.'}`;
        suggestions = ['🎯 Top opportunities', '⏳ Pending tasks', 'Who are my contacts?', '💡 Sales advice'];
      }
    }
    // 7. TASKS & FOLLOW-UPS & REMINDERS
    else if (hasAny('task', 'tasks', 'todo', 'todos', 'to-do', 'follow up', 'followup', 'due', 'deadline', 'reminder', 'reminders', 'next up')) {
      if (tasks.length === 0) {
        reply = `You have **0 tasks** scheduled right now.\n\n` +
          `Consistent follow-ups drive sales conversions. Click **"New task"** in the top action bar to create your next follow-up item.`;
        suggestions = ['How to create a task', 'Pipeline summary', 'Top opportunities'];
      } else {
        const pendingList = pendingTasks.slice(0, 5).map(
          (t, i) => `${i + 1}. **${t.name}** (${t.company || 'General'}) — Priority: \`${t.priority}\`, Due: **${t.dueDate}**`
        );

        reply = `📋 **Tasks & Follow-up Status**:\n\n` +
          `• **Pending Tasks**: ${pendingTasks.length}\n` +
          `• **Completed Tasks**: ${completedTasks.length}\n` +
          (overdueTasks.length ? `• ⚠️ **Overdue Tasks**: **${overdueTasks.length}** (require immediate attention!)\n` : '') +
          (highPriorityTasks.length ? `• 🔥 **High Priority**: **${highPriorityTasks.length}**\n\n` : '\n') +
          `**Upcoming Action Items**:\n` +
          (pendingList.length > 0 ? pendingList.join('\n') : '• All tasks completed! Great job! 🎉');
        suggestions = ['Draft follow-up email', 'Pipeline summary', 'Top opportunities'];
      }
    }
    // 8. CONTACTS & PEOPLE & CUSTOMERS & ACCOUNTS
    else if (hasAny('contact', 'contacts', 'people', 'person', 'client', 'clients', 'customer', 'customers', 'leads', 'partner', 'partners', 'network', 'accounts', 'account')) {
      if (contacts.length === 0) {
        reply = `You haven't added any contacts to your workspace yet.\n\n` +
          `Click **"New contact"** in the header or use the **"Contacts"** tab to register key clients and decision makers.`;
        suggestions = ['How to add a contact', 'Explore sample data', 'Pipeline summary'];
      } else {
        const leadCount = contacts.filter((c) => c.status === 'Lead').length;
        const customerCount = contacts.filter((c) => c.status === 'Customer').length;
        const partnerCount = contacts.filter((c) => c.status === 'Partner').length;

        const list = contacts.slice(0, 5).map(
          (c, i) => `${i + 1}. **${c.name}** — ${c.company || 'Individual'} (${c.email || 'No email'}) [Status: *${c.status || 'Lead'}*]`
        );

        reply = `👥 **Your Contacts Network** (${contacts.length} total contacts):\n\n` +
          `• **Customers**: ${customerCount}\n` +
          `• **Leads**: ${leadCount}\n` +
          `• **Partners**: ${partnerCount}\n\n` +
          `**Recent Contacts**:\n${list.join('\n')}\n\n` +
          `You can filter contacts by status or search by company in the Contacts tab.`;
        suggestions = ['Show pending tasks', 'Top opportunities', 'Pipeline summary'];
      }
    }
    // 9. IDENTITY & ROLE ("who am i", "my role", "my account")
    else if (hasAny('who am i', 'my role', 'my account', 'logged in', 'my profile', 'my email')) {
      reply = `You are currently logged in as **${user.displayName}**.\n\n` +
        `• **Email Address**: \`${user.email}\`\n` +
        `• **Assigned Role**: **${user.role === 'admin' ? 'Administrator' : 'Sales Representative'}**\n` +
        `• **Workspace Mode**: ${user.role === 'admin' ? 'Full Administrator Access' : 'Private Sales Workspace'}\n` +
        `• **User ID**: \`${user.userId}\`\n\n` +
        `All deals, contacts, and follow-ups you create are encrypted and isolated to your account.`;
      suggestions = ['📊 Pipeline summary', 'Show my deals', 'Who are my contacts?'];
    }
    // 10. CAPABILITIES / HELP ("what can you do", "who are you", "what are you")
    else if (hasAny('what can you do', 'who are you', 'what are you', 'how can you help', 'capabilities', 'features')) {
      reply = `I am your **Nexora CRM AI Assistant**, deeply integrated with your live database.\n\n` +
        `Here are the core tasks I can handle for you:\n\n` +
        `1. **Deal & Pipeline Intelligence**: Analyze open pipeline value, win rate, stage distribution, and top deals.\n` +
        `2. **Contact & Account Search**: Look up contacts, companies, relationship statuses, and email addresses.\n` +
        `3. **Task & Follow-up Tracking**: Monitor overdue items, upcoming deadlines, and high-priority action items.\n` +
        `4. **Executive Email Drafting**: Compose personalized follow-ups, proposal intros, and check-in emails.\n` +
        `5. **Sales Strategy & Coaching**: Provide negotiation tactics, objection handling, and deal-closing frameworks.\n` +
        `6. **CRM Guidance**: Explain how to export CSVs, adjust stages, or structure deals.`;
      suggestions = ['📊 Pipeline summary', '🎯 Top opportunities', '⏳ Pending tasks', '✉️ Draft follow-up email'];
    }
    // 11. GENERAL CRM / BUSINESS EXPLANATION
    else if (hasAny('what is crm', 'what is nexora', 'how does this work', 'explain crm')) {
      reply = `**Nexora CRM** is a high-performance Customer Relationship Management platform designed to help you track prospects, progress opportunities, and close revenue faster.\n\n` +
        `Key components:\n` +
        `• **Contacts**: People and decision-makers in your network (Lead, Customer, Partner).\n` +
        `• **Deals & Pipeline**: Track opportunities through stages (Lead → Qualified → Proposal → Negotiation → Won).\n` +
        `• **Tasks**: Follow-up reminders with priorities to ensure deals don't stall.\n` +
        `• **Activity Log**: Server-verified audit trail of all changes.`;
      suggestions = ['Explore sample data', 'How to add a deal', 'Pipeline summary'];
    }
    // 12. HOW-TO / FEATURE GUIDANCE
    else if (hasAny('how to', 'how do i', 'export', 'csv', 'add contact', 'add deal', 'create', 'delete', 'stage')) {
      if (hasAny('export', 'csv', 'download')) {
        reply = `To export your records:\n` +
          `1. Click the **"Export"** button in the top action bar.\n` +
          `2. Your browser will download a sanitized CSV file named \`nexora-crm-[date].csv\` containing all visible contacts, deals, or tasks.\n` +
          `3. Formula injection protection is built-in for spreadsheet safety.`;
      } else if (hasAny('deal', 'pipeline')) {
        reply = `To create or update a deal:\n` +
          `• **New Deal**: Click the purple **"New deal"** button in the header (or the **"+"** icon on any pipeline stage lane).\n` +
          `• **Change Stage**: In the Pipeline board, choose the stage dropdown directly on any deal card, or click the card to edit.`;
      } else if (hasAny('contact')) {
        reply = `To create a contact:\n` +
          `• Switch to the **Contacts** tab in the sidebar and click **"New contact"**.\n` +
          `• Enter the contact's Name, Company, Email, Phone, and Relationship status (*Lead, Customer, or Partner*).`;
      } else {
        reply = `Here is how to manage records in Nexora CRM:\n` +
          `• **Navigation**: Use the left sidebar to jump between *Overview*, *Contacts*, *Pipeline*, *Tasks*, and *Activity*.\n` +
          `• **Creating Records**: Use the **"New ..."** button at the top right of each screen.\n` +
          `• **Editing / Deletion**: Click on any record card or table row to edit its fields or delete it.\n` +
          `• **Search & Filters**: Use the toolbar search box and status dropdowns to filter records instantly.`;
      }
      suggestions = ['Pipeline summary', 'Top opportunities', 'Show pending tasks'];
    }
    // 13. SEARCH IN DATABASE BY KEYWORD (Company name, person name, deal name)
    else {
      const matchedDeals = deals.filter(
        (d) => d.name?.toLowerCase().includes(q) || d.company?.toLowerCase().includes(q)
      );
      const matchedContacts = contacts.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
      );
      const matchedTasks = tasks.filter(
        (t) => t.name?.toLowerCase().includes(q) || t.company?.toLowerCase().includes(q)
      );

      if (matchedDeals.length > 0 || matchedContacts.length > 0 || matchedTasks.length > 0) {
        let results = `Here is what I found in your workspace for **"${message}"**:\n\n`;
        if (matchedDeals.length > 0) {
          results += `**Deals (${matchedDeals.length})**:\n` +
            matchedDeals.map((d) => `• **${d.name}** (${d.company || 'Private'}) — **${money(Number(d.value) || 0)}** [${d.stage}]`).join('\n') + '\n\n';
        }
        if (matchedContacts.length > 0) {
          results += `**Contacts (${matchedContacts.length})**:\n` +
            matchedContacts.map((c) => `• **${c.name}** (${c.company || 'No Company'}) — \`${c.email || 'No email'}\` [${c.status || 'Lead'}]`).join('\n') + '\n\n';
        }
        if (matchedTasks.length > 0) {
          results += `**Tasks (${matchedTasks.length})**:\n` +
            matchedTasks.map((t) => `• **${t.name}** (Due: ${t.dueDate}, Priority: ${t.priority})`).join('\n') + '\n\n';
        }
        reply = results;
        suggestions = ['📊 Pipeline summary', '🎯 Top opportunities', '⏳ Pending tasks'];
      } else {
        // Conversational intelligent fallback tailored to their prompt
        reply = `Regarding **"${message}"**:\n\n` +
          `I am monitoring your active workspace. You currently have:\n` +
          `• **${activeDeals.length} active deal${activeDeals.length === 1 ? '' : 's'}** totaling **${money(totalPipeline)}**\n` +
          `• **${pendingTasks.length} pending follow-up task${pendingTasks.length === 1 ? '' : 's'}**\n` +
          `• **${contacts.length} total contact${contacts.length === 1 ? '' : 's'}** in your directory\n\n` +
          `Feel free to ask me to analyze any stage, search for an account, draft an outreach email, or provide closing advice.`;
        suggestions = [
          '📊 Pipeline summary',
          '🎯 Top opportunities',
          '⏳ Pending tasks',
          '✉️ Draft follow-up email'
        ];
      }
    }

    return Response.json({
      reply,
      suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Chatbot error:', err);
    return Response.json(
      { error: err.message || 'Unable to process chatbot message' },
      { status: 500 }
    );
  }
}

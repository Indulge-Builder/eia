# Across Indulge Group

> Elia is the intelligence layer that sits across every department of Indulge Group. This page shows what she does for each team, where the data comes from, and how it all connects.
> 

---

# How to Read This Page

| Symbol | Meaning |
| --- | --- |
| **Data In** | Where information comes from for each department |
| **Elia Does** | What Elia helps that department accomplish |
| **Atlas Stores** | What gets saved to the secure database |

> Every department connects to the same Elia brain and the same Atlas database. Data flows in from the outside world, Elia processes it, agents act on it, and it all gets stored securely in Atlas — ready for the next interaction.
> 

---

# The Big Picture

```mermaid
flowchart TD
    subgraph SOURCES [" Where Data Comes From "]
        META[Meta Ads]
        WA[WhatsApp]
        FD[Freshdesk]
        INSTA[Instagram]
        WEB[Website and Typeform]
        SOC[Social Media]
        AUDIO[Meeting Audio]
        PAY[Payment Systems]
        VENDOR[Vendor Catalogue]
    end

    subgraph ELIA [" Elia — The Intelligence Layer "]
        BRAIN[Elia AI Brain]
        CACHE[Smart Cache - Upstash Redis]
        EMBED[Client Memory - pgvector]
        VISION[Screen Vision - Gemini Flash]
        REASON[Deep Reasoning - Claude 4.6]
    end

    subgraph ATLAS [" Atlas OS — The Secure Foundation "]
        DB[(Secure Database)]
        RLS[Row-Level Security]
        TASKS[Task Engine]
        REALTIME[Live Updates]
    end

    subgraph DEPTS [" The Eight Departments "]
        OB[Onboarding]
        FIN[Finance]
        CON[Concierge]
        JOK[Joker]
        SHOP[Shop]
        MKT[Marketing]
        TECH[Tech]
        LEG[Legacy]
    end

    META --> BRAIN
    WA --> BRAIN
    FD --> BRAIN
    INSTA --> BRAIN
    WEB --> BRAIN
    SOC --> BRAIN
    AUDIO --> BRAIN
    PAY --> BRAIN
    VENDOR --> BRAIN

    BRAIN --> CACHE
    BRAIN --> EMBED
    BRAIN --> VISION
    BRAIN --> REASON

    REASON --> OB
    REASON --> FIN
    REASON --> CON
    REASON --> JOK
    REASON --> SHOP
    REASON --> MKT
    REASON --> TECH
    REASON --> LEG

    OB --> DB
    FIN --> DB
    CON --> DB
    JOK --> DB
    SHOP --> DB
    MKT --> DB
    TECH --> DB
    LEG --> DB

    DB --> RLS
    DB --> TASKS
    DB --> REALTIME
```

---

# The Blurprint

01 — Vision & Problem Statement

02 — Atlas OS Foundation

03 — Core Capabilities

04 — Agent Interfaces

05 — Hybrid Tech Stack & Architecture

06 — Delivery Roadmap

07 — Financial Projections

08 — Security & Compliance

09 — KPIs & Success Metrics

10 — Decision Log

# The Eight Departments

---

## 1. Onboarding

> First contact with the client. Speed and personalisation win the relationship.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Meta Ads | New lead details from ad forms |
| Pabbly Connect | Bridge that delivers leads into Atlas instantly |
| Public web data | Professional background, company, social presence |

**Elia Does**

- Researches the lead online before the agent even picks up the phone — so the conversation feels personal from the first second
- Drafts smart follow-up messages tailored to the lead's profile
- Reminds agents when is the best time to call, based on workload and time zone
- Flags leads that have gone cold and suggests re-engagement

```mermaid
flowchart LR
    META[Meta Ad] --> PAB[Pabbly Connect]
    PAB --> ATLAS[Lead enters Atlas]
    ATLAS --> ELIA[Elia researches lead online]
    ELIA --> AGENT[Agent sees enriched profile]
    AGENT --> CALL[First call feels researched and personal]
```

---

## 2. Finance

> The money layer. Every rupee in and out — tracked, approved, and reported.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Client approval in Atlas | Trigger to send payment link |
| Payment gateway | Confirmation of payment received |
| Department tool bills | Monthly subscription costs to track |
| Concierge requests | Expenses paid on behalf of clients |

**Elia Does**

- Generates and sends payment links when a lead is approved for onboarding
- Tracks whether payment has been received and notifies the right people
- Moves approved paying clients into the Concierge group automatically
- Tracks money spent on behalf of clients and flags when reimbursement is due
- Monitors monthly tool subscriptions across all departments
- Assists with salary and cost reporting

```mermaid
flowchart LR
    APPROVE[Lead approved] --> LINK[Payment link sent]
    LINK --> PAY[Client pays]
    PAY --> CHECK[Finance confirms]
    CHECK --> MOVE[Client joins Concierge group]
    MOVE --> ELIA[Elia logs full client financial record]
```

---

## 3. Concierge

> The heart of Indulge. Elia's deepest integration — from first ticket to flawless delivery.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Freshdesk | Full ticket history for every client |
| WhatsApp | Real conversation history and tone |
| Typeform and Website | Structured preference data |
| Social Media | Lifestyle signals — travel, dining, hobbies |
| Meeting Audio | Whisper transcription of in-person conversations |

**Elia Does**

- Builds a living client profile that auto-updates with every interaction
- Chrome Extension reads the agent's screen the moment a ticket opens — no searching needed
- Surfaces client constraints, past requests, and vendor history instantly
- Flags vendor conflicts in real time as agents browse supplier sites
- Creates structured sub-tasks for complex requests and routes them to the right team
- Checks ticket quality before submission — ensures nothing is missed

```mermaid
flowchart TD
    FD[Freshdesk ticket] --> PROFILE[Living Client Profile]
    WA[WhatsApp history] --> PROFILE
    SOC[Social media] --> PROFILE
    AUDIO[Meeting notes] --> PROFILE
    WEB[Website and forms] --> PROFILE

    PROFILE --> EXT[Chrome Extension activates on ticket open]
    EXT --> CONTEXT[Agent sees full context instantly]
    CONTEXT --> VENDOR[Elia audits vendor site live]
    CONTEXT --> TASKS[Elia creates workflow sub-tasks]
    TASKS --> ROUTE[Routes to Concierge - Shop - Finance - Legacy]
    ROUTE --> DONE[Ticket completed - client delighted]
```

---

## 4. Joker

> Concierge's creative arm. Hyper-personalised recommendations that feel like magic.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Client profile (from Concierge) | Preferences, lifestyle, past experiences |
| Past itineraries | What they have done and loved |
| Ticket history | What they ask for repeatedly |

**Elia Does**

- Reads the client's full profile and generates personalised recommendations — travel destinations, restaurants, experiences, hidden gems
- Recommendations are specific, not generic — based on actual client history
- Proposals are attached directly to the ticket workflow so nothing is lost
- Surprise-and-delight ideas for birthdays, anniversaries, and milestones

```mermaid
flowchart LR
    PROFILE[Client Profile] --> JOKER[Joker agent opens recommendation tool]
    JOKER --> ELIA[Elia reads profile + history]
    ELIA --> RECS[Generates 3 to 5 personalised suggestions]
    RECS --> TICKET[Attached to client ticket]
    TICKET --> CLIENT[Client receives curated recommendation]
```

---

## 5. Shop

> A luxury marketplace. 100+ vendors. Anything sourced. Anywhere.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Meta Ads | Shop-specific leads and product enquiries |
| WhatsApp group | Collection broadcasts and inbound orders |
| Instagram DMs | Order requests and product enquiries |
| Vendor catalogue | 100+ supplier product and pricing data |

**Elia Does**

- Routes inbound orders from WhatsApp and Instagram into Atlas automatically
- Suggests which vendor to source from based on product type and availability
- Broadcasts new collections to the WhatsApp group with smart timing
- Tracks order status from source to delivery
- Flags when a client from Concierge has also placed a Shop order — connects the dots

```mermaid
flowchart LR
    WA[WhatsApp order] --> ATLAS[Logged in Atlas]
    INSTA[Instagram DM] --> ATLAS
    META[Meta Ad lead] --> ATLAS
    ATLAS --> ELIA[Elia identifies vendor and routes]
    ELIA --> VENDOR[Vendor sourcing begins]
    VENDOR --> DELIVER[Order tracked to delivery]
```

---

## 6. Marketing

> The brand voice. Social, PR, podcast, content — all supercharged.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Social media platforms | Engagement data and content performance |
| Campaign metrics | Ad spend and conversion from Meta and Google |
| PR assets | Brand mentions, press hits |
| Podcast content | Episode topics and audience signals |

**Elia Does**

- Maintains a content calendar across all platforms
- Tracks campaign performance and surfaces insights without manual reporting
- Helps write and brief content based on what is performing well
- Coordinates content requests from other departments — Shop launches, Concierge stories, Legacy features
- PR and brand asset library — always up to date

---

## 7. Tech

> The team that keeps everything running. Elia watches herself so Tech can sleep.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Atlas system logs | Health of every integration and service |
| Tool usage data | Which tools are being used across departments |
| Error monitoring (Sentry) | Real-time error and performance alerts |

**Elia Does**

- Monitors system health across Atlas, Elia, and all integrations
- Alerts Tech when something breaks — before agents notice
- Tracks all third-party tool subscriptions and usage
- Manages integration health — Pabbly, WhatsApp API, Meta, Freshdesk
- Self-monitors Elia's own AI costs and performance

---

## 8. Legacy

> The most personal product. A 5-generation story, beautifully made.
> 

**Data In**

| Source | What It Provides |
| --- | --- |
| Client interviews | Stories, memories, family history |
| Photo archives | Uploaded family photographs |
| Family records | Documents, timelines, genealogy |

**Elia Does**

- Structures interview notes into a coherent narrative
- Manages the production workflow — from interview to draft to final book
- Organises photo assets and suggests layout.
- Tracks the project timeline and milestones
- Archives the final book and all source materials securely in Atlas

---

# How a Client Moves Through Indulge

From the first ad click to a lifelong luxury relationship.

```mermaid
flowchart TD
    AD[Client sees Meta or Google Ad] --> FORM[Fills out enquiry form]
    FORM --> PAB[Pabbly delivers lead to Atlas]
    PAB --> OB[Onboarding agent contacts lead]
    OB --> ELIA_OB[Elia provides pre-call research + best time to call]

    OB --> QUAL{Is the client a good fit?}
    QUAL -->|No| NURTURE[Nurture sequence - Elia sends follow-ups]
    QUAL -->|Yes| FIN[Finance sends payment link]

    FIN --> PAY[Client pays]
    PAY --> CONCIERGE[Client enters Concierge group]

    CONCIERGE --> TICKET[Client raises first request]
    TICKET --> ELIA_CON[Elia loads full context - Chrome Extension]
    ELIA_CON --> WORKFLOW[Task workflow created across departments]

    WORKFLOW --> CON_TEAM[Concierge curates options]
    WORKFLOW --> SHOP_TEAM[Shop sources items if needed]
    WORKFLOW --> JOK_TEAM[Joker adds personalised recommendations]
    WORKFLOW --> FIN_TEAM[Finance tracks any expenses]

    CON_TEAM --> DELIVERED[Experience delivered to client]
    SHOP_TEAM --> DELIVERED
    JOK_TEAM --> DELIVERED
    FIN_TEAM --> DELIVERED

    DELIVERED --> PROFILE_UPDATE[Elia updates client profile automatically]
    PROFILE_UPDATE --> NEXT[Ready for next request - even more personalised]

    DELIVERED --> LEGACY{Long-term client?}
    LEGACY -->|Yes| LEG_TEAM[Legacy team creates their 5-generation book]
```

---

# 

---
# INDULGE GLOBAL MOBILE APP — DESIGN SYSTEM & UI IMPLEMENTATION SPECIFICATION

## 1. PURPOSE OF THIS DOCUMENT

This document is the visual, interaction, and frontend implementation source of truth for the new Indulge Global mobile application.

The application is being rebuilt from the ground up.

The provided reference image is the primary visual direction.

Do not merely copy the individual screens shown in the reference image.

Instead:

1. Study the visual language.
2. Extract its design principles.
3. Build a coherent, production-grade design system from those principles.
4. Apply that system consistently across the entire Indulge application.
5. Improve weak areas where necessary.
6. Preserve the emotional character of the reference.

The final product must feel like a privately commissioned digital concierge environment for HNI and UHNI members.

This is not a conventional luxury shopping application.

This is not a banking application.

This is not a SaaS dashboard.

This is not a social media application.

This is not an application trying to maximize engagement, screen time, or conversion through aggressive UI patterns.

Indulge is a private command centre for a member’s life.

The core emotional outcome is:

CALM.

TRUST.

DISCRETION.

EFFORTLESSNESS.

PERSONAL ATTENTION.

QUIET EXCLUSIVITY.

The application should feel as though an exceptional concierge has already prepared everything before the member arrives.

---

# 2. PRIMARY DESIGN PHILOSOPHY

## THE DIGITAL PRIVATE CONCIERGE

The central design concept is:

“Your world, quietly handled.”

Every interface decision must reinforce this concept.

The member should never feel that they are operating complex software.

They should feel that they are entering a calm private environment where information has already been organized for them.

The application must reduce:

- visual noise
- unnecessary decisions
- excessive navigation
- aggressive CTAs
- promotional content
- information overload
- unnecessary notifications
- complicated workflows

The application should increase:

- confidence
- clarity
- comfort
- anticipation
- personalization
- emotional connection
- perceived quality

Luxury is expressed through restraint.

Do not attempt to make every component visually impressive.

The most important content should receive visual emphasis.

Everything else should quietly support it.

---

# 3. TARGET AUDIENCE

The primary users are affluent HNI and UHNI members aged approximately 30+.

Many users are:

- founders
- CEOs
- investors
- business families
- celebrities
- executives
- global travellers
- collectors
- luxury consumers

These users interact with extremely high-quality physical products and services.

They notice:

- inconsistent spacing
- cheap animations
- excessive gradients
- poor typography
- clutter
- generic templates
- unnecessary friction
- visual gimmicks
- fake luxury aesthetics

The application must therefore demonstrate exceptional attention to detail.

Every screen should feel intentionally composed.

---

# 4. CORE VISUAL DIRECTION

The application has two complete visual themes.

## THEME A — OBSIDIAN

The primary dark experience.

Characteristics:

- near-black surfaces
- charcoal
- graphite
- smoked glass
- metallic black
- champagne gold
- soft illumination
- controlled reflections
- dimensional surfaces

The experience should resemble:

- precision jewellery
- luxury watch packaging
- a private members club
- an executive lounge at night
- polished obsidian
- dark brushed metal

Avoid:

- pure flat black everywhere
- neon gold
- bright yellow
- excessive glowing effects
- gaming aesthetics
- cyberpunk aesthetics
- crypto-dashboard aesthetics

---

## THEME B — IVORY

The light experience.

Characteristics:

- warm ivory
- parchment
- soft cream
- porcelain
- stone
- muted sage
- powder blue
- dusty lavender
- pale champagne

The experience should resemble:

- a quiet luxury hotel suite
- natural morning light
- handmade paper
- soft stone
- premium editorial design
- contemporary European hospitality

Avoid:

- sterile pure white
- childish pastel colours
- excessive colour
- conventional neumorphism
- low-contrast accessibility problems

The two themes must feel like the same product.

Do not build two independent design languages.

OBSIDIAN = evening.

IVORY = morning.

Same architecture.

Same typography.

Same component system.

Different atmosphere.

---

# 5. BRAND COLOURS

Use semantic design tokens.

Never scatter raw colour values throughout components.

## OBSIDIAN THEME

```css
--bg-primary: #090a0a;
--bg-secondary: #0e1010;
--bg-elevated: #141616;
--bg-soft: #191b1a;

--surface-primary: #111313;
--surface-secondary: #181a19;
--surface-elevated: #1e201f;

--text-primary: #f5f1e8;
--text-secondary: #b9b4a9;
--text-tertiary: #77746d;

--gold-primary: #d6ae68;
--gold-secondary: #b98a43;
--gold-soft: #e4c88f;
--gold-dark: #74542d;

--border-subtle: rgba(214, 174, 104, 0.12);
--border-default: rgba(255, 255, 255, 0.08);
--border-emphasis: rgba(214, 174, 104, 0.3);
```

---

## IVORY THEME

```css
--bg-primary: #f4f0e8;
--bg-secondary: #ede7dd;
--bg-elevated: #faf7f1;
--bg-soft: #e7e1d7;

--surface-primary: #f8f4ed;
--surface-secondary: #eee8de;
--surface-elevated: #fffcf7;

--text-primary: #282622;
--text-secondary: #6e685f;
--text-tertiary: #999187;

--gold-primary: #b78b4d;
--gold-secondary: #9a7039;
--gold-soft: #d6b77e;

--pastel-sage: #d8e0d5;
--pastel-blue: #dce2e5;
--pastel-lavender: #ded9e4;
--pastel-rose: #e7d9d3;
```

These values are starting foundations.

Fine-tune them during implementation if required to accurately reproduce the visual quality of the reference.

---

# 6. GOLD MATERIAL SYSTEM

Gold is the signature accent.

It must be used carefully.

Gold should communicate:

- importance
- warmth
- craftsmanship
- membership
- premium interaction

Gold must NOT be used as decoration everywhere.

Use gold primarily for:

- active navigation
- primary actions
- wallet details
- important numbers
- selected states
- logo treatment
- small separators
- premium iconography
- progress indicators
- subtle highlights

Create three gold treatments.

## GOLD FLAT

Used for:

- icons
- typography
- borders
- active states

## GOLD METALLIC

Used for:

- premium cards
- wallet surfaces
- selected navigation elements
- important 3D objects

Use subtle multi-stop gradients.

Never use a simple yellow-orange gradient.

## GOLD GLOW

Used extremely sparingly.

Only for:

- logo animation
- mascot entrance
- selected moments
- primary confirmation moments

Glow radius should remain controlled.

The application should never look neon.

---

# 7. TYPOGRAPHY SYSTEM

Typography direction:

Classic Swiss modernism with precision monospace details.

Primary inspiration:

- Neue Haas Grotesk
- Helvetica Neue
- contemporary Swiss editorial typography

Use the closest production-safe font available in the project.

## PRIMARY TYPEFACE

Use for:

- headings
- body text
- buttons
- navigation
- cards

Characteristics:

- neutral
- highly legible
- modern
- understated

## MONOSPACE TYPEFACE

Use selectively for:

- request IDs
- transaction references
- timestamps
- status metadata
- small numerical details
- technical information

Do NOT overuse monospace typography.

It is a precision accent.

---

# 8. TYPOGRAPHY HIERARCHY

Create reusable typography tokens.

```text
Display Large
32–36px
Medium weight
Tight tracking

Display
28–32px
Medium weight

Heading 1
24–28px
Medium / Semibold

Heading 2
20–22px
Medium

Heading 3
17–19px
Medium

Body Large
16–17px
Regular

Body
14–16px
Regular

Caption
12–13px
Regular

Micro
10–11px
Medium / Monospace
```

Avoid excessive bold typography.

Luxury interfaces rely more on:

- scale
- spacing
- hierarchy
- contrast

than heavy font weights.

---

# 9. SPACING SYSTEM

Use a strict 4-point spacing system.

```text
4
8
12
16
20
24
32
40
48
64
```

Mobile horizontal page padding:

```text
20px
```

Dense content areas may use:

```text
16px
```

Major section separation:

```text
28–40px
```

Spacing consistency is non-negotiable.

Never introduce arbitrary values without a documented reason.

---

# 10. BORDER RADIUS SYSTEM

```text
Small controls: 8–10px

Inputs: 12–14px

Standard cards: 16–18px

Premium cards: 20–24px

Large visual surfaces: 24–28px

Pills: fully rounded
```

Do not make every object excessively rounded.

The interface should feel refined rather than playful.

---

# 11. DEPTH SYSTEM

The application uses soft three-dimensional depth.

Depth comes from:

- tonal layering
- subtle highlights
- controlled shadows
- internal borders
- material contrast

Do NOT rely on large drop shadows.

Create four elevation levels.

## LEVEL 0

Page background.

## LEVEL 1

Standard content surfaces.

## LEVEL 2

Interactive cards.

## LEVEL 3

Floating controls and navigation.

## LEVEL 4

Modal surfaces and major overlays.

Each level must have reusable design tokens.

---

# 12. APPLICATION ARCHITECTURE

The main application contains five primary destinations.

1. MY CONCIERGE
2. SHOP
3. CHATROOM
4. EXPLORE
5. PROFILE

The navigation must support:

- tapping
- horizontal swiping between major destinations
- smooth state preservation
- premium transitions

My Concierge is the default destination for paid members.

The application also contains secondary pages accessible through the top-left menu.

These include:

- My Requests
- My Interests
- Bucket List
- Tastes
- Wallet & Transactions
- Newsroom
- Membership Benefits
- Refer a Friend
- FAQs
- Privacy Policy
- Terms & Conditions
- Settings
- Customer Service

Do not overload the bottom navigation with secondary functionality.

---

# 13. SPLASH / LAUNCH EXPERIENCE

The first application experience must establish the brand.

Screen composition:

- deep obsidian background
- centered Indulge logo
- subtle gold material treatment
- restrained particle environment
- minimal brand statement
- thin progress indicator

Possible copy:

“Crafting experiences,
creating memories.”

Animation sequence:

1. Screen begins almost completely dark.
2. A subtle light passes across the logo.
3. Logo geometry slowly becomes visible.
4. Fine gold particles appear.
5. Brand name fades upward.
6. A restrained ambient gold wave moves across the lower background.
7. Progress indicator completes.
8. Interface transitions smoothly into the application.

Duration:

Approximately 1.8–2.8 seconds depending on loading requirements.

Do not create a long forced animation.

Returning users should not be unnecessarily delayed.

---

# 14. MY CONCIERGE — PRIMARY DASHBOARD

This is the most important screen in the application.

The dashboard must answer four questions immediately:

1. Who is taking care of me?
2. What is happening right now?
3. What has Indulge accomplished for me?
4. How do I contact my concierge?

The screen structure is:

TOP BAR

↓

PERSONAL GREETING

↓

MASCOT / PERSONAL CONCIERGE PRESENCE

↓

WALLET

↓

YEARLY IMPACT

↓

ACTIVE REQUESTS

↓

MESSAGE MY CONCIERGE

↓

BOTTOM NAVIGATION

---

# 15. DASHBOARD TOP BAR

Left:

Minimal hamburger/menu icon.

Center:

Small Indulge logo mark.

Right:

Notification icon.

Notification badge should be tiny and restrained.

Do not use aggressive red badges unless critical.

Use gold or warm neutral indicators.

Top bar should feel integrated into the page.

Do not place it inside a generic app-bar rectangle.

---

# 16. PERSONAL GREETING

Example:

“Welcome back,”

“Arham Mehta ✦”

Supporting copy:

“Your world, our privilege.”

Alternative dynamic copy may change according to:

- time
- context
- user state

The user’s name receives primary visual emphasis.

Avoid excessive personalization copy.

One excellent sentence is better than five generic sentences.

---

# 17. GENIE MASCOT SYSTEM

The mascot is a central emotional component.

It must NOT look like:

- a children’s game character
- a Disney imitation
- a generic chatbot
- a sticker
- a cartoon pasted onto the UI

The mascot should feel:

- warm
- discreet
- competent
- slightly magical
- emotionally intelligent
- premium

Visual treatment:

- soft 3D rendering
- black / charcoal clothing
- subtle gold detailing
- warm facial expression
- carefully controlled lighting

The mascot can appear contextually.

Examples:

Dashboard:
welcoming pose.

Empty requests:
relaxed pose.

Successful request:
subtle celebratory pose.

Wallet:
responsible / attentive pose.

Bucket list:
curious pose.

Error state:
calm reassuring pose.

Do not display the mascot on every screen.

Its appearance must remain meaningful.

---

# 18. WALLET CARD

The wallet card is one of the strongest dashboard surfaces.

Content:

WALLET BALANCE

₹2,45,000.00

Available Credit

Top Up +

Visual direction:

- dark metallic card
- restrained champagne illumination
- soft internal border
- dimensional surface
- premium icon or abstract object

The balance is the primary element.

Never overfill the card with financial information.

Tap opens Wallet & Transactions.

---

# 19. YEARLY IMPACT CARD

The purpose of this card is not analytics.

It demonstrates the value Indulge has created for the member.

Primary metrics:

REQUESTS COMPLETED

248

HOURS SAVED

620+

DESTINATIONS

32

Use a calm, horizontal composition.

Numbers receive emphasis.

Labels remain quiet.

A small premium 3D indicator may occupy the centre.

The card must feel emotional rather than corporate.

Possible section title:

“Your Year with Indulge”

or

“This Year”

---

# 20. ACTIVE REQUESTS

The request list is the operational heart of the dashboard.

Section header:

ACTIVE REQUESTS

View All →

Each request row contains:

- small contextual image or icon
- request title
- category / secondary detail
- status
- relative time
- overflow menu

Example:

Wimbledon 2025 Finals

2 Tickets · Centre Court

IN PROGRESS

Today

Status system:

IN PROGRESS

CONFIRMED

SOURCING

WAITING FOR YOU

COMPLETED

CANCELLED

Use muted status colours.

Never use bright SaaS dashboard colours.

Status colours must work in both themes.

---

# 21. REQUEST DETAILS SCREEN

When a request opens, show:

- request title
- current status
- contextual image
- request metadata
- progress timeline
- event history
- related documents if applicable
- concierge contact action

The timeline should be visually elegant.

Example:

Request received

↓

Concierge assigned

↓

Options sourced

↓

Awaiting confirmation

↓

Confirmed

Use progressive disclosure.

Do not show all technical details immediately.

---

# 22. ACTIVE / COMPLETED REQUEST TOGGLE

At the top of the requests page use a premium segmented control.

ACTIVE

COMPLETED

The transition between states should animate horizontally.

Avoid generic tabs with large underlines.

The control should feel physically integrated into the surface.

---

# 23. PRIMARY CONCIERGE ACTION

The main action is:

MESSAGE MY CONCIERGE

This opens the member’s concierge WhatsApp group.

The CTA should remain easy to find.

Possible implementations:

- premium floating action
- bottom anchored button
- contextual dashboard card

Do not make the CTA oversized.

The user already pays for the service.

The interface does not need to aggressively sell the action.

---

# 24. BOTTOM NAVIGATION

Five destinations:

MY CONCIERGE

SHOP

CHATROOM

EXPLORE

PROFILE

Use icons plus compact labels.

Active state:

- champagne gold icon
- subtle illumination
- slightly elevated treatment
- stronger label contrast

Inactive state:

- muted neutral icon
- quiet label

The navigation may have a soft floating surface.

It should never look like a generic iOS tab bar.

Interaction:

Tap destination.

Or:

Swipe horizontally between primary destinations.

Transitions should preserve the conceptual feeling of moving between connected rooms in the same private environment.

---

# 25. SHOP

The Shop is not a conventional ecommerce store.

It is a curated environment for rare objects and exclusive opportunities.

Core emotional direction:

“Rare finds. Timeless possibilities.”

Structure:

SEARCH

↓

EDITORIAL HERO

↓

CURATED COLLECTIONS

↓

CATEGORY DISCOVERY

↓

PRODUCT STORIES

Product categories may include:

- Watches
- Handbags
- Art
- Collectibles
- Fashion
- Rare Objects

Avoid:

- discount badges
- sales language
- ecommerce clutter
- dense grids
- aggressive product prices

Primary actions:

ENQUIRE

ADD TO INTEREST

Never:

BUY NOW

---

# 26. SHOP HERO

The hero should feel editorial.

Large product imagery.

Minimal copy.

Example:

“Rare finds.
Timeless possibilities.”

CTA:

“Explore Now”

The hero may use:

- subtle 3D depth
- parallax
- restrained material animation

Do not use auto-playing carousels.

---

# 27. CHATROOM

Chatrooms are curated interest communities.

This screen should feel intimate.

Not like:

- Discord
- Slack
- WhatsApp
- Telegram

Primary list structure:

YOUR CONCIERGE

TRAVEL DESK

LIFESTYLE DESK

EVENTS DESK

SHOP DESK

FAMILY OFFICE

or member-specific curated interest rooms.

Each row contains:

- avatar
- room name
- short preview
- relative time
- unread state

Use generous vertical spacing.

The interface should feel quiet even when multiple conversations exist.

---

# 28. CHATROOM DETAIL

Header:

- room identity
- weekly theme
- member context
- discreet actions

Messages support:

- text
- images
- voice notes
- read receipts

The chat composer should feel integrated.

Avoid a large generic white text field.

Use a premium floating composer surface.

The weekly theme can appear as an editorial card near the top.

---

# 29. EXPLORE

Explore is the curated discovery environment.

Core promise:

“Curated experiences.
Created for you.”

Structure:

SEARCH

↓

EDITORIAL HERO

↓

CATEGORIES

↓

FEATURED EXPERIENCES

↓

NEAR YOU

↓

PERSONAL CURATION

Categories:

- Travel
- Dining
- Events
- Wellness
- Art
- Culture

Cards should use exceptional photography.

Do not overload images with text.

Use restrained overlays.

---

# 30. EXPLORE EXPERIENCE CARD

Each card contains:

- immersive image
- experience title
- location
- short descriptor
- distance when relevant
- contextual action

Paid member action:

SEND TO YOUR CONCIERGE

Unpaid user action:

WANT TO BOOK?

The interface must visually distinguish personalized recommendations without using aggressive “Recommended for You” labels everywhere.

Subtle signals are preferable.

Example:

“Selected for you”

---

# 31. PROFILE

The Profile screen should feel like the member’s private account space.

Top area:

- member portrait
- member name
- membership tier
- membership since date
- membership details action

Sections:

BUCKET LIST

MY TASTES

TICKET IMPACT REPORT

WALLET & TRANSACTIONS

MY INTERESTS

PERSONAL INFORMATION

SETTINGS

Use large, calm list rows.

Do not create a settings screen full of tiny dividers.

Group related items into premium surfaces.

---

# 32. BUCKET LIST

The Bucket List should feel aspirational.

Not like a productivity checklist.

Each item may contain:

- title
- category
- progress
- optional imagery
- completion story

Incomplete items should feel alive.

Completed items should become memories.

Do not use conventional checkbox-heavy task UI.

Possible interaction:

Tap an item to reveal:

- story
- progress
- concierge involvement
- completion images

---

# 33. TASTES

Tastes is the member preference system.

The UI should feel conversational.

15 questions.

One question per screen or carefully grouped micro-sections.

Use:

- large typography
- generous spacing
- beautiful choice cards
- soft transitions
- autosave

Display progress quietly.

Example:

05 / 15

Do not use:

“33% Complete”

The final free-form section should feel like writing a private note to the concierge.

---

# 34. SIDE MENU

The menu is accessed through the hamburger icon.

The menu should open as:

- a full-height premium overlay
- a side sheet
- or a dimensional layer over the current destination

Menu contents:

My Requests

My Interests

Bucket List

Tastes

Wallet & Transactions

Newsroom

Membership Benefits

Refer a Friend

FAQs

Privacy Policy

Terms & Conditions

Settings

Customer Service

Log Out

Use section spacing.

Do not show all items as an undifferentiated list.

The user should be able to scan the menu instantly.

---

# 35. NOTIFICATIONS

Notifications are curated.

The interface should communicate that philosophy.

Use:

- grouped notifications
- clear deep-link context
- minimal unread indicators
- excellent empty states

Never use aggressive badges.

Example empty state:

“Everything is handled.”

with a subtle mascot appearance.

---

# 36. LIGHT THEME PRINCIPLES

The light theme must be independently beautiful.

Do not simply invert colours.

Use:

- warm backgrounds
- layered cream surfaces
- soft material depth
- restrained pastel accents
- natural shadows
- lower visual contrast where appropriate

The dark theme communicates:

PRIVATE NIGHT-TIME LUXURY.

The light theme communicates:

EFFORTLESS DAYTIME HOSPITALITY.

Both must feel equally premium.

---

# 37. COMPONENT LIBRARY

Build reusable components before building complete screens.

Required foundational components:

AppShell

ScreenContainer

TopNavigation

BottomNavigation

SideMenu

Typography

Button

IconButton

Card

PremiumCard

MetallicCard

GlassSurface

SectionHeader

ListRow

RequestCard

StatusChip

WalletCard

ImpactCard

ExperienceCard

ProductCard

ProfileRow

Avatar

SearchField

SegmentedControl

BottomSheet

Modal

Toast

NotificationBadge

EmptyState

LoadingState

Skeleton

MascotContainer

ThemeSwitcher

All components must support both themes.

Do not duplicate components for dark and light mode.

---

# 38. BUTTON SYSTEM

## PRIMARY BUTTON

Used for the most important action.

Dark:

gold material or gold-highlighted dark surface.

Light:

warm champagne surface.

## SECONDARY BUTTON

Low emphasis.

Surface-based.

## TERTIARY BUTTON

Text or icon only.

## DESTRUCTIVE BUTTON

Use muted red.

Never use bright red unless immediate danger exists.

Buttons should have:

- pressed state
- loading state
- disabled state
- haptic feedback where appropriate

---

# 39. INPUT SYSTEM

Inputs must feel calm.

Use:

- large touch targets
- clear labels
- restrained borders
- excellent focus states
- inline validation

Avoid generic rectangular forms.

Search fields should use subtle elevated surfaces.

---

# 40. MOTION SYSTEM

Motion is essential.

But motion must remain quiet.

Animation principles:

- natural
- soft
- responsive
- deliberate
- never decorative without purpose

Recommended durations:

Micro interaction:

120–180ms

Standard transition:

220–320ms

Large screen transition:

350–500ms

Mascot / atmospheric animation:

600–1200ms

Use spring physics selectively.

Avoid:

- excessive bouncing
- dramatic scaling
- constant animation
- excessive particle effects

---

# 41. SCREEN TRANSITIONS

Primary tab navigation:

soft horizontal movement.

Detail screen:

subtle depth transition.

Bottom sheet:

spring-based vertical reveal.

Side menu:

layered lateral reveal.

Modal:

fade + slight scale.

Theme change:

crossfade material tokens where technically practical.

---

# 42. MICRO-INTERACTIONS

Examples:

Wallet card:

subtle metallic highlight follows initial entrance.

Request completion:

small gold pulse.

Navigation selection:

icon receives soft dimensional movement.

Bucket item completion:

gentle transformation into memory state.

Successful action:

mascot may briefly acknowledge completion.

Pull to refresh:

custom Indulge logo animation.

Loading:

use premium skeletons.

Do not use generic spinning loaders unless unavoidable.

---

# 43. HAPTICS

Use haptic feedback selectively.

Appropriate moments:

- primary navigation
- successful action
- segmented control
- important confirmation
- bucket list completion

Avoid haptic feedback for every tap.

---

# 44. EMPTY STATES

Every empty state must be intentionally designed.

Examples:

NO ACTIVE REQUESTS

“Everything is handled.”

NO NOTIFICATIONS

“You’re all caught up.”

NO BUCKET LIST ITEMS

“What would you love to experience?”

NO CHATROOM MESSAGES

“The conversation is waiting.”

Empty states may use the mascot selectively.

---

# 45. LOADING STATES

Never display blank screens.

Use:

- skeleton surfaces
- progressive content loading
- cached dashboard data
- image placeholders

The application should feel instant.

The dashboard must prioritize cached information and refresh silently.

---

# 46. ACCESSIBILITY

Luxury must not reduce usability.

Requirements:

- WCAG-compliant text contrast
- minimum touch targets
- dynamic text support where practical
- screen reader labels
- reduced-motion support
- colour-independent status indicators

Gold text must be checked carefully for contrast.

Do not sacrifice accessibility for aesthetics.

---

# 47. RESPONSIVE BEHAVIOUR

Design mobile-first.

Support common phone sizes.

Primary reference width:

390px

Also test:

360px

375px

393px

414px

430px

Do not hardcode layouts for a single device.

Respect:

- safe areas
- notches
- dynamic islands
- bottom gesture areas

---

# 48. IMAGE SYSTEM

Images should feel editorial.

Use:

- premium travel photography
- luxury objects
- architecture
- food
- art
- experiences

Maintain consistent image treatment.

Avoid:

- generic stock photography
- overly saturated images
- excessive text overlays

Image cards should use controlled cropping.

---

# 49. ICONOGRAPHY

Use one consistent icon family.

Characteristics:

- thin
- precise
- contemporary
- slightly geometric

Active icons may receive:

- gold colour
- subtle material depth

Do not mix multiple unrelated icon styles.

---

# 50. DEVELOPMENT RULES

Before implementing complete screens:

1. Analyze the existing project.
2. Identify the framework and architecture.
3. Create the design-token system.
4. Create theme architecture.
5. Create typography primitives.
6. Create spacing primitives.
7. Create foundational components.
8. Build navigation.
9. Build the application shell.
10. Build My Concierge first.
11. Build remaining primary destinations.
12. Build secondary pages.
13. Add animation.
14. Perform visual consistency review.
15. Perform accessibility review.
16. Perform responsive testing.

Do not begin by creating isolated screens with duplicated styles.

---

# 51. CODE QUALITY REQUIREMENTS

The implementation must be:

- modular
- reusable
- typed where supported
- maintainable
- production-grade
- performant

Avoid:

- giant components
- duplicated styling
- magic numbers
- hardcoded colours
- hardcoded spacing
- inline design logic
- unnecessary dependencies

Separate:

- data
- presentation
- navigation
- state
- theme
- animation logic

---

# 52. VISUAL QUALITY CONTROL

Before considering any screen complete, verify:

SPACING

Is every margin intentional?

TYPOGRAPHY

Is hierarchy immediately understandable?

COLOUR

Is gold being overused?

DEPTH

Are surfaces distinguishable without excessive shadows?

CONTENT

Is unnecessary information visible?

INTERACTION

Are primary actions obvious?

MOTION

Does animation improve understanding?

THEME

Does the screen work beautifully in both themes?

CONSISTENCY

Does the screen belong to the same product as every other screen?

EMOTION

Does the experience feel calm?

---

# 53. THE MOST IMPORTANT DESIGN RULE

DO NOT CONFUSE LUXURY WITH DECORATION.

The application should not attempt to prove its value through:

- excessive gold
- excessive animation
- excessive 3D objects
- excessive gradients
- excessive glassmorphism
- excessive text
- excessive features on one screen

The strongest luxury experience comes from:

- precision
- restraint
- confidence
- exceptional typography
- excellent spacing
- beautiful transitions
- thoughtful personalization

Every screen should contain one primary visual moment.

Everything else supports it.

---

# 54. FINAL PRODUCT STANDARD

The finished application should feel like the intersection of:

Swiss editorial precision

-

Private hospitality

-

Modern product design

-

Subtle material depth

-

Human warmth

-

Exceptional concierge service

The member should open the application and immediately feel:

“I don’t need to manage everything here.”

“They already know me.”

“Everything important is under control.”

“This was made for people like me.”

That emotional response is the final measure of design quality.

Build the application accordingly.

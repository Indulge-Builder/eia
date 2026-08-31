// Dossier card for app-channel product enquiries (migration 0180).
//
// The reason this card exists rather than letting the products land in
// DynamicFormResponses: form_data renders as a flat key/value list, so a product
// link showed as raw URL text and only the FIRST enquiry was ever captured. A shop
// member routinely enquires about several pieces, and the agent needs to see all of
// them before dialling.
//
// Everything here renders from the stored snapshot. The shop hard-deletes products,
// so re-fetching its URL would blank the card for exactly the leads an agent is
// chasing. A dead link is honest; an empty card is not.
//
// Display-only (A-06), server-component-safe — no client JS at all.

import { Package, ExternalLink } from 'lucide-react';
import { CardHeader } from '@/components/leads/CardHeader';
import { getShopEnquiryTypeLabel } from '@/lib/constants/lead-sources';
import { formatCurrency } from '@/lib/utils/numbers';
import { formatDate } from '@/lib/utils/dates';
import type { LeadProductEnquiry } from '@/lib/types/database';

type Props = {
  enquiries: LeadProductEnquiry[];
};

/**
 * formatCurrency covers INR/USD/EUR. The shop also sells into AE and GB, whose
 * codes it does not handle — so those fall back to "AED 12,345" rather than being
 * silently rendered with the wrong symbol. Widening the shared formatter for
 * currencies that are not yet in any payload would be inventing a value.
 */
function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null;
  const code = (currency ?? 'INR').toUpperCase();
  if (code === 'INR' || code === 'USD' || code === 'EUR') {
    return formatCurrency(amount, code);
  }
  return `${code} ${new Intl.NumberFormat('en-IN').format(amount)}`;
}

/** Small static pill. Matches the CategoryTag recipe; that one is intelligence-scoped
 *  and importing it here would cross feature folders (Rule 04). */
function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'quiet' }) {
  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        padding:       '2px 8px',
        borderRadius:  'var(--radius-full)',
        background:    tone === 'accent' ? 'var(--theme-accent-surface)' : 'var(--theme-paper-subtle)',
        color:         tone === 'accent' ? 'var(--theme-accent)' : 'var(--theme-text-tertiary)',
        fontFamily:    'var(--font-sans)',
        fontSize:      'var(--text-2xs)',
        fontWeight:    'var(--weight-medium)',
        letterSpacing: 'var(--tracking-wide)',
        whiteSpace:    'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function ProductEnquiryCard({ enquiries }: Props) {
  if (enquiries.length === 0) return null;

  // Member context is a property of the person, not of any one enquiry — show it
  // once in the header from the most recent row rather than repeating it per item.
  const memberRole = enquiries.find((e) => e.member_role)?.member_role ?? null;

  return (
    <div
      style={{
        // The card owns its own top margin, matching RevivalDossierAction — the
        // conditional cards in this stack are each mounted with a null fallback, so
        // no wrapper is there to space them.
        marginTop:    'var(--space-6)',
        background:   'var(--theme-paper)',
        border:       '1px solid var(--theme-paper-border)',
        borderRadius: 'var(--neu-radius-card)',
        boxShadow:    'var(--shadow-1)',
        overflow:     'hidden',
      }}
    >
      <CardHeader
        icon={Package}
        label="Product Enquiries"
        right={
          <span
            style={{
              marginLeft: 'auto',
              display:    'flex',
              alignItems: 'center',
              gap:        'var(--space-2)',
              fontSize:   'var(--text-xs)',
              color:      'var(--neu-header-ink)',
            }}
          >
            {memberRole && <Pill label={memberRole} tone="quiet" />}
            {enquiries.length} item{enquiries.length !== 1 ? 's' : ''}
          </span>
        }
      />

      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {enquiries.map((e, idx) => (
          <EnquiryRow key={e.id} enquiry={e} isLast={idx === enquiries.length - 1} />
        ))}
      </div>
    </div>
  );
}

function EnquiryRow({ enquiry: e, isLast }: { enquiry: LeadProductEnquiry; isLast: boolean }) {
  const price = formatPrice(e.price, e.currency);
  const meta = [e.brand, price].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        display:       'flex',
        gap:           'var(--space-4)',
        paddingBottom: isLast ? 0 : 'var(--space-4)',
        borderBottom:  isLast ? 'none' : '1px solid var(--theme-paper-border)',
      }}
    >
      {/* Thumbnail. Plain <img>: the source is a third-party CloudFront host that
          would need next.config remotePatterns, and the url can 404 once the shop
          deletes the listing. The placeholder below is what a deleted product
          looks like, which is information the agent wants. */}
      <div
        style={{
          width:         '56px',
          height:        '56px',
          flexShrink:    0,
          borderRadius:  'var(--radius-md)',
          overflow:      'hidden',
          background:    'var(--theme-paper-subtle)',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
        }}
      >
        {e.product_image_url ? (
          // Plain <img> is the house convention for third-party/short-lived image
          // urls (@next/next/no-img-element is off in eslint.config.mjs for exactly
          // this reason — see the WhatsApp media thumbnails note there).
          <img
            src={e.product_image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Package
            style={{
              width: '1rem', height: '1rem',
              color: 'var(--theme-text-tertiary)', strokeWidth: 1.5,
            }}
          />
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {/* Name + enquiry type */}
        <div
          style={{
            display:        'flex',
            alignItems:     'baseline',
            justifyContent: 'space-between',
            gap:            'var(--space-3)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize:   'var(--text-base)',
              fontWeight: 'var(--weight-medium)',
              color:      'var(--theme-text-primary)',
              lineHeight: 1.35,
              margin:     0,
              minWidth:   0,
              overflow:   'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {e.product_name}
          </p>
          <span style={{ flexShrink: 0 }}>
            <Pill label={getShopEnquiryTypeLabel(e.enquiry_type)} />
          </span>
        </div>

        {/* Brand · price, plus the two availability flags that change how an agent opens the call */}
        {(meta || e.sold_out || e.price_on_request) && (
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        'var(--space-2)',
              flexWrap:   'wrap',
              fontFamily: 'var(--font-sans)',
              fontSize:   'var(--text-xs)',
              color:      'var(--theme-text-secondary)',
            }}
          >
            {meta && <span>{meta}</span>}
            {e.price_on_request && <Pill label="Price on request" tone="quiet" />}
            {e.sold_out && <Pill label="Sold out" tone="quiet" />}
          </div>
        )}

        {/* The member's own words, when the shop's note field is populated */}
        {e.note && (
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle:  'italic',
              fontSize:   'var(--text-xs)',
              color:      'var(--theme-text-tertiary)',
              lineHeight: 1.5,
              margin:     0,
            }}
          >
            “{e.note}”
          </p>
        )}

        {/* When they asked, and the way out to the listing */}
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--space-3)',
            fontFamily: 'var(--font-sans)',
            fontSize:   'var(--text-2xs)',
            color:      'var(--theme-text-tertiary)',
            letterSpacing: 'var(--tracking-wide)',
          }}
        >
          <span>{formatDate(e.enquired_at, 'dd MMM yyyy, h:mm a')}</span>
          {e.product_url && (
            <a
              href={e.product_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        '4px',
                color:      'var(--neu-accent-deep)',
                textDecoration: 'none',
              }}
            >
              View listing
              <ExternalLink style={{ width: '0.625rem', height: '0.625rem', strokeWidth: 1.5 }} />
            </a>
          )}
          {e.admin_member_url && (
            <a
              href={e.admin_member_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap:        '4px',
                color:      'var(--neu-accent-deep)',
                textDecoration: 'none',
              }}
            >
              Member
              <ExternalLink style={{ width: '0.625rem', height: '0.625rem', strokeWidth: 1.5 }} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

import { getLeadProductEnquiries } from '@/lib/services/lead-enquiries-service';
import { ProductEnquiryCard } from '@/components/leads/ProductEnquiryCard';

/**
 * Async server component — direct child of <Suspense> on the dossier page.
 * The only dossier call site for getLeadProductEnquiries.
 *
 * Renders nothing for a lead with no app-channel enquiries, which is every Meta,
 * Google, website and WhatsApp lead. The card is additive to the dossier, never a
 * hole in it — that is why there is no empty state here.
 */
export async function ProductEnquiryCardAsync({ leadId }: { leadId: string }) {
  const enquiries = await getLeadProductEnquiries(leadId);
  return <ProductEnquiryCard enquiries={enquiries} />;
}

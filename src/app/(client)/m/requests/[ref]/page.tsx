import { RequestDetailScreen } from '@/components/mobile/screens/RequestDetailScreen';

export const metadata = { title: 'Request · Serene' };

export default async function MobileRequestDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return <RequestDetailScreen reference={ref} />;
}

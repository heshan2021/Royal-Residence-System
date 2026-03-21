// Main app page that imports the Receptionist Module
// This follows the feature-driven architecture where each module is self-contained

// Force dynamic rendering - disable Vercel static generation and caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import ReceptionistDashboard from '../src/modules/receptionist/page';

export default function Home() {
  return <ReceptionistDashboard />;
}

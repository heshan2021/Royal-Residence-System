// Main app page that imports the Receptionist Module
// This follows the feature-driven architecture where each module is self-contained

import ReceptionistDashboard from '../src/modules/receptionist/page';

export default function Home() {
  return <ReceptionistDashboard />;
}

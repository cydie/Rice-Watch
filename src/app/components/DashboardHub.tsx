import { TabbedPage } from './TabbedPage';
import { Dashboard } from './Dashboard';
import { Analytics } from './Analytics';
import { useAuth } from '../context/AuthContext';

export function DashboardHub() {
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician';

  return (
    <TabbedPage
      title={isTechnician ? 'Barangay Field Briefing' : 'Operations Briefing'}
      tabs={[
        { label: 'Overview', render: () => <Dashboard embedded /> },
        { label: 'Analytics', render: () => <Analytics embedded /> },
      ]}
    />
  );
}

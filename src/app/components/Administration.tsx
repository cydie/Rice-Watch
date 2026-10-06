import { TabbedPage } from './TabbedPage';
import { UserManagement } from './UserManagement';
import { MunicipalityManagement } from './MunicipalityManagement';

export function Administration() {
  return (
    <TabbedPage
      title="Administration"
      subtitle="Manage user accounts, barangays and sitios - Rizal, Palawan"
      tabs={[
        { label: 'Users', render: () => <UserManagement embedded /> },
        { label: 'Barangays & Sitios', render: () => <MunicipalityManagement embedded /> },
      ]}
    />
  );
}

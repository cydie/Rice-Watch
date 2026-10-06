import { TabbedPage } from './TabbedPage';
import { PlantingReports } from './PlantingReports';
import { HarvestReports } from './HarvestReports';
import { StandingCrop } from './StandingCrop';
import { ReportPapers } from './ReportPapers';

export function CropReports() {
  return (
    <TabbedPage
      title="Crop Reports"
      subtitle="Planting, harvest and standing crop records, plus barangay paper uploads"
      tabs={[
        { label: 'Planting', render: () => <PlantingReports embedded /> },
        { label: 'Harvest', render: () => <HarvestReports embedded /> },
        { label: 'Standing Crop', render: () => <StandingCrop embedded /> },
        { label: 'Paper Reports', render: () => <ReportPapers embedded /> },
      ]}
    />
  );
}

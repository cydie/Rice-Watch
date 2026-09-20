import {
  buildTechnicianTemplates,
  TEMPLATES_DIR,
} from '../src/lib/paperReports.js';
import { buildAllFilledTemplates } from '../src/lib/officialTargets.js';

buildTechnicianTemplates();
console.log('Blank templates written to', TEMPLATES_DIR);

const filled = buildAllFilledTemplates();
console.log(
  `Filled official-aligned masterlists for ${filled.barangays.length} barangays → ${filled.dir}`
);

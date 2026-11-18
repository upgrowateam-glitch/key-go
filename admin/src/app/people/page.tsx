'use client';

import { SectionPage } from '../../components/portal/SectionPage';
import AttendanceTab from '../../features/people/AttendanceTab';
import DriverAssignmentsTab from '../../features/people/DriverAssignmentsTab';
import DriversTab from '../../features/people/DriversTab';
import PayrollTab from '../../features/people/PayrollTab';
import StaffDirectoryTab from '../../features/people/StaffDirectoryTab';

export default function PeoplePage() {
  return (
    <SectionPage
      section="people"
      pendingIntegration="Sample data. Changes stay in this browser and reset on reload."
      tabs={{
        'staff-directory': StaffDirectoryTab,
        drivers: DriversTab,
        'driver-assignments': DriverAssignmentsTab,
        attendance: AttendanceTab,
        payroll: PayrollTab,
      }}
    />
  );
}

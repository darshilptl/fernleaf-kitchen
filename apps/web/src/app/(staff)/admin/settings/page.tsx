import { redirect } from 'next/navigation';
import { SettingsForm } from '@/features/settings/settings-form';
import { loadStaffSession } from '@/lib/staff-session';

/**
 * Platform settings page: cut-off, at-risk window and the
 * kitchen calendar. Guarded by `settings.read` (UX only).
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const session = await loadStaffSession();
  if (session === null) {
    redirect('/login');
  }
  if (!session.permissions.includes('settings.read')) {
    redirect(session.landingPath);
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="heading-sm">Settings</h1>
        <p className="description-sm">Kitchen calendar, cut-off and platform values.</p>
      </div>
      <SettingsForm />
    </div>
  );
}

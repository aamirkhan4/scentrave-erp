import { SettingsScreen } from '@/components/settings/SettingsScreen';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <SettingsScreen />
    </div>
  );
}

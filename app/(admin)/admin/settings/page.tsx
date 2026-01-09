export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Settings
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Site Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Site configuration options will be available here
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Email Templates
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage email templates for notifications
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Integration Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure payment providers, email, and other integrations
          </p>
        </div>
      </div>
    </div>
  );
}

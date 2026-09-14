"use client";

export default function AuditPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center py-8">
          <p className="text-4xl mb-4">📝</p>
          <h2 className="text-lg font-semibold mb-2">
            Audit logs endpoint — available via API
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Audit logs are stored on the server, but there is no
            <code className="mx-1 px-1 py-0.5 bg-gray-100 rounded text-xs">
              GET /audit/admin/all
            </code>
            endpoint implemented yet. This page will display audit logs once the endpoint is
            available.
          </p>
        </div>
      </div>
    </div>
  );
}
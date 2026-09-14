"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type Settings = Record<string, string | number | boolean | null>;

interface SocialEntry {
  url: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [telegramUrl, setTelegramUrl] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [savingSocial, setSavingSocial] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiGet<Settings | { data?: Settings; settings?: Settings }>(
          "/settings"
        );
        const flat = (Array.isArray(data) ? {} : data) as Settings;
        setSettings(flat);
        const initial: Record<string, string> = {};
        for (const [k, v] of Object.entries(flat)) {
          initial[k] = v == null ? "" : String(v);
        }
        setEdited(initial);

        const social =
          flat.social && typeof flat.social === "object"
            ? (flat.social as Record<string, SocialEntry>)
            : {};
        setYoutubeUrl(social.youtube?.url ?? "");
        setYoutubeEnabled(social.youtube?.enabled ?? true);
        setTelegramUrl(social.telegram?.url ?? "");
        setTelegramEnabled(social.telegram?.enabled ?? true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveSetting = async (e: React.FormEvent, key: string) => {
    e.preventDefault();
    setSavingKey(key);
    setError("");
    setFeedback("");
    try {
      const value = edited[key];
      const parsed: string | number | boolean =
        value === "true"
          ? true
          : value === "false"
          ? false
          : value !== "" && !isNaN(Number(value))
          ? Number(value)
          : value;
      await apiPatch("/settings", { [key]: parsed });
      setSettings((prev) => ({ ...prev, [key]: parsed }));
      setFeedback(`Saved "${key}"`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSavingKey("");
    }
  };

  const saveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSocial(true);
    setError("");
    setFeedback("");
    try {
      await apiPatch("/settings", {
        social: {
          youtube: { url: youtubeUrl, enabled: youtubeEnabled },
          telegram: { url: telegramUrl, enabled: telegramEnabled },
        },
      });
      setFeedback("Social links saved. Only enabled links with valid URLs are shown.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save social links");
    } finally {
      setSavingSocial(false);
    }
  };

  const entries = Object.entries(settings).filter(([k]) => k !== "social");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {feedback && (
        <div className="mb-4 px-4 py-3 rounded text-sm bg-green-50 text-green-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded text-sm bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-500">Loading settings...</div>}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-1">Social Links</h2>
            <p className="text-sm text-gray-500 mb-4">
              YouTube and Telegram links shown to users. Only enabled links with valid
              http/https URLs are displayed on the user panel.
            </p>
            <form onSubmit={saveSocial} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://youtube.com/@yourchannel"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={youtubeEnabled}
                    onChange={(e) => setYoutubeEnabled(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  Enabled
                </label>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <input
                  type="url"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://t.me/yourchannel"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  Enabled
                </label>
              </div>
              <button
                type="submit"
                disabled={savingSocial}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSocial ? "Saving..." : "Save Social Links"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {entries.length === 0 && (
              <div className="p-8 text-center text-gray-400">No settings found</div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-600">
                  <th className="px-4 py-3 w-1/3">Key</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, value], i) => (
                  <tr
                    key={key}
                    className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{key}</td>
                    <td className="px-4 py-3">
                      <form onSubmit={(e) => saveSetting(e, key)} className="flex gap-2">
                        <input
                          type="text"
                          value={edited[key] ?? ""}
                          onChange={(e) =>
                            setEdited((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={savingKey === key}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingKey === key ? "..." : "Save"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
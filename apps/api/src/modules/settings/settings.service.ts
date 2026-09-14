import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { isValidLink } from "@smm/utils";

export interface SocialLinkDef {
  key: string;
  label: string;
  url: string;
  enabled: boolean;
}

export const SOCIAL_LINK_KEYS = ["youtube", "telegram"] as const;

@Injectable()
export class SettingsService {
  constructor(@InjectModel("Settings") private readonly settingsModel: Model<any>) {}

  async get(key: string): Promise<any> {
    const doc = (await this.settingsModel.findOne({ key }).lean()) as any;
    return doc?.value ?? null;
  }

  async getMany(): Promise<Record<string, unknown>> {
    const docs = (await this.settingsModel.find().lean()) as any[];
    const out: Record<string, unknown> = {};
    for (const d of docs) out[d.key] = d.value;
    return out;
  }

  async set(key: string, value: unknown, updatedBy?: string) {
    return this.settingsModel.findOneAndUpdate(
      { key },
      { $set: { value, updatedBy } },
      { new: true, upsert: true },
    );
  }

  async updateMany(values: Record<string, unknown>, updatedBy?: string) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      let next = value;
      if (key === "social") next = this.validateSocial(value);
      await this.set(key, next, updatedBy);
      result[key] = next;
    }
    return { ok: true, updated: Object.keys(values).length, values: result };
  }

  /** Reads enabled+valid social links as a public whitelist (never full config). */
  async getPublicSocial(): Promise<SocialLinkDef[]> {
    const raw = (await this.get("social")) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return [];
    const out: SocialLinkDef[] = [];
    for (const key of SOCIAL_LINK_KEYS) {
      const entry = (raw as Record<string, Record<string, unknown>>)[key];
      if (!entry || typeof entry !== "object") continue;
      const url = String(entry.url ?? "").trim();
      const enabled = entry.enabled !== false;
      if (enabled && isValidLink(url)) {
        out.push({ key, label: key === "youtube" ? "YouTube" : "Telegram", url, enabled });
      }
    }
    return out;
  }

  private validateSocial(value: unknown): Record<string, unknown> {
    const inValue: Record<string, unknown> =
      value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {};
    for (const key of SOCIAL_LINK_KEYS) {
      const entry: Record<string, unknown> =
        inValue[key] && typeof inValue[key] === "object" ? (inValue[key] as Record<string, unknown>) : {};
      const url = String(entry.url ?? "").trim();
      const enabled = entry.enabled !== false;
      if (url && !isValidLink(url)) {
        throw new BadRequestException({ error: "INVALID_SOCIAL_LINK", message: `${key} URL must start with http:// or https://` });
      }
      out[key] = { url, enabled };
    }
    return out;
  }
}
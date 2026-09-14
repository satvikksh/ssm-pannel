import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { RequirePermissions, Public } from "../../common/decorators";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("public")
  async publicSettings() {
    const all = await this.settingsService.getMany();
    const allowedKeys = ["general", "payments", "appearance", "orders", "announcements"];
    const out: Record<string, unknown> = {};
    for (const k of allowedKeys) if (all[k]) out[k] = all[k];
    out.social = await this.settingsService.getPublicSocial();
    return { success: true, data: out };
  }

  /** Public whitelist of enabled+valid social links (YouTube/Telegram). */
  @Public()
  @Get("social")
  async social() {
    const data = await this.settingsService.getPublicSocial();
    return { success: true, data };
  }

  @Get()
  @RequirePermissions("settings.manage")
  async all() {
    const all = await this.settingsService.getMany();
    return { success: true, data: all };
  }

  @Patch()
  @RequirePermissions("settings.manage")
  async edit(@Body() body: Record<string, unknown>) {
    const result = await this.settingsService.updateMany(body);
    return { success: true, data: result };
  }

  @Get(":key")
  @RequirePermissions("settings.manage")
  async one(@Param("key") key: string) {
    return { success: true, data: await this.settingsService.get(key) };
  }
}
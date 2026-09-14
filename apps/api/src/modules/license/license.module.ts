import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { licenseStateSchema } from "@smm/database";
import { LicenseService } from "@smm/domain";
import { LicenseController } from "./license.controller";
import { LicenseGuard } from "./guards/license.guard";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: "LicenseState", schema: licenseStateSchema }])],
  controllers: [LicenseController],
  providers: [
    LicenseService,
    LicenseGuard,
    { provide: APP_GUARD, useClass: LicenseGuard },
  ],
  exports: [LicenseService, LicenseGuard],
})
export class LicenseModule {}
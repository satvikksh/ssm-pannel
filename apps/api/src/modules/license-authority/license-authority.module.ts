import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  LICENSE_DB_NAME,
  licenseSchema,
  licenseProductSchema,
  licenseClientSchema,
  licenseInstallationSchema,
  licenseActivationSchema,
  licenseValidationSchema,
  licenseEventSchema,
  licenseAuditLogSchema,
} from "@smm/database";
import { LicenseAuthorityService } from "./license-authority.service";
import { LicenseAuthorityController, LicenseAuthorityClientController } from "./license-authority.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      connectionName: "LicenseConnection",
      useFactory: () => ({
        uri: process.env.MONGODB_URI ?? "",
        dbName: LICENSE_DB_NAME,
        maxPoolSize: 5,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    MongooseModule.forFeature(
      [
        { name: "License", schema: licenseSchema },
        { name: "LicenseProduct", schema: licenseProductSchema },
        { name: "LicenseClient", schema: licenseClientSchema },
        { name: "LicenseInstallation", schema: licenseInstallationSchema },
        { name: "LicenseActivation", schema: licenseActivationSchema },
        { name: "LicenseValidation", schema: licenseValidationSchema },
        { name: "LicenseEvent", schema: licenseEventSchema },
        { name: "LicenseAuditLog", schema: licenseAuditLogSchema },
      ],
      "LicenseConnection",
    ),
  ],
  controllers: [LicenseAuthorityController, LicenseAuthorityClientController],
  providers: [LicenseAuthorityService],
  exports: [LicenseAuthorityService],
})
export class LicenseAuthorityModule {}

export class LicenseAuthorityModuleStatic {}
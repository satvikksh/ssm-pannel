import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { providerSchema, providerServiceSchema } from "@smm/database";
import { ProvidersService, ProviderFactory } from "@smm/domain";
import { ProvidersController } from "./providers.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Provider", schema: providerSchema },
      { name: "ProviderService", schema: providerServiceSchema },
    ]),
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService, ProviderFactory],
  exports: [ProvidersService, ProviderFactory],
})
export class ProvidersModule {}
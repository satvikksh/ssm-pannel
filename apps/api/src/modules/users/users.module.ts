import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { userSchema, userGroupSchema } from "@smm/database";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "User", schema: userSchema },
      { name: "UserGroup", schema: userGroupSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
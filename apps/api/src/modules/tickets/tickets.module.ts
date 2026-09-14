import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ticketSchema, ticketMessageSchema } from "@smm/database";
import { TicketsService } from "./tickets.service";
import { TicketsController } from "./tickets.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Ticket", schema: ticketSchema },
      { name: "TicketMessage", schema: ticketMessageSchema },
    ]),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
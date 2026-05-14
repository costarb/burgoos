import { Module } from "@nestjs/common";
import { AuthModule } from "../platform/auth/auth.module";
import { DatabaseModule } from "../platform/database/database.module";
import { DailySummaryController } from "./daily-summary.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [DailySummaryController],
  providers: [ReportsService]
})
export class ManagementModule {}

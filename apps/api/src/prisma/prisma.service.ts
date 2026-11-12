import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@ems/db";
import { ENV, type Env } from "../config/env";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ datasourceUrl: env.DATABASE_URL });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

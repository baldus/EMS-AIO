import { Global, Module } from "@nestjs/common";
import { ENV, parseEnv } from "./env";

/** Validated environment, available to every module (including async module factories). */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class ConfigModule {}

import { Controller, Get, HttpStatus, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators";
import { ProblemException } from "../common/problem";
import { PrismaService } from "../prisma/prisma.service";

export class HealthDto {
  @ApiProperty({ enum: ["ok"] }) status: "ok";
}

@ApiTags("health")
@SkipThrottle()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  @Public()
  @ApiOperation({ operationId: "liveness", summary: "Process is up" })
  @ApiOkResponse({ type: HealthDto })
  live(): HealthDto {
    return { status: "ok" };
  }

  @Get("ready")
  @Public()
  @ApiOperation({ operationId: "readiness", summary: "Dependencies reachable" })
  @ApiOkResponse({ type: HealthDto })
  async ready(): Promise<HealthDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ProblemException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "NOT_READY",
        "Database unavailable.",
      );
    }
    return { status: "ok" };
  }
}

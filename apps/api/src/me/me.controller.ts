import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { effectivePermissionKeys } from "@ems/domain";
import { AuthenticatedOnly, CurrentPrincipal } from "../auth/decorators";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { PrismaService } from "../prisma/prisma.service";

export class RoleGrantDto {
  @ApiProperty() roleKey: string;
  @ApiProperty({ enum: ["global", "organization", "project"] }) scopeType: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) organizationId: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) projectId: string | null;
  @ApiProperty() mfaRequired: boolean;
}

export class MeDto {
  @ApiProperty({ format: "uuid" }) userId: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ enum: ["internal", "customer", "service"] }) userType: string;
  @ApiProperty({ format: "uuid" }) homeOrganizationId: string;
  @ApiProperty() homeOrganizationName: string;
  @ApiProperty({ description: "Whether the current session satisfied MFA" }) mfaSatisfied: boolean;
  @ApiProperty({ type: [String], description: "Permissions effective in at least one scope" })
  permissions: string[];
  @ApiProperty({ type: [RoleGrantDto] }) grants: RoleGrantDto[];
}

@ApiTags("me")
@ApiBearerAuth()
@Controller({ path: "me", version: "1" })
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @AuthenticatedOnly()
  @ApiOperation({
    operationId: "getMe",
    summary: "The authenticated user's identity and effective access",
  })
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentPrincipal() p: AuthenticatedPrincipal): Promise<MeDto> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: p.homeOrganizationId },
      select: { name: true },
    });
    return {
      userId: p.userId,
      email: p.email,
      displayName: p.displayName,
      userType: p.userType,
      homeOrganizationId: p.homeOrganizationId,
      homeOrganizationName: org.name,
      mfaSatisfied: p.mfaSatisfied,
      permissions: effectivePermissionKeys(p),
      grants: p.grants.map((g) => ({
        roleKey: g.roleKey,
        scopeType: g.scope.type,
        organizationId: g.scope.type === "global" ? null : g.scope.organizationId,
        projectId: g.scope.type === "project" ? g.scope.projectId : null,
        mfaRequired: g.mfaRequired,
      })),
    };
  }
}

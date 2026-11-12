import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { PERMISSIONS } from "@ems/domain";
import type { Response } from "express";
import { CurrentPrincipal, RequirePermission } from "../auth/decorators";
import type { AuthenticatedPrincipal } from "../auth/principal.service";
import { ProblemDto } from "../common/dto";
import { ReqMeta, type RequestMeta } from "../common/request-meta";
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  OrganizationDto,
  OrganizationPageDto,
  UpdateOrganizationDto,
  VersionDto,
} from "./organization.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organizations")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ProblemDto })
@Controller({ path: "organizations", version: "1" })
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ORGANIZATION_READ)
  @ApiOperation({
    operationId: "listOrganizations",
    summary: "List organizations visible to the caller",
  })
  @ApiOkResponse({ type: OrganizationPageDto })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: ListOrganizationsQueryDto,
  ) {
    return this.organizations.list(principal, query);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.ORGANIZATION_READ)
  @ApiOperation({ operationId: "getOrganization", summary: "Get an organization" })
  @ApiOkResponse({ type: OrganizationDto })
  @ApiNotFoundResponse({ type: ProblemDto })
  get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.organizations.get(principal, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ORGANIZATION_CREATE)
  @ApiOperation({ operationId: "createOrganization", summary: "Create an organization" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: false,
    description:
      "Retries with the same key return the original result instead of creating duplicates.",
  })
  @ApiCreatedResponse({ type: OrganizationDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDto })
  async create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateOrganizationDto,
    @ReqMeta() meta: RequestMeta,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrganizationDto> {
    const result = await this.organizations.create(principal, dto, meta, idempotencyKey);
    res.status(result.status);
    if (result.replayed) res.setHeader("Idempotent-Replayed", "true");
    return result.body;
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ORGANIZATION_UPDATE)
  @ApiOperation({
    operationId: "updateOrganization",
    summary: "Update an organization (optimistic concurrency)",
  })
  @ApiOkResponse({ type: OrganizationDto })
  @ApiNotFoundResponse({ type: ProblemDto })
  @ApiConflictResponse({ type: ProblemDto })
  @ApiUnprocessableEntityResponse({ type: ProblemDto })
  update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.organizations.update(principal, id, dto, meta);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.ORGANIZATION_ARCHIVE)
  @ApiOperation({
    operationId: "archiveOrganization",
    summary: "Archive an organization (no hard deletes)",
  })
  @ApiOkResponse({ type: OrganizationDto })
  @ApiConflictResponse({ type: ProblemDto })
  archive(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.organizations.archive(principal, id, dto.version, meta);
  }

  @Post(":id/restore")
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.ORGANIZATION_ARCHIVE)
  @ApiOperation({ operationId: "restoreOrganization", summary: "Restore an archived organization" })
  @ApiOkResponse({ type: OrganizationDto })
  @ApiConflictResponse({ type: ProblemDto })
  restore(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.organizations.restore(principal, id, dto.version, meta);
  }
}

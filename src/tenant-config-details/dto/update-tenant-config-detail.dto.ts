import { PartialType } from '@nestjs/swagger';
import { CreateTenantConfigDetailDto } from './create-tenant-config-detail.dto';

export class UpdateTenantConfigDetailDto extends PartialType(CreateTenantConfigDetailDto) {}

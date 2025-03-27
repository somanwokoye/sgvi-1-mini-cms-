import { Module } from '@nestjs/common';
import { TenantConfigDetailsService } from './tenant-config-details.service';
import { TenantConfigDetailsController } from './tenant-config-details.controller';
import { TenantConfigDetail } from './entities/tenant-config-detail.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantConfigDetail]), //include all the entities that will be involved in tenantConfigDetailsService. Usually, they have relationship
  ],
  controllers: [TenantConfigDetailsController],
  providers: [TenantConfigDetailsService]
})
export class TenantConfigDetailsModule {}

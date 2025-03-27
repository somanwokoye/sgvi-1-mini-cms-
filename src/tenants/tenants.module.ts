import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomTheme } from './models/custom-theme.entity';
import { Tenant } from './models/tenant.entity';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ThemesModule } from './modules/themes/themes.module';
import { BillingsModule } from './modules/billings/billings.module';
import { User } from 'src/users/models/user.entity';
import { Theme } from './modules/themes/models/theme.entity';
//import { ConnectionResource } from 'src/connection-resources/models/connection-resource.entity';
import { Billing } from './modules/billings/models/billing.entity';
import { TenantTeam } from './models/tenant-team';
import { TenantAccountOfficer } from './models/tenant-account-officer';
import { TenantConfigDetail } from '../tenant-config-details/entities/tenant-config-detail.entity';
import { RegionsService } from '../regions/regions.service';
import { Region } from '../regions/entities/region.entity';
import UsersSearchService from '../search/services/usersSearch.services';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, CustomTheme, User, Theme, Billing, TenantConfigDetail, TenantTeam, TenantAccountOfficer, Region]), //include all the entities that will be involved in tenantsService. Usually, they have relationship
    ThemesModule, 
    BillingsModule,
    SearchModule
  ],
  controllers: [TenantsController],
  providers: [TenantsService, RegionsService, UsersSearchService]
})
export class TenantsModule {}

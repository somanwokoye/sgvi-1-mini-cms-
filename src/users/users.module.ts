import { Module } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegionsService } from '../regions/regions.service';
import { SearchModule } from 'src/search/search.module';
import UsersSearchService from 'src/search/services/usersSearch.services';
import { Role } from '../roles/models/role.entity';
import { TenantAccountOfficer } from '../tenants/models/tenant-account-officer';
import { TenantTeam } from '../tenants/models/tenant-team';
import { Tenant } from '../tenants/models/tenant.entity';
import { User } from './models/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Region } from '../regions/entities/region.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Tenant, TenantTeam, TenantAccountOfficer, Region]), SearchModule],
  controllers: [UsersController],
  providers: [UsersService, UsersSearchService, RegionsService]
})
export class UsersModule {}

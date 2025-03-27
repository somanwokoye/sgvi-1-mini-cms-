import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/models/user.entity';
import { Role } from '../roles/models/role.entity';
import { Tenant } from '../tenants/models/tenant.entity';
import { TenantTeam } from '../tenants/models/tenant-team';
import { TenantAccountOfficer } from '../tenants/models/tenant-account-officer';
import { Region } from '../regions/entities/region.entity';
import { RegionsService } from '../regions/regions.service';
import { SearchModule } from '../search/search.module';
import UsersSearchService from '../search/services/usersSearch.services';
import { GoogleOidcStrategy } from './strategies/google-oidc.strategy';
import { FacebookOauth2Strategy } from './strategies/facebook-oauth2.strategy';

@Module({
  imports: [
    UsersModule, 
    SearchModule,
    TypeOrmModule.forFeature([User, Role, Tenant, TenantTeam, TenantAccountOfficer, Region]),
    
  ],
  providers: [AuthService, UsersService, UsersSearchService, RegionsService, GoogleOidcStrategy, FacebookOauth2Strategy],
  controllers: [AuthController]
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
//We need these to read our environment config variables
//import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './app.database.module';
//import * as Joi from '@hapi/joi';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
//import { ConnectionResourcesModule } from './connection-resources/connection-resources.module';
import { AuthModule } from './auth/auth.module';
import { SearchModule } from './search/search.module';
import { TenantConfigDetailsModule } from './tenant-config-details/tenant-config-details.module';
import { RegionsModule } from './regions/regions.module';

/**
 * The App root module
 */
@Module({
  imports: [ TenantsModule,
    UsersModule,
    RolesModule,
    TenantConfigDetailsModule,
    AuthModule,
    SearchModule,
    //load and parse the environment .env file and store the result in private structure that you can access through the ConfigService
    //Alternatively, I am using dotenv directly from from app.settings.ts as ConfigService can only be injected into class and can also not be injected into Entity even though it is a class
    //I only use below if I need to access my .env properties in modules or services.
    ConfigModule.forRoot({
      //isGlobal: true, //import module where I need it rather than set as global
      cache: true
    }), 
    /* //Below Joi use is if I want to validate environment variables entry. Good idea
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        PORT: Joi.number(),
      })
    }),
    */
    DatabaseModule,
    RegionsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

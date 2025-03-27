import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { PG_UNIQUE_CONSTRAINT_VIOLATION } from '../global/error.codes';
import { CreateUserDto } from '../users/dto/create/create-user.dto';
import { User } from '../users/models/user.entity';
import { Connection, createConnection, DeleteResult, getConnection, InsertResult, Repository, UpdateResult } from 'typeorm';
import { CreateTenantAccountOfficerDto } from './dto/create/create-account-officer.dto';
import { CreateCustomThemeDto } from './dto/create/create-custom-theme.dto';
import { CreateTenantTeamDto, CreateTenantTeamRolesDto } from './dto/create/create-tenant-team.dto';
import { CreateTenantDto } from './dto/create/create-tenant.dto';
import { UpdateTenantAccountOfficerDto } from './dto/update/update-account-officer.dto';
import { UpdateTenantTeamDto } from './dto/update/update-tenant-team.dto';
import { UpdateTenantDto } from './dto/update/update-tenant.dto';
import { CustomTheme } from './models/custom-theme.entity';
import { TenantAccountOfficer } from './models/tenant-account-officer';
import { TenantTeam } from './models/tenant-team';
import { Tenant } from './models/tenant.entity';
import { CreateBillingDto } from './modules/billings/dto/create/create-billing.dto';
import { Billing } from './modules/billings/models/billing.entity';
import { CreateThemeDto } from './modules/themes/dto/create/create-theme.dto';
import { Theme } from './modules/themes/models/theme.entity';
import * as bcrypt from 'bcrypt';
import { Request, Reply, TenantStatus } from '../global/custom.interfaces';
//five imports below are for file upload handling
import util from 'util'; //for uploaded file streaming to file
import { pipeline } from 'stream';//also for uploaded file streaming to file
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { API_VERSION, confirmEmailMailOptionSettings, EMAIL_VERIFICATION_EXPIRATION, LOGO_FILE_SIZE_LIMIT, mailSender, PROTOCOL, SAAS_API_VERSION, SAAS_PROTOCOL, SAAS_USE_API_VERSION_IN_URL, tenantSuccessfullyCreatedMessage, USE_API_VERSION_IN_URL } from '../global/app.settings';
import { SendMailOptions } from 'nodemailer';
import { CreateTenantConfigDetailDto } from '../tenant-config-details/dto/create-tenant-config-detail.dto';
import { TenantConfigDetail } from '../tenant-config-details/entities/tenant-config-detail.entity';
import { RegionsService } from '../regions/regions.service';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import Redis from 'ioredis'; //remember to also run npm install -D @types/ioredis
import { CryptoTools } from '../global/app.tools';
import path from 'path';
import { Region } from '../regions/entities/region.entity';
import UsersSearchService from '../search/services/usersSearch.services';

@Injectable()
export class TenantsService {

    /**
     * 
     * @param tenantRepository 
     */
    constructor(
        @InjectRepository(Tenant) private tenantRepository: Repository<Tenant>,
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(TenantTeam) private tenantTeamRepository: Repository<TenantTeam>,
        @InjectRepository(TenantAccountOfficer) private tenantAccountOfficerRepository: Repository<TenantAccountOfficer>,
        @InjectRepository(CustomTheme) private customThemeRepository: Repository<CustomTheme>,
        @InjectRepository(Theme) private themeRepository: Repository<Theme>,
        @InjectRepository(Billing) private billingRepository: Repository<Billing>,
        @InjectRepository(TenantConfigDetail) private tenantConfigDetailRepository: Repository<TenantConfigDetail>,
        @InjectConnection('default')//You can inject connection by name. See https://docs.nestjs.com/techniques/database#multiple-databases
        private connection: Connection,
        private readonly regionsService: RegionsService,
        private usersSearchService: UsersSearchService,
    ) { }

    /**
     * Maintain connection by regions and get client when needed. Used by getRedisClient below to set/update SaaS properties in redis
     */
    private redisClients: Map<string, Redis.Redis> = new Map();

    /*CREATE section*/
    /**
     * Create tenant with option to create primary contact as well
     * @param createTenantDto 
     */
    async create(createTenantDto: CreateTenantDto, createPrimaryContact: number, req: Request): Promise<Tenant> {
        try {
            //tenantConfigDetail needs special creation process. Besides, only do so if primary contact is confirmed.
            //Therefore,separate the createTenantConfigDetailDto from createTenantDto
            const { tenantConfigDetail, ...createTenantDtoMod } = createTenantDto;
            const createTenantConfigDetailDto: CreateTenantConfigDetailDto = tenantConfigDetail;
            createTenantDto = createTenantDtoMod;
            //now create the newTenant without the tenantConfigDetail
            const newTenant = this.tenantRepository.create(createTenantDto);

            //Update newTenant with region related data before saving
            //get the regionRootDomainName and set for newTenant. It is a denomalization
            const region = await this.regionsService.findRegionByName(createTenantDto.regionName);
            newTenant.regionRootDomainName = region.rootDomainName;

            if (createPrimaryContact != 1) {//the dto primaryContact part should contain the email of the user to set as primary contact
                //find the user by primaryEmailAddress and set as Primary Contact
                const primaryContact: User = await this.userRepository.findOne({ where: { primaryEmailAddress: newTenant.primaryContact.primaryEmailAddress } })

                if (primaryContact) {
                    newTenant.primaryContact = primaryContact
                } else {
                    throw new HttpException({
                        status: HttpStatus.BAD_REQUEST,
                        error: `There was a problem with tenant creation: Primary contact selected does not exist`,
                    }, HttpStatus.BAD_REQUEST)
                }
            } else { //the dto contains all that it takes to create both tenant and primary contact
                //note that the primary contact user will be cascade created. So hash the password before.
                if (newTenant.primaryContact != null) {
                    await bcrypt.hash(newTenant.primaryContact.passwordHash, 10).then((hash: string) => {
                        newTenant.primaryContact.passwordHash = hash
                    })
                    newTenant.primaryContact.isPasswordChangeRequired = true;
                }
            }

            const tenant = await this.tenantRepository.save(newTenant);

            //if primary contact was created, check the email and send verification message
            //check if user primary email and then provoke verification process, if unverified ab initio
            //if (tenant.primaryContact != null && tenant.primaryContact.primaryEmailAddress != null) {
            if (createPrimaryContact == 1) { //if created primary contact
                const user: User = await this.userRepository.findOne({ where: { primaryEmailAddress: tenant.primaryContact.primaryEmailAddress } });
                if (!tenant.primaryContact.isPrimaryEmailAddressVerified) {
                    this.sendVerificationEmail(user, req);
                }
                //I also need to index the user
                this.usersSearchService.indexUser(user);
            }
            //}

            //At this point, we need to decide whether to create the connection details. Only do so if primary Email Address is Verified
            if (tenant.primaryContact.isPrimaryEmailAddressVerified)
                await this.createAndSetTenantConfigDetail(tenant.id, createTenantConfigDetailDto);

            return tenant;

        } catch (error) {
            console.log(error);
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with tenant creation: : ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {

                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with tenant creation: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    //insert using query builder - more efficient than save. Can be used for single or bulk save. See https://github.com/typeorm/typeorm/blob/master/docs/insert-query-builder.md
    async insertTenants(tenants: CreateTenantDto[]): Promise<InsertResult> {//tenants is an array of objects
        //first denomalize the Tenants by getting and inserting the regionRootDomainName 
        const tenantsToInsert: CreateTenantDto[] = [];
        tenants.map(async (tenant) => {
            const region = await this.regionsService.findRegionByName(tenant.regionName);
            tenant.regionRootDomainName = region.rootDomainName;
            tenantsToInsert.push(tenant);
        })
        try {
            return await this.tenantRepository.createQueryBuilder()
                .insert()
                .into(Tenant)
                .values(tenantsToInsert)
                .execute();
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with tenant(s) insertion: : ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with tenant(s) insertion: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

    }
    //Below is not necessary. It is only for the purpose of explaining transactions.
    /**If the query to be executed is expected to be involved in a transaction 
     * at the controller level for example, the function here should be used to return the raw sql instead
     * of an execute(), getOne() or getMany() call that will return a Promise.
     * The insertTenantSQL below returns SQL string
     */
    insertTenantSQL(tenant: CreateTenantDto): string {
        return this.tenantRepository.createQueryBuilder()
            .insert()
            .into(Tenant)
            .values(tenant)
            .getSql();
    }

    /*UPDATE section*/

    async update(id: number, tenant: UpdateTenantDto): Promise<UpdateResult> {
        try {
            return await this.tenantRepository.update(id, { ...tenant })
        } catch (error) {
            console.log(error)
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem updating tenant data: : ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem updating tenant data: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    /**
     * 
     * @param tenant 
     * No partial update allowed here. Saves the tenant object supplied
     */
    async save(tenant: Tenant): Promise<Tenant> {
        try {
            return await this.tenantRepository.save(tenant)
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem updating tenant: : ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem updating: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    //Let's also do partial update using query builder. Also more efficient
    async updateTenant(tenantId: number, updateTenantDto: UpdateTenantDto): Promise<UpdateResult> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .update(Tenant)
                .set({ ...updateTenantDto })
                .where("id = :id", { id: tenantId })
                .execute();
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem updating tenant: : ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem updating: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }


    /* DELETE section */

    async delete(id: number): Promise<void> {
        try {
            await this.tenantRepository.delete(id);
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem deleting tenant data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //query builder equivalent of delete shown above
    async deleteTenant(tenantId: number): Promise<DeleteResult> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .delete()
                .from(Tenant)
                .where("id = :id", { id: tenantId })
                .execute();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem deleting tenant data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 
     * @param tenant 
     * Remove the Tenant specifed. Returns Tenant removed.
     */
    async remove(tenant: Tenant): Promise<Tenant> {
        try {
            return await this.tenantRepository.remove(tenant);
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem deleting tenant data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    /** READ section
     */
    /**
     * You can set options e.g. fields, relations to be returned etc. See https://typeorm.io/#/find-options
     */
    async findAllWithOptions(findOptions: string): Promise<[Tenant[], number]> {
        try {
            return await this.tenantRepository.findAndCount(JSON.parse(findOptions));
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem accessing tenants data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findAll(): Promise<[Tenant[], number]> {
        try {
            return await this.tenantRepository.findAndCount();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem accessing tenants data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * 
     * @param id 
     * find one by id
     */
    async findOne(id: number): Promise<Tenant> {
        try {
            return await this.tenantRepository.findOne(id);
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem accessing tenant data: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }

    async findActiveTenantsByRegionName(regionName: string): Promise<[Tenant[], number]> {

        return await this.tenantRepository.createQueryBuilder("tenant")
            .leftJoinAndSelect("tenant.tenantConfigDetail", "tenantConfigDetail")
            .where("tenant.active = :active", { active: true })
            .andWhere("tenant.regionName = :regionName", { regionName })
            .getManyAndCount()

    }

    async findTenantsByRegionName(regionName: string): Promise<[Tenant[], number]> {

        return await this.tenantRepository.createQueryBuilder("tenant")
            .leftJoinAndSelect("tenant.tenantConfigDetail", "tenantConfigDetail")
            .where("tenant.regionName = :regionName", { regionName })
            .getManyAndCount()

    }

    /**
     * For scalability, this should really be a microservice of its own, running in another process, reading from the same database as TMM
     * Called by setTenantPropertiesInRedisByRegionName below
     * @param regionName 
     * @returns 
     */
    async getTenantPropertiesByRegionName(regionName: string) {

        const properties = [];

        //region is needed for default values
        const region = await this.regionsService.findRegionByName(regionName);
        const [tenants] = await this.findActiveTenantsByRegionName(regionName); //this assumes that tenants are not too many in a region. This for example could be 100 tenants, equivalent of 100 schemas per database
        //console.log(JSON.stringify(tenants));
        tenants.map((tenant) => {
            //console.log(JSON.stringify(tenant.tenantConfigDetail))
            if (tenant.tenantConfigDetail) {//it should not be null
                const dbProperties = tenant.tenantConfigDetail.dbProperties == null ? region.dbProperties : tenant.tenantConfigDetail.dbProperties;
                const redisProperties = tenant.tenantConfigDetail.redisProperties == null ? region.redisProperties : tenant.tenantConfigDetail.redisProperties;
                //const mailerOptions = tenant.tenantConfigDetail.mailerOptions == null ? region.mailerOptions : tenant.tenantConfigDetail.mailerOptions;
                const smtpAuth = tenant.tenantConfigDetail.smtpAuth == null ? region.smtpAuth : tenant.tenantConfigDetail.smtpAuth;
                const otherUserOptions = tenant.tenantConfigDetail.otherUserOptions == null ? region.otherUserOptions : tenant.tenantConfigDetail.otherUserOptions;
                const jwtConstants = tenant.tenantConfigDetail.jwtConstants == null ? region.jwtConstants : tenant.tenantConfigDetail.jwtConstants;
                const authEnabled = tenant.tenantConfigDetail.authEnabled == null ? region.authEnabled : tenant.tenantConfigDetail.authEnabled;
                const fbOauth2Constants = tenant.tenantConfigDetail.fbOauth2Constants == null ? region.fbOauth2Constants : tenant.tenantConfigDetail.fbOauth2Constants;
                const googleOidcConstants = tenant.tenantConfigDetail.googleOidcConstants == null ? region.googleOidcConstants : tenant.tenantConfigDetail.googleOidcConstants;
                const sizeLimits = tenant.tenantConfigDetail.sizeLimits == null ? region.sizeLimits : tenant.tenantConfigDetail.sizeLimits;
                const elasticSearchProperties = tenant.tenantConfigDetail.elasticSearchProperties == null ? region.elasticSearchProperties : tenant.tenantConfigDetail.elasticSearchProperties;
                const theme = tenant.tenantConfigDetail.theme == null ? region.theme : tenant.tenantConfigDetail.theme;
                const rootFileSystem = tenant.tenantConfigDetail.rootFileSystem == null ? region.rootFileSystem : tenant.tenantConfigDetail.rootFileSystem;
                const logo = tenant.logo;
                const logoMimeType = tenant.logoMimeType;

                const tenantUniquePrefix: string = `_${tenant.uuid.replace(/-/g, '')}_`;
                const customURLSlug: string = tenant.customURLSlug;
                const uniqueName: string = `${tenant.subDomainName}.${tenant.regionRootDomainName}`;

                const name: string = tenant.name;
                const moreInfo: string = tenant.moreInfo;
                const address: string = tenant.address;
                const status: TenantStatus = tenant.status;

                const tenantConfigDetailRedisProperties = tenant.tenantConfigDetail.redisProperties; //this is just for test in setTenantProperties... below

                properties.push({
                    dbProperties, redisProperties, smtpAuth, otherUserOptions, jwtConstants,
                    authEnabled, fbOauth2Constants, googleOidcConstants, sizeLimits, elasticSearchProperties,
                    theme, rootFileSystem, logo, logoMimeType, tenantConfigDetailRedisProperties, tenantUniquePrefix, customURLSlug, uniqueName,
                    name, moreInfo, address, status
                });

                //console.log(JSON.stringify(smtpAuth))

            }

        });
        
        return properties;
    }

    /**
     * To be called when there is need to set properties in a region's SaaS redis, e.g. if restarted and persistence storage was lost
     * It will mset one tenant at a time for the client connection
     * NOTE: This should really be in a microservice of its own.
     * @param regionName 
     */
    async setTenantPropertiesInRedisByRegionName(regionName: string) {

        const properties = await this.getTenantPropertiesByRegionName(regionName);

        properties.map(async (prop) => {

            //Get client connection to Redis
            //As sentinels in db was set as string, first convert to proper object format
            let sentinels: { host: string, port: number }[] | null = null;
            if (prop.redisProperties.sentinels != undefined) {
                sentinels = JSON.parse(prop.redisProperties.sentinels)
                //redisPropertiesMod = { ...redisProperties, sentinels }
            }
            //use region name if no tenant specific property
            const redisClientName = prop.tenantConfigDetailRedisProperties == null ? regionName : regionName + "_" + prop.tenantUniquePrefix

            //decrypt password to pass to Redis
            const redisPassword = await CryptoTools.decrypt({ iv: prop.redisProperties.password.iv, content: prop.redisProperties.password.content });
            const redisClient = await this.getRedisClient(redisClientName, { ...prop.redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.

            //if sentinels was set as { host: string, port: number }[] | null in database
            //const redisClient = this.regionsService.getRedisClient(regionUniqueName, redisProperties)

            /*I could do below for setting properties in redis by creating a Map and putting all the settings there 
            and then pass the Map variable to redis client using mset e.g. 
            const redisSettings = new Map<string, Redis.ValueType>()
            redisSettings.set(`${tenantUniquePrefix}POSTGRES_HOST`, dbProperties.host);
            const runRedisSet = redisClientReturned.mset(redisSettings);
            */

            /*
            console.log(JSON.stringify(prop.redisProperties));
            console.log(prop.tenantUniquePrefix);
            console.log(prop.uniqueName);
            */

            //console.log(JSON.stringify(prop))
            //Alternative way to call mset without first creating a Map
            await redisClient.mset({

                [prop.uniqueName]: prop.tenantUniquePrefix,
                [prop.customURLSlug]: prop.tenantUniquePrefix,
                [`${prop.tenantUniquePrefix}POSTGRES_HOST`]: prop.dbProperties.host,
                [`${prop.tenantUniquePrefix}POSTGRES_PORT`]: prop.dbProperties.port,
                [`${prop.tenantUniquePrefix}POSTGRES_USER`]: prop.dbProperties.username,
                [`${prop.tenantUniquePrefix}POSTGRES_PASSWORD`]: prop.dbProperties.password.content,
                [`${prop.tenantUniquePrefix}POSTGRES_PASSWORD_CRYPTO_IV`]: prop.dbProperties.password.iv,
                [`${prop.tenantUniquePrefix}POSTGRES_DB`]: prop.dbProperties.database,
                [`${prop.tenantUniquePrefix}POSTGRES_SCHEMA`]: prop.tenantUniquePrefix,
                [`${prop.tenantUniquePrefix}POSTGRES_SSL_CA`]: prop.dbProperties.ssl != undefined ? prop.dbProperties.ssl.ca : null,
                [`${prop.tenantUniquePrefix}POSTGRES_SSL_KEY`]: prop.dbProperties.ssl != undefined ? prop.dbProperties.ssl.key : null,
                [`${prop.tenantUniquePrefix}POSTGRES_SSL_CERT`]: prop.dbProperties.ssl != undefined ? prop.dbProperties.ssl.cert : null,
                [`${prop.tenantUniquePrefix}POSTGRES_SSL_REJECT_UNAUTHORIZED`]: prop.dbProperties.ssl != undefined ? prop.dbProperties.ssl.rejectUnauthorized ? 'true' : 'false' : null,
                /*
                [`${prop.tenantUniquePrefix}SMTP_USER`]: prop.mailerOptions.smtpUser,
                [`${prop.tenantUniquePrefix}SMTP_PWORD`]: prop.mailerOptions.smtpPword,
                [`${prop.tenantUniquePrefix}SMTP_SERVICE`]: prop.mailerOptions.smtpService,
                [`${prop.tenantUniquePrefix}SMTP_SECURE`]: prop.mailerOptions.smtpSecure ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}SMTP_SERVER`]: prop.mailerOptions.smtpServer,
                [`${prop.tenantUniquePrefix}SMTP_PORT`]: prop.mailerOptions.smtpPort,
                */

                [`${prop.tenantUniquePrefix}SMTP_USER`]: prop.smtpAuth.smtpUser,
                [`${prop.tenantUniquePrefix}SMTP_PWORD`]: prop.smtpAuth.smtpPword ? prop.smtpAuth.smtpPword.content : null,
                [`${prop.tenantUniquePrefix}SMTP_PWORD_CRYPTO_IV`]: prop.smtpAuth.smtpPword ? prop.smtpAuth.smtpPword.iv : null,
                [`${prop.tenantUniquePrefix}SMTP_SERVICE`]: prop.smtpAuth.smtpService,
                [`${prop.tenantUniquePrefix}SMTP_SECURE`]: prop.smtpAuth.smtpSecure ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}SMTP_HOST`]: prop.smtpAuth.smtpHost,
                [`${prop.tenantUniquePrefix}SMTP_PORT`]: prop.smtpAuth.smtpPort,
                [`${prop.tenantUniquePrefix}SMTP_OAUTH`]: prop.smtpAuth.smtpOauth ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}SMTP_CLIENT_ID`]: prop.smtpAuth.smtpClientId,
                [`${prop.tenantUniquePrefix}SMTP_CLIENT_SECRET`]: prop.smtpAuth.smtpClientSecret,
                [`${prop.tenantUniquePrefix}SMTP_ACCESS_TOKEN`]: prop.smtpAuth.smtpAccessToken,
                [`${prop.tenantUniquePrefix}SMTP_REFRESH_TOKEN`]: prop.smtpAuth.smtpRefreshToken,
                [`${prop.tenantUniquePrefix}SMTP_ACCESS_URL`]: prop.smtpAuth.smtpAccessUrl,
                [`${prop.tenantUniquePrefix}SMTP_POOL`]: prop.smtpAuth.smtpPool ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}SMTP_MAXIMUM_CONNECTIONS`]: prop.smtpAuth.smtpMaximumConnections,
                [`${prop.tenantUniquePrefix}SMTP_MAXIMUM_MESSAGES`]: prop.smtpAuth.smtpMaximumMessages,

                [`${prop.tenantUniquePrefix}ResetPasswordMailOptionSettings_TextTemplate`]: prop.otherUserOptions.resetPasswordMailOptionSettings_TextTemplate,
                [`${prop.tenantUniquePrefix}ConfirmEmailMailOptionSettings_TextTemplate`]: prop.otherUserOptions.confirmEmailMailOptionSettings_TextTemplate,
                [`${prop.tenantUniquePrefix}PASSWORD_RESET_EXPIRATION`]: prop.otherUserOptions.passwordResetExpiration,
                [`${prop.tenantUniquePrefix}EMAIL_VERIFICATION_EXPIRATION`]: prop.otherUserOptions.emailVerificationExpiration,

                [`${prop.tenantUniquePrefix}JwtConstants_SECRET`]: prop.jwtConstants.jwtSecretKey,
                [`${prop.tenantUniquePrefix}JwtConstants_SECRET_KEY_EXPIRATION`]: prop.jwtConstants.jwtSecretKeyExpiration,
                [`${prop.tenantUniquePrefix}JwtConstants_REFRESH_SECRET`]: prop.jwtConstants.jwtRefreshSecret,
                [`${prop.tenantUniquePrefix}JwtConstants_REFRESH_SECRET_KEY_EXPIRATION`]: prop.jwtConstants.jwtRefreshSecretKeyExpiration,
                [`${prop.tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY`]: prop.jwtConstants.jwtSecretPrivateKey,
                [`${prop.tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY_PASSPHRASE`]: prop.jwtConstants.jwtSecretPrivateKeyPassphrase,
                [`${prop.tenantUniquePrefix}JwtConstants_SECRET_PUBLIC_KEY`]: prop.jwtConstants.jwtSecretPublicKey,
                [`${prop.tenantUniquePrefix}JwtConstants_SIGN_ALGORITHM`]: prop.jwtConstants.jwtSignAlgorithm,

                [`${prop.tenantUniquePrefix}AuthEnabled_Google`]: prop.authEnabled.google ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}AuthEnabled_Facebook`]: prop.authEnabled.facebook ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}AuthEnabled_TwoFactor`]: prop.authEnabled.twoFactor ? 'true' : 'false',

                [`${prop.tenantUniquePrefix}FBConstants_APP_ID`]: prop.fbOauth2Constants ? prop.fbOauth2Constants.fBAppId : null,
                [`${prop.tenantUniquePrefix}FBConstants_APP_SECRET`]: prop.fbOauth2Constants ? prop.fbOauth2Constants.fBAppSecret : null,
                [`${prop.tenantUniquePrefix}FBConstants_CREATE_USER_IF_NOT_EXISTS`]: prop.fbOauth2Constants ? (prop.fbOauth2Constants.createUserIfNotExists ? 'true' : 'false') : null,

                [`${prop.tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER`]: prop.googleOidcConstants ? prop.googleOidcConstants.googleOauth2ClientOidcIssuer : null,
                [`${prop.tenantUniquePrefix}GoogleConstants_GOOGLE_API_KEY`]: prop.googleOidcConstants ? prop.googleOidcConstants.googleApiKey : null,
                [`${prop.tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_SECRET`]: prop.googleOidcConstants ? prop.googleOidcConstants.googleOauth2ClientSecret : null,
                [`${prop.tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_ID`]: prop.googleOidcConstants ? prop.googleOidcConstants.googleOauth2ClientId : null,
                [`${prop.tenantUniquePrefix}GoogleConstants_CREATE_USER_IF_NOT_EXISTS`]: prop.googleOidcConstants ? (prop.googleOidcConstants.createUserIfNotExists ? 'true' : 'false') : null,

                [`${prop.tenantUniquePrefix}LOGO_FILE_SIZE_LIMIT`]: prop.sizeLimits.logoFileSizeLimit,
                [`${prop.tenantUniquePrefix}PHOTO_FILE_SIZE_LIMIT`]: prop.sizeLimits.photoFileSizeLimit,
                [`${prop.tenantUniquePrefix}GENERAL_FILE_SIZE_LIMIT`]: prop.sizeLimits.generalFileSizeLimit,

                [`${prop.tenantUniquePrefix}ELASTICSEARCH_NODE`]: prop.elasticSearchProperties.node,
                [`${prop.tenantUniquePrefix}ELASTICSEARCH_USERNAME`]: prop.elasticSearchProperties.username,
                [`${prop.tenantUniquePrefix}ELASTICSEARCH_PASSWORD`]: prop.elasticSearchProperties.password.content,
                [`${prop.tenantUniquePrefix}ELASTICSEARCH_PASSWORD_CRYPTO_IV`]: prop.elasticSearchProperties.password.iv,

                [`${prop.tenantUniquePrefix}Theme_Custom`]: prop.theme.custom ? 'true' : 'false',
                [`${prop.tenantUniquePrefix}Theme_Type`]: prop.theme.type,
                [`${prop.tenantUniquePrefix}Theme_RootUrl`]: prop.theme.rootUrl,

                [`${prop.tenantUniquePrefix}Upload_Root_FileSystem`]: prop.rootFileSystem.path, //to be removed when I have adjusted client to use the second below
                [`${prop.tenantUniquePrefix}Root_FileSystem_Path`]: prop.rootFileSystem.path,
                [`${prop.tenantUniquePrefix}Root_FileSystem_Username`]: prop.rootFileSystem.username,
                [`${prop.tenantUniquePrefix}Root_FileSystem_Password`]: prop.rootFileSystem.password ? prop.rootFileSystem.password.content : null,
                [`${prop.tenantUniquePrefix}Root_FileSystem_Password_CRYPTO_IV`]: prop.rootFileSystem.password ? prop.rootFileSystem.password.iv : null,


                [`${prop.tenantUniquePrefix}Logo_FileName`]: prop.logo,
                [`${prop.tenantUniquePrefix}Logo_Mimetype`]: prop.logoMimeType,

                [`${prop.tenantUniquePrefix}NAME`]: prop.name,
                [`${prop.tenantUniquePrefix}MORE_INFO`]: prop.moreInfo,
                [`${prop.tenantUniquePrefix}ADDRESS`]: prop.address,
                [`${prop.tenantUniquePrefix}STATUS`]: prop.status
            });

            //if (prop.tenantConfigDetailRedisProperties != null) redisClient.disconnect(); //close if redis client was opened for just the tenant

        })

    }


    /**
     * To be called when there is need to unset properties of a tenant in a region's SaaS redis, e.g. A hard way to disable a tenant
     * NOTE: This should really be in a microservice of its own.
     * @param tenantId 
     */
    async unsetTenantPropertiesInRedisByTenantId(tenantId: number) {

        const tenant = await this.tenantRepository.createQueryBuilder('tenant')
            .leftJoinAndSelect("tenant.tenantConfigDetail", 'tenantConfigDetail')
            .where('tenant.id = :tenantId', { tenantId })
            .getOne()

        const tenantUniquePrefix: string = `_${tenant.uuid.replace(/-/g, '')}_`;

        const region = await this.regionsService.findRegionByName(tenant.regionName);

        const redisProperties = tenant.tenantConfigDetail.redisProperties == null ? region.redisProperties : tenant.tenantConfigDetail.redisProperties;

        //Get client connection to Redis
        //As sentinels in db was set as string, first convert to proper object format

        let sentinels: { host: string, port: number }[] | null = null;
        if (redisProperties.sentinels != undefined) {
            sentinels = JSON.parse(redisProperties.sentinels)
            //redisPropertiesMod = { ...redisProperties, sentinels }
        }

        //use region name if no tenant specific client
        const redisClientName = tenant.tenantConfigDetail.redisProperties == null ? tenant.regionName : tenant.regionName + "_" + tenantUniquePrefix;

        //dycrypt password to pass to Redis
        const redisPassword = await CryptoTools.decrypt({ iv: redisProperties.password.iv, content: redisProperties.password.content });
        const redisClient = await this.getRedisClient(redisClientName, { ...redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.

        //if sentinels was set as { host: string, port: number }[] | null in database
        //const redisClient = this.regionsService.getRedisClient(redisClientName, redisProperties)

        await redisClient.del([
            `${tenant.subDomainName}.${tenant.regionRootDomainName}`,
            tenant.customURLSlug,
            `${tenantUniquePrefix}POSTGRES_HOST`,
            `${tenantUniquePrefix}POSTGRES_PORT`,
            `${tenantUniquePrefix}POSTGRES_USER`,
            `${tenantUniquePrefix}POSTGRES_PASSWORD`,
            `${tenantUniquePrefix}POSTGRES_PASSWORD_CRYPTO_IV`,
            `${tenantUniquePrefix}POSTGRES_DB`,
            `${tenantUniquePrefix}POSTGRES_SCHEMA`,
            `${tenantUniquePrefix}POSTGRES_SSL_CA`,
            `${tenantUniquePrefix}POSTGRES_SSL_KEY`,
            `${tenantUniquePrefix}POSTGRES_SSL_CERT`,
            `${tenantUniquePrefix}POSTGRES_SSL_REJECT_UNAUTHORIZED`,
            /*
            `${tenantUniquePrefix}SMTP_USER`,
            `${tenantUniquePrefix}SMTP_PWORD`,
            `${tenantUniquePrefix}SMTP_SERVICE`,
            `${tenantUniquePrefix}SMTP_SECURE`,
            `${tenantUniquePrefix}SMTP_SERVER`,
            `${tenantUniquePrefix}SMTP_PORT`,
            */

            `${tenantUniquePrefix}SMTP_USER`,
            `${tenantUniquePrefix}SMTP_PWORD`,
            `${tenantUniquePrefix}SMTP_PWORD_CRYPTO_IV`,
            `${tenantUniquePrefix}SMTP_SERVICE`,
            `${tenantUniquePrefix}SMTP_SECURE`,
            `${tenantUniquePrefix}SMTP_HOST`,
            `${tenantUniquePrefix}SMTP_PORT`,
            `${tenantUniquePrefix}SMTP_OAUTH`,
            `${tenantUniquePrefix}SMTP_CLIENT_ID`,
            `${tenantUniquePrefix}SMTP_CLIENT_SECRET`,
            `${tenantUniquePrefix}SMTP_ACCESS_TOKEN`,
            `${tenantUniquePrefix}SMTP_REFRESH_TOKEN`,
            `${tenantUniquePrefix}SMTP_ACCESS_URL`,
            `${tenantUniquePrefix}SMTP_POOL`,
            `${tenantUniquePrefix}SMTP_MAXIMUM_CONNECTIONS`,
            `${tenantUniquePrefix}SMTP_MAXIMUM_MESSAGES`,

            `${tenantUniquePrefix}ResetPasswordMailOptionSettings_TextTemplate`,
            `${tenantUniquePrefix}ConfirmEmailMailOptionSettings_TextTemplate`,
            `${tenantUniquePrefix}PASSWORD_RESET_EXPIRATION`,
            `${tenantUniquePrefix}EMAIL_VERIFICATION_EXPIRATION`,

            `${tenantUniquePrefix}JwtConstants_SECRET`,
            `${tenantUniquePrefix}JwtConstants_SECRET_KEY_EXPIRATION`,
            `${tenantUniquePrefix}JwtConstants_REFRESH_SECRET`,
            `${tenantUniquePrefix}JwtConstants_REFRESH_SECRET_KEY_EXPIRATION`,
            `${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY`,
            `${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY_PASSPHRASE`,
            `${tenantUniquePrefix}JwtConstants_SECRET_PUBLIC_KEY`,
            `${tenantUniquePrefix}JwtConstants_SIGN_ALGORITHM`,

            `${tenantUniquePrefix}AuthEnabled_Google`,
            `${tenantUniquePrefix}AuthEnabled_Facebook`,
            `${tenantUniquePrefix}AuthEnabled_TwoFactor`,

            `${tenantUniquePrefix}FBConstants_APP_ID`,
            `${tenantUniquePrefix}FBConstants_APP_SECRET`,
            `${tenantUniquePrefix}FBConstants_CREATE_USER_IF_NOT_EXISTS`,

            `${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER`,
            `${tenantUniquePrefix}GoogleConstants_GOOGLE_API_KEY`,
            `${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_SECRET`,
            `${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_ID`,
            `${tenantUniquePrefix}GoogleConstants_CREATE_USER_IF_NOT_EXISTS`,

            `${tenantUniquePrefix}LOGO_FILE_SIZE_LIMIT`,
            `${tenantUniquePrefix}PHOTO_FILE_SIZE_LIMIT`,
            `${tenantUniquePrefix}GENERAL_FILE_SIZE_LIMIT`,

            `${tenantUniquePrefix}ELASTICSEARCH_NODE`,
            `${tenantUniquePrefix}ELASTICSEARCH_USERNAME`,
            `${tenantUniquePrefix}ELASTICSEARCH_PASSWORD`,
            `${tenantUniquePrefix}ELASTICSEARCH_PASSWORD_CRYPTO_IV`,

            `${tenantUniquePrefix}Theme_Custom`,
            `${tenantUniquePrefix}Theme_Type`,
            `${tenantUniquePrefix}Theme_RootUrl`,

            `${tenantUniquePrefix}Upload_Root_FileSystem`,
            `${tenantUniquePrefix}Root_FileSystem_Path`,
            `${tenantUniquePrefix}Root_FileSystem_Username`,
            `${tenantUniquePrefix}Root_FileSystem_Password`,

            `${tenantUniquePrefix}Logo_FileName`,
            `${tenantUniquePrefix}Logo_Mimetype`,
            `${tenantUniquePrefix}NAME`,
            `${tenantUniquePrefix}MORE_INFO`,
            `${tenantUniquePrefix}ADDRESS`,
            `${tenantUniquePrefix}STATUS`
        ]);

        //if (tenant.tenantConfigDetail.redisProperties != null) redisClient.disconnect(); //close if redis client was opened for just the tenant
    }

    /**
     * To be used for enabling or disabling of tenant
     * @param tenantId 
     * @param status 
     */
    async setTenantStatusInRedisByTenantId(tenantId: number, status: TenantStatus){
        if (status !== TenantStatus.A && status !== TenantStatus.O && status !== TenantStatus.S){
            throw new HttpException({
                status: HttpStatus.BAD_REQUEST,
                error: `There was a problem with setting primary contact for tenant`,
            }, HttpStatus.BAD_REQUEST);
        }
        //Get the tenant
        const tenant = await this.tenantRepository.createQueryBuilder('tenant')
            .where('tenant.id = :tenantId', { tenantId })
            .getOne()

        const tenantUniquePrefix: string = `_${tenant.uuid.replace(/-/g, '')}_`;

        /*
        Get the redis client for tenant
         */
        //use region name and properties if no tenant specific
        const region = await this.regionsService.findRegionByName(tenant.regionName);
        const redisClientName = tenant.tenantConfigDetail.redisProperties == null ? tenant.regionName : tenant.regionName + "_" + tenantUniquePrefix;
        const redisProperties = tenant.tenantConfigDetail.redisProperties == null ? region.redisProperties : tenant.tenantConfigDetail.redisProperties;
        
        //dycrypt password to pass to Redis
        const redisPassword = await CryptoTools.decrypt({ iv: redisProperties.password.iv, content: redisProperties.password.content });

        let sentinels: { host: string, port: number }[] | null = null;
        if (redisProperties.sentinels != undefined) {
            sentinels = JSON.parse(redisProperties.sentinels)
            //redisPropertiesMod = { ...redisProperties, sentinels }
        }
        const redisClient = await this.getRedisClient(redisClientName, { ...redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.


        //finally, set the status
        await redisClient.set(`${tenantUniquePrefix}STATUS`, status);

    }

    /**
     * To be called when there is need to set properties of a tenant in a region's SaaS redis, e.g. A way to onboard a formally unset tenant
     * NOTE: This should really be in a microservice of its own.
     * @param tenantId 
     */
    async setTenantPropertiesInRedisByTenantId(tenantId: number) {

        const tenant = await this.tenantRepository.createQueryBuilder('tenant')
            .leftJoinAndSelect("tenant.tenantConfigDetail", 'tenantConfigDetail')
            .where('tenant.id = :tenantId', { tenantId })
            .getOne()

        const tenantUniquePrefix: string = `_${tenant.uuid.replace(/-/g, '')}_`;

        const region = await this.regionsService.findRegionByName(tenant.regionName);

        //Get the properties
        const dbProperties = tenant.tenantConfigDetail.dbProperties == null ? region.dbProperties : tenant.tenantConfigDetail.dbProperties;
        const redisProperties = tenant.tenantConfigDetail.redisProperties == null ? region.redisProperties : tenant.tenantConfigDetail.redisProperties;
        //const mailerOptions = tenant.tenantConfigDetail.mailerOptions == null ? region.mailerOptions : tenant.tenantConfigDetail.mailerOptions;
        const smtpAuth = tenant.tenantConfigDetail.smtpAuth == null ? region.smtpAuth : tenant.tenantConfigDetail.smtpAuth;
        const otherUserOptions = tenant.tenantConfigDetail.otherUserOptions == null ? region.otherUserOptions : tenant.tenantConfigDetail.otherUserOptions;
        const jwtConstants = tenant.tenantConfigDetail.jwtConstants == null ? region.jwtConstants : tenant.tenantConfigDetail.jwtConstants;
        const authEnabled = tenant.tenantConfigDetail.authEnabled == null ? region.authEnabled : tenant.tenantConfigDetail.authEnabled;
        const fbOauth2Constants = tenant.tenantConfigDetail.fbOauth2Constants == null ? region.fbOauth2Constants : tenant.tenantConfigDetail.fbOauth2Constants;
        const googleOidcConstants = tenant.tenantConfigDetail.googleOidcConstants == null ? region.googleOidcConstants : tenant.tenantConfigDetail.googleOidcConstants;
        const sizeLimits = tenant.tenantConfigDetail.sizeLimits == null ? region.sizeLimits : tenant.tenantConfigDetail.sizeLimits;
        const elasticSearchProperties = tenant.tenantConfigDetail.elasticSearchProperties == null ? region.elasticSearchProperties : tenant.tenantConfigDetail.elasticSearchProperties;
        const theme = tenant.tenantConfigDetail.theme == null ? region.theme : tenant.tenantConfigDetail.theme;
        const rootFileSystem = tenant.tenantConfigDetail.rootFileSystem == null ? region.rootFileSystem : tenant.tenantConfigDetail.rootFileSystem;
        const logo = tenant.logo;
        const logoMimeType = tenant.logoMimeType;

        const name = tenant.name;
        const moreInfo = tenant.moreInfo;
        const address = tenant.address;
        const status = tenant.status;



        //Get client connection to Redis
        //As sentinels in db was set as string, first convert to proper object format
        let sentinels: { host: string, port: number }[] | null = null;
        if (redisProperties.sentinels != undefined) {
            sentinels = JSON.parse(redisProperties.sentinels)
            //redisPropertiesMod = { ...redisProperties, sentinels }
        }

        //use region name if no tenant specific client
        const redisClientName = tenant.tenantConfigDetail.redisProperties == null ? tenant.regionName : tenant.regionName + "_" + tenantUniquePrefix
        //dycrypt password to pass to Redis
        const redisPassword = await CryptoTools.decrypt({ iv: redisProperties.password.iv, content: redisProperties.password.content });
        const redisClient = await this.getRedisClient(redisClientName, { ...redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.

        //if sentinels was set as { host: string, port: number }[] | null in database
        //const redisClient = this.regionsService.getRedisClient(redisClientName, redisProperties)

        await redisClient.mset({
            [`${tenant.subDomainName}.${tenant.regionRootDomainName}`]: tenantUniquePrefix,
            [tenant.customURLSlug]: tenantUniquePrefix,
            [`${tenantUniquePrefix}POSTGRES_HOST`]: dbProperties.host,
            [`${tenantUniquePrefix}POSTGRES_PORT`]: dbProperties.port,
            [`${tenantUniquePrefix}POSTGRES_USER`]: dbProperties.username,
            //notice the crypto expectation below
            [`${tenantUniquePrefix}POSTGRES_PASSWORD`]: dbProperties.password.content,
            [`${tenantUniquePrefix}POSTGRES_PASSWORD_CRYPTO_IV`]: dbProperties.password.iv,

            [`${tenantUniquePrefix}POSTGRES_DB`]: dbProperties.database,
            [`${tenantUniquePrefix}POSTGRES_SCHEMA`]: tenantUniquePrefix,
            [`${tenantUniquePrefix}POSTGRES_SSL_CA`]: dbProperties.ssl != undefined ? dbProperties.ssl.ca : null,
            [`${tenantUniquePrefix}POSTGRES_SSL_KEY`]: dbProperties.ssl != undefined ? dbProperties.ssl.key : null,
            [`${tenantUniquePrefix}POSTGRES_SSL_CERT`]: dbProperties.ssl != undefined ? dbProperties.ssl.cert : null,
            [`${tenantUniquePrefix}POSTGRES_SSL_REJECT_UNAUTHORIZED`]: dbProperties.ssl != undefined ? dbProperties.ssl.rejectUnauthorized ? 'true' : 'false' : null,
            /*
            [`${tenantUniquePrefix}SMTP_USER`]: mailerOptions.smtpUser,
            [`${tenantUniquePrefix}SMTP_PWORD`]: mailerOptions.smtpPword,
            [`${tenantUniquePrefix}SMTP_SERVICE`]: mailerOptions.smtpService,
            [`${tenantUniquePrefix}SMTP_SECURE`]: mailerOptions.smtpSecure ? 'true' : 'false',
            [`${tenantUniquePrefix}SMTP_SERVER`]: mailerOptions.smtpServer,
            [`${tenantUniquePrefix}SMTP_PORT`]: mailerOptions.smtpPort,
            */
            [`${tenantUniquePrefix}SMTP_USER`]: smtpAuth.smtpUser,

            [`${tenantUniquePrefix}SMTP_PWORD`]: smtpAuth.smtpPword ? smtpAuth.smtpPword.content : null,
            [`${tenantUniquePrefix}SMTP_PWORD_CRYPTO_IV`]: smtpAuth.smtpPword ? smtpAuth.smtpPword.iv : null,

            [`${tenantUniquePrefix}SMTP_SERVICE`]: smtpAuth.smtpService,
            [`${tenantUniquePrefix}SMTP_SECURE`]: smtpAuth.smtpSecure ? 'true' : 'false',
            [`${tenantUniquePrefix}SMTP_HOST`]: smtpAuth.smtpHost,
            [`${tenantUniquePrefix}SMTP_PORT`]: smtpAuth.smtpPort,
            [`${tenantUniquePrefix}SMTP_OAUTH`]: smtpAuth.smtpOauth ? 'true' : 'false',
            [`${tenantUniquePrefix}SMTP_CLIENT_ID`]: smtpAuth.smtpClientId,
            [`${tenantUniquePrefix}SMTP_CLIENT_SECRET`]: smtpAuth.smtpClientSecret,
            [`${tenantUniquePrefix}SMTP_ACCESS_TOKEN`]: smtpAuth.smtpAccessToken,
            [`${tenantUniquePrefix}SMTP_REFRESH_TOKEN`]: smtpAuth.smtpRefreshToken,
            [`${tenantUniquePrefix}SMTP_ACCESS_URL`]: smtpAuth.smtpAccessUrl,
            [`${tenantUniquePrefix}SMTP_POOL`]: smtpAuth.smtpPool ? 'true' : 'false',
            [`${tenantUniquePrefix}SMTP_MAXIMUM_CONNECTIONS`]: smtpAuth.smtpMaximumConnections,
            [`${tenantUniquePrefix}SMTP_MAXIMUM_MESSAGES`]: smtpAuth.smtpMaximumMessages,

            [`${tenantUniquePrefix}ResetPasswordMailOptionSettings_TextTemplate`]: otherUserOptions.resetPasswordMailOptionSettings_TextTemplate,
            [`${tenantUniquePrefix}ConfirmEmailMailOptionSettings_TextTemplate`]: otherUserOptions.confirmEmailMailOptionSettings_TextTemplate,
            [`${tenantUniquePrefix}PASSWORD_RESET_EXPIRATION`]: otherUserOptions.passwordResetExpiration,
            [`${tenantUniquePrefix}EMAIL_VERIFICATION_EXPIRATION`]: otherUserOptions.emailVerificationExpiration,

            [`${tenantUniquePrefix}JwtConstants_SECRET`]: jwtConstants.jwtSecretKey,
            [`${tenantUniquePrefix}JwtConstants_SECRET_KEY_EXPIRATION`]: jwtConstants.jwtSecretKeyExpiration,
            [`${tenantUniquePrefix}JwtConstants_REFRESH_SECRET`]: jwtConstants.jwtRefreshSecret,
            [`${tenantUniquePrefix}JwtConstants_REFRESH_SECRET_KEY_EXPIRATION`]: jwtConstants.jwtRefreshSecretKeyExpiration,
            [`${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY`]: jwtConstants.jwtSecretPrivateKey,
            [`${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY_PASSPHRASE`]: jwtConstants.jwtSecretPrivateKeyPassphrase,
            [`${tenantUniquePrefix}JwtConstants_SECRET_PUBLIC_KEY`]: jwtConstants.jwtSecretPublicKey,
            [`${tenantUniquePrefix}JwtConstants_SIGN_ALGORITHM`]: jwtConstants.jwtSignAlgorithm,

            [`${tenantUniquePrefix}AuthEnabled_Google`]: authEnabled.google ? 'true' : 'false',
            [`${tenantUniquePrefix}AuthEnabled_Facebook`]: authEnabled.facebook ? 'true' : 'false',
            [`${tenantUniquePrefix}AuthEnabled_TwoFactor`]: authEnabled.twoFactor ? 'true' : 'false',

            [`${tenantUniquePrefix}FBConstants_APP_ID`]: fbOauth2Constants ? fbOauth2Constants.fBAppId : null,
            [`${tenantUniquePrefix}FBConstants_APP_SECRET`]: fbOauth2Constants ? fbOauth2Constants.fBAppSecret : null,
            [`${tenantUniquePrefix}FBConstants_CREATE_USER_IF_NOT_EXISTS`]: fbOauth2Constants ? (fbOauth2Constants.createUserIfNotExists ? 'true' : 'false') : null,

            [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientOidcIssuer : null,
            [`${tenantUniquePrefix}GoogleConstants_GOOGLE_API_KEY`]: googleOidcConstants ? googleOidcConstants.googleApiKey : null,
            [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_SECRET`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientSecret : null,
            [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_ID`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientId : null,
            [`${tenantUniquePrefix}GoogleConstants_CREATE_USER_IF_NOT_EXISTS`]: googleOidcConstants ? (googleOidcConstants.createUserIfNotExists ? 'true' : 'false') : null,

            [`${tenantUniquePrefix}LOGO_FILE_SIZE_LIMIT`]: sizeLimits.logoFileSizeLimit,
            [`${tenantUniquePrefix}PHOTO_FILE_SIZE_LIMIT`]: sizeLimits.photoFileSizeLimit,
            [`${tenantUniquePrefix}GENERAL_FILE_SIZE_LIMIT`]: sizeLimits.generalFileSizeLimit,

            [`${tenantUniquePrefix}ELASTICSEARCH_NODE`]: elasticSearchProperties.node,
            [`${tenantUniquePrefix}ELASTICSEARCH_USERNAME`]: elasticSearchProperties.username,

            [`${tenantUniquePrefix}ELASTICSEARCH_PASSWORD`]: elasticSearchProperties.password.content,
            [`${tenantUniquePrefix}ELASTICSEARCH_PASSWORD_CRYPTO_IV`]: elasticSearchProperties.password.iv,

            [`${tenantUniquePrefix}Theme_Custom`]: theme.custom ? 'true' : 'false',
            [`${tenantUniquePrefix}Theme_Type`]: theme.type,
            [`${tenantUniquePrefix}Theme_RootUrl`]: theme.rootUrl,

            [`${tenantUniquePrefix}Upload_Root_FileSystem`]: rootFileSystem.path, //to be removed when I have adjusted client to use the second below
            [`${tenantUniquePrefix}Root_FileSystem_Path`]: rootFileSystem.path,
            [`${tenantUniquePrefix}Root_FileSystem_Username`]: rootFileSystem.username,

            [`${tenantUniquePrefix}Root_FileSystem_Password`]: rootFileSystem.password ? rootFileSystem.password.content : null,
            [`${tenantUniquePrefix}Root_FileSystem_Password_CRYPTO_IV`]: rootFileSystem.password ? rootFileSystem.password.iv : null,

            [`${tenantUniquePrefix}Logo_FileName`]: logo,
            [`${tenantUniquePrefix}Logo_Mimetype`]: logoMimeType,

            [`${tenantUniquePrefix}NAME`]: name,
            [`${tenantUniquePrefix}MORE_INFO`]: moreInfo,
            [`${tenantUniquePrefix}ADDRESS`]: address,
            [`${tenantUniquePrefix}STATUS`]: status

        });

        //if (tenant.tenantConfigDetail.redisProperties != null) redisClient.disconnect(); //close if redis client was opened for just the tenant
    }

    /*Let's work on functions to set/add and unset/remove relations. set/unset applies to x-to-one and add/remove applies to x-to-many */
    //1. primaryContact

    /**
     * setPrimaryContact takes and tenantId and user object as primaryContact and sets it.
     * For info on relations querybuilder, see https://github.com/typeorm/typeorm/blob/master/docs/relational-query-builder.md
     * Notice the use of set below, because we are dealing with x-to-one. Since only one primary contact
     * per tenant, we have to set. If it was multiple per tenant i.e. to x-to-many, we have to add
     * @param tenantId 
     * @param primaryContact 
     */
    /*
    Below is one way to handle transactions. The other way involving entitymanager is shorter, hence I commented below out
    Transaction wrapping is done when you have two or more database changes for the same functionality
    and you want to make sure that all changes are rolled back if any of them fails
    I use transaction where I create and then set relationship afterwards like createAndSetPrimaryContact below
    async createAndSetPrimaryContact(tenantId: number, createUserDto: CreateUserDto): Promise<void>{
        const queryRunner = this.connection.createQueryRunner();
        await queryRunner.startTransaction();
        try {
            const newUser = this.userRepository.create(createUserDto);
            const user = await queryRunner.manager.save(newUser);
            await queryRunner.manager.createQueryBuilder()
            .relation(Tenant, "primaryContact")
            .of(tenantId)
            .set(user);

            // commit transaction now:
            await queryRunner.commitTransaction();
        }catch(error){
            // since we have errors let's rollback changes we made
            await queryRunner.rollbackTransaction();
            throw new Error(error.message);
        }finally {
            // you need to release query runner which is manually created:
            await queryRunner.release();
        }
    }
    */
    //See the use of entityManager below for transaction purpose
    async createAndSetPrimaryContact(tenantId: number, createUserDto: CreateUserDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                const newUser = this.userRepository.create(createUserDto);
                //hash the password in dto
                await bcrypt.hash(newUser.passwordHash, 10).then((hash: string) => {
                    newUser.passwordHash = hash
                })
                const user = await entityManager.save(newUser);
                await entityManager.createQueryBuilder()
                    .relation(Tenant, "primaryContact")
                    .of(tenantId)
                    .set(user);//x-to-one
            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with setting primary contact for tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with setting primary contact for tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async setPrimaryContactById(tenantId: number, userId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "primaryContact")
                .of(tenantId)
                .set(userId)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem with setting primary contact for tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async unsetPrimaryContactById(tenantId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "primaryContact")
                .of(tenantId)
                .set(null)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem with unsetting primary contact for tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //2. CustomTheme
    async createAndSetCustomTheme(tenantId: number, createCustomThemeDto: CreateCustomThemeDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                const newCustomTheme = this.customThemeRepository.create(createCustomThemeDto);
                const customTheme = await entityManager.save(newCustomTheme);
                await entityManager.createQueryBuilder()
                    .relation(Tenant, "customTheme")
                    .of(tenantId)
                    .set(customTheme);
            })
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem adding custom theme to tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async setCustomThemeById(tenantId: number, customThemeId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "customTheme")
                .of(tenantId)
                .set(customThemeId)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem setting custom theme for tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async unsetCustomThemeById(tenantId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "customTheme")
                .of(tenantId)
                .set(null)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem unsetting custom theme of tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //3. teamMembers. Special case of many-to-many split into two one-to-manys
    async createAndSetTeamMember(tenantId: number, createTenantTeamDto: CreateTenantTeamDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                //create a new user with data sent with dto
                const newUser = this.userRepository.create(createTenantTeamDto.user);
                //hash the password in dto
                await bcrypt.hash(newUser.passwordHash, 10).then((hash: string) => {
                    newUser.passwordHash = hash
                })
                const user = await entityManager.save(newUser);

                //create a new tenant team with roles sent in Dto
                const newTenantTeam = this.tenantTeamRepository.create({ roles: createTenantTeamDto.roles });
                const tenantTeam = await entityManager.save(newTenantTeam);

                //finally, associate the new tenantTeam with both user and tenant
                await entityManager.createQueryBuilder()
                    .relation(TenantTeam, "tenant")
                    .of(tenantTeam.id)
                    .set(tenantId)//x-to-one tenant-team to tenant

                await entityManager.createQueryBuilder()
                    .relation(TenantTeam, "user")
                    .of(tenantTeam.id)
                    .set(user.id);//x-to-one tenant-team to user

            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with adding team member to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with adding team member to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async setTeamMemberById(tenantId: number, userId: number, createTenantTeamRolesDto: CreateTenantTeamRolesDto): Promise<void> {

        try {
            await this.connection.manager.transaction(async entityManager => {
                //create a new tenant team with roles sent in Dto
                const newTenantTeam = this.tenantTeamRepository.create({ roles: createTenantTeamRolesDto.roles });
                const tenantTeam = await entityManager.save(newTenantTeam);

                //Associate the new tenantTeam with both user and tenant
                await entityManager.createQueryBuilder()
                    .relation(TenantTeam, "tenant")
                    .of(tenantTeam.id)
                    .set(tenantId);

                await entityManager.createQueryBuilder()
                    .relation(TenantTeam, "user")
                    .of(tenantTeam.id)
                    .set(userId);
            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with adding team member to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with adding team member to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async deleteTeamMemberById(tenantId: number, userId: number): Promise<DeleteResult> {
        try {
            return await this.tenantTeamRepository.createQueryBuilder()
                .delete()
                .from(TenantTeam)
                .where("tenantId = :tenantId and userId = :userId", { tenantId, userId })
                .execute();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem removing team member from tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateTeamMemberById(tenantId: number, userId: number, updateTenantTeamDto: UpdateTenantTeamDto): Promise<UpdateResult> {
        try {
            return await this.tenantTeamRepository.createQueryBuilder()
                .update()
                .set({ roles: updateTenantTeamDto.roles })
                .where("tenantId = :tenantId and userId = :userId", { tenantId, userId })
                .execute();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem updating team member of tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //4. TenantAccountOfficers. Also a case of many-to-many split into two one-to-manys
    async createAndSetTenantAccountOfficer(tenantId: number, createTenantAccountOfficerDto: CreateTenantAccountOfficerDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                //create a new user with data sent with dto
                const newUser = this.userRepository.create(createTenantAccountOfficerDto.user);
                //hash the password in dto
                await bcrypt.hash(newUser.passwordHash, 10).then((hash: string) => {
                    newUser.passwordHash = hash
                })
                const user = await entityManager.save(newUser);

                //create a new tenant account officer with roles sent in Dto
                const newTenantAccountOfficer = this.tenantAccountOfficerRepository.create({ roles: createTenantAccountOfficerDto.roles });
                const tenantAccountOfficer = await entityManager.save(newTenantAccountOfficer);

                //finally, associate the new tenantAccountOfficer with both user and tenant
                await entityManager.createQueryBuilder()
                    .relation(TenantAccountOfficer, "tenant")
                    .of(tenantAccountOfficer.id)
                    .set(tenantId);

                await entityManager.createQueryBuilder()
                    .relation(TenantAccountOfficer, "user")
                    .of(tenantAccountOfficer.id)
                    .set(user.id);

            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with adding account officer to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with adding account officer to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async setTenantAccountOfficerById(tenantId: number, userId: number, createTenantAccountOfficerDto: CreateTenantAccountOfficerDto): Promise<void> {

        try {
            await this.connection.manager.transaction(async entityManager => {
                //create a new tenant account officer with roles sent in Dto
                const newTenantAccountOfficer = this.tenantAccountOfficerRepository.create({ roles: createTenantAccountOfficerDto.roles });
                const tenantAccountOfficer = await entityManager.save(newTenantAccountOfficer);

                //Associate the new tenantTeam with both user and tenant
                await entityManager.createQueryBuilder()
                    .relation(TenantAccountOfficer, "tenant")
                    .of(tenantAccountOfficer.id)
                    .set(tenantId);

                await entityManager.createQueryBuilder()
                    .relation(TenantAccountOfficer, "user")
                    .of(tenantAccountOfficer.id)
                    .set(userId);
            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with adding account officer to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with adding account officer to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async deleteTenantAccountOfficerById(tenantId: number, userId: number): Promise<DeleteResult> {
        try {
            return await this.tenantAccountOfficerRepository.createQueryBuilder()
                .delete()
                .from(TenantAccountOfficer)
                .where("tenantId = :tenantId and userId = :userId", { tenantId, userId })
                .execute();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem removing tenant account officer from tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateTenantAccountOfficerById(tenantId: number, userId: number, updateTenantAccountOfficerDto: UpdateTenantAccountOfficerDto): Promise<UpdateResult> {
        try {
            return await this.tenantAccountOfficerRepository.createQueryBuilder()
                .update()
                .set({ roles: updateTenantAccountOfficerDto.roles })
                .where("tenantId = :tenantId and userId = :userId", { tenantId, userId })
                .execute();
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem updating account officer of tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //5. Themes
    async createAndAddTheme(tenantId: number, createThemeDto: CreateThemeDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                const newTheme = this.themeRepository.create(createThemeDto);
                const theme = await entityManager.save(newTheme);
                await entityManager.createQueryBuilder()
                    .relation(Tenant, "themes")
                    .of(tenantId)
                    .add(theme);
            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem adding theme to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem adding theme to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async addThemeById(tenantId: number, themeId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "themes")
                .of(tenantId)
                .add(themeId)//add one or more
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem adding theme to tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async removeThemeById(tenantId: number, themeId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "themes")
                .of(tenantId)
                .remove(themeId)//remove one or more
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem removing theme from tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //6. Billings
    async createAndAddBilling(tenantId: number, createBillingDto: CreateBillingDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {
                const newBilling = this.billingRepository.create(createBillingDto);
                const billing = await entityManager.save(newBilling);
                await entityManager.createQueryBuilder()
                    .relation(Tenant, "billings")
                    .of(tenantId)
                    .add(billing);
            })
        } catch (error) {
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem adding billing to tenant: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem adding billing to tenant: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    async addBillingById(tenantId: number, billingId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "billings")
                .of(tenantId)
                .add(billingId)//one or more
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem adding billing to tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async removeBillingById(tenantId: number, billingId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "billings")
                .of(tenantId)
                .remove(billingId)//one or more
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem removing billing to tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //7. TenantConfigDetail
    /**
     * This method first gets the tenantUniquePrefix by stripping tenant's uuid of - and adding _ at the end.
     * The prefix is then set as schema name for the new tenant config detail just created
     * After saving the new config detail, it is linked to the region passed via regionId
     * The tenant config detail is also then linked to the tenant
     * Attempt is then made to create the database schema in the region, for the tenant as well as write tenant's properties to the regions redis. Both are done in parallel.
     * 
     * @param tenantId 
     * @param createTenantConfigDetailDto 
     */
    async createAndSetTenantConfigDetail(tenantId: number, createTenantConfigDetailDto: CreateTenantConfigDetailDto): Promise<void> {
        try {
            await this.connection.manager.transaction(async entityManager => {

                try {

                    const newTenantConfigDetail = this.tenantConfigDetailRepository.create(createTenantConfigDetailDto);

                    //Get uuid, uniqueName and customURLSlug of tenant. For schema, writing to redis. Consider passing them as arguments
                    const [uuid, subDomainName, customURLSlug, regionName, name, moreInfo, address, status, primaryContactFirstName, primaryContactLastName, primaryContactPrimaryEmailAddress, primaryContactGender, primaryContactDateOfBirth] = await this.getTenantUniqueIdentities(tenantId);

                    //Get the region from regionName
                    const region = await this.regionsService.findRegionByName(regionName);

                    //Set the unique name for tenant to tenant's subDomain and region's rootDomainName
                    const uniqueName = `${subDomainName}.${region.rootDomainName}`

                    //trim off - and and _ to the end
                    const tenantUniquePrefix: string = `_${uuid.replace(/-/g, '')}_`;
                    //add schema to connection properties
                    newTenantConfigDetail.dbSchema = tenantUniquePrefix;

                    //save the config detail
                    const tenantConfigDetail = await entityManager.save(newTenantConfigDetail);

                    //link the regionId to the new tenant config detail
                    await entityManager.createQueryBuilder()
                        .relation(TenantConfigDetail, "region")
                        .of(tenantConfigDetail.id)
                        .set(region.id);//x-to-one

                    //link the config detail to tenant
                    await entityManager.createQueryBuilder()
                        .relation(Tenant, "tenantConfigDetail")
                        .of(tenantId)
                        .set(tenantConfigDetail);//x-to-one

                    //get the region entity so that we can get default properties from it where necessary
                    //const region = await this.regionsService.findOne(regionId);

                    //Get the tenant detail properties. Defaults to region if tenantConfigDetail is null
                    const dbProperties = tenantConfigDetail.dbProperties == null ? region.dbProperties : tenantConfigDetail.dbProperties;
                    const redisProperties = tenantConfigDetail.redisProperties == null ? region.redisProperties : tenantConfigDetail.redisProperties;
                    //const mailerOptions = tenantConfigDetail.mailerOptions == null ? region.mailerOptions : tenantConfigDetail.mailerOptions;
                    const smtpAuth = tenantConfigDetail.smtpAuth == null ? region.smtpAuth : tenantConfigDetail.smtpAuth;
                    const otherUserOptions = tenantConfigDetail.otherUserOptions == null ? region.otherUserOptions : tenantConfigDetail.otherUserOptions;
                    const jwtConstants = tenantConfigDetail.jwtConstants == null ? region.jwtConstants : tenantConfigDetail.jwtConstants;
                    const authEnabled = tenantConfigDetail.authEnabled == null ? region.authEnabled : tenantConfigDetail.authEnabled;
                    const fbOauth2Constants = tenantConfigDetail.fbOauth2Constants == null ? region.fbOauth2Constants : tenantConfigDetail.fbOauth2Constants;
                    const googleOidcConstants = tenantConfigDetail.googleOidcConstants == null ? region.googleOidcConstants : tenantConfigDetail.googleOidcConstants;
                    const sizeLimits = tenantConfigDetail.sizeLimits == null ? region.sizeLimits : tenantConfigDetail.sizeLimits;
                    const elasticSearchProperties = tenantConfigDetail.elasticSearchProperties == null ? region.elasticSearchProperties : tenantConfigDetail.elasticSearchProperties;
                    const theme = tenantConfigDetail.theme == null ? region.theme : tenantConfigDetail.theme;
                    const rootFileSystem = tenantConfigDetail.rootFileSystem == null ? region.rootFileSystem : tenantConfigDetail.rootFileSystem;
                    //const logo = tenantConfigDetail.logo; //logo is with the tenant class


                    //The newTenantDBConnection and redisProperties consts below have no await on the right
                    //side so as to parallelize both actions.
                    //Afterwards, new consts are declared to await each one.
                    //newTenantDBConnection is for connection to the region's db so as to create the schema
                    //use region name if no tenant specific client
                    //first dycrypt password
                    const dbPassword = await CryptoTools.decrypt({ iv: dbProperties.password.iv, content: dbProperties.password.content })
                    const dbConnectionName = tenantConfigDetail.dbProperties == null ? region.name : region.name + "_" + tenantUniquePrefix
                    const newTenantDBConnection = this.getDbConnection(dbConnectionName, {
                        type: 'postgres',
                        host: dbProperties.host,
                        port: dbProperties.port,
                        username: dbProperties.username,
                        password: dbPassword,
                        database: dbProperties.database,
                        ssl: dbProperties.ssl
                    });


                    //Next, we need to update the tenancy module of ugum running application with new tenant's connection detail, via Redis


                    //Get client connection to Redis
                    //As sentinels in db was set as string, first convert to proper object format
                    let sentinels: { host: string, port: number }[] | null = null;
                    if (redisProperties.sentinels != undefined) {
                        sentinels = JSON.parse(redisProperties.sentinels)
                        //redisPropertiesMod = { ...redisProperties, sentinels }
                    }
                    //use region name if no tenant specific client
                    const redisClientName = tenantConfigDetail.redisProperties == null ? region.name : region.name + "_" + tenantUniquePrefix;
                    //dycrypt password to pass to Redis
                    const redisPassword = await CryptoTools.decrypt({ iv: redisProperties.password.iv, content: redisProperties.password.content });
                    const redisClient = this.getRedisClient(redisClientName, { ...redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.

                    //if sentinels was set as { host: string, port: number }[] | null in database
                    //const redisClient = this.regionsService.getRedisClient(regionUniqueName, redisProperties)


                    //now await both above after both getDBConnection and getRedisClient have been allowed to run in parallel
                    const newTenantDBConnectionReturned = await newTenantDBConnection;
                    const redisClientReturned = await redisClient;


                    //Now invoke query to create tenant's schema as well as set redis without await, to parallelize them
                    //try {
                    await newTenantDBConnectionReturned.createEntityManager().query(`CREATE SCHEMA ${tenantUniquePrefix}`);
                    //} catch (error) {
                    //    console.log(error); //fail silently if 
                    //}

                    //I need to create the user and roles table in the newTenantDBConnectionReturned specifying the schema named tenantUniquePrefix and then add the superadmin


                    //Time to create asynchronously the tenant's upload file directories as extensions of region rootfilesystem
                    const tenantUploadDirectory = `${rootFileSystem.path}/${tenantUniquePrefix}`
                    await fs.promises.mkdir(`${tenantUploadDirectory}/photos/users`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/photos/products`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/general`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/logos`, { recursive: true });
                    /*TODO. I need to work on theme to include the following paths. 
                    In tenant service, include theme upload and get theme, similar to logo but text. 
                    The cssURl can be a dynamic link that streams the css, like that of logo
                    Same for jsURL and imgURL for theme, to be passed to nunjucks
                    Next: revisit autosuggest search frontend in user search
                    */
                    await fs.promises.mkdir(`${tenantUploadDirectory}/theme`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/theme/css`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/theme/js`, { recursive: true });
                    await fs.promises.mkdir(`${tenantUploadDirectory}/theme/img`, { recursive: true });

                    //Copy user photo avatar and logo avatar to tenantUploadDirectory. Tenants logo is always uploaded there
                    const blankPhotoAvatar = await fs.promises.readFile(`${path.join(__dirname, '../../', 'avatars')}/blankPhotoAvatar.png`);
                    const blankLogoAvatar = await fs.promises.readFile(`${path.join(__dirname, '../../', 'avatars')}/blankLogoAvatar.png`);

                    await fs.promises.writeFile(`${tenantUploadDirectory}/photos/users/blankPhotoAvatar.png`, blankPhotoAvatar);
                    await fs.promises.writeFile(`${tenantUploadDirectory}/logos/blankLogoAvatar.png`, blankLogoAvatar);

                    /*I could do below for setting properties in redis by creating a Map and putting all the settings there 
                    and then pass the Map variable to redis client using mset e.g. 
                    const redisSettings = new Map<string, Redis.ValueType>()
                    redisSettings.set(`${tenantUniquePrefix}POSTGRES_HOST`, dbProperties.host);
                    const runRedisSet = redisClientReturned.mset(redisSettings);
                    */

                    //I need to prepare the login password for superadmin
                    const superAdminPassword = await CryptoTools.generatePassword();
                    const { iv, content } = await CryptoTools.encrypt(superAdminPassword);
                    //console.log(superAdminPassword);
                    //console.log(iv);
                    //console.log(content);

                    //Alternative way to call mset without first creating a Map
                    const setPropertiesInRedis = redisClientReturned.mset({

                        [uniqueName]: tenantUniquePrefix,
                        [customURLSlug]: tenantUniquePrefix,
                        //indicate that this tenant is new and therefore, needs the superadmin to be created on first startup
                        [`${tenantUniquePrefix}NEW_TENANT`]: 'true',
                        [`${tenantUniquePrefix}SUPERADMIN_PASSWORD`]: content,
                        [`${tenantUniquePrefix}SUPERADMIN_PASSWORD_CRYPTO_IV`]: iv,
                        [`${tenantUniquePrefix}SUPERADMIN_EMAIL`]: primaryContactPrimaryEmailAddress,
                        [`${tenantUniquePrefix}SUPERADMIN_FIRSTNAME`]: primaryContactFirstName,
                        [`${tenantUniquePrefix}SUPERADMIN_LASTNAME`]: primaryContactLastName,
                        [`${tenantUniquePrefix}SUPERADMIN_GENDER`]: primaryContactGender,
                        [`${tenantUniquePrefix}SUPERADMIN_DATE_OF_BIRTH`]: primaryContactDateOfBirth,

                        [`${tenantUniquePrefix}POSTGRES_HOST`]: dbProperties.host,
                        [`${tenantUniquePrefix}POSTGRES_PORT`]: dbProperties.port,
                        [`${tenantUniquePrefix}POSTGRES_USER`]: dbProperties.username,

                        [`${tenantUniquePrefix}POSTGRES_PASSWORD`]: dbProperties.password.content,
                        [`${tenantUniquePrefix}POSTGRES_PASSWORD_CRYPTO_IV`]: dbProperties.password.iv,

                        [`${tenantUniquePrefix}POSTGRES_DB`]: dbProperties.database,
                        [`${tenantUniquePrefix}POSTGRES_SCHEMA`]: tenantUniquePrefix,
                        [`${tenantUniquePrefix}POSTGRES_SSL_CA`]: dbProperties.ssl != undefined ? dbProperties.ssl.ca : null,
                        [`${tenantUniquePrefix}POSTGRES_SSL_KEY`]: dbProperties.ssl != undefined ? dbProperties.ssl.key : null,
                        [`${tenantUniquePrefix}POSTGRES_SSL_CERT`]: dbProperties.ssl != undefined ? dbProperties.ssl.cert : null,
                        [`${tenantUniquePrefix}POSTGRES_SSL_REJECT_UNAUTHORIZED`]: dbProperties.ssl != undefined ? dbProperties.ssl.rejectUnauthorized ? 'true' : 'false' : null,

                        /*
                        [`${tenantUniquePrefix}SMTP_USER`]: mailerOptions.smtpUser,
                        [`${tenantUniquePrefix}SMTP_PWORD`]: mailerOptions.smtpPword,
                        [`${tenantUniquePrefix}SMTP_SERVICE`]: mailerOptions.smtpService,
                        [`${tenantUniquePrefix}SMTP_SECURE`]: mailerOptions.smtpSecure ? 'true' : 'false',
                        [`${tenantUniquePrefix}SMTP_SERVER`]: mailerOptions.smtpServer,
                        [`${tenantUniquePrefix}SMTP_PORT`]: mailerOptions.smtpPort,
                        */
                        [`${tenantUniquePrefix}SMTP_USER`]: smtpAuth.smtpUser,

                        [`${tenantUniquePrefix}SMTP_PWORD`]: smtpAuth.smtpPword ? smtpAuth.smtpPword.content : null,
                        [`${tenantUniquePrefix}SMTP_PWORD_CRYPTO_IV`]: smtpAuth.smtpPword ? smtpAuth.smtpPword.iv : null,

                        [`${tenantUniquePrefix}SMTP_SERVICE`]: smtpAuth.smtpService,
                        [`${tenantUniquePrefix}SMTP_SECURE`]: smtpAuth.smtpSecure ? 'true' : 'false',
                        [`${tenantUniquePrefix}SMTP_HOST`]: smtpAuth.smtpHost,
                        [`${tenantUniquePrefix}SMTP_PORT`]: smtpAuth.smtpPort,
                        [`${tenantUniquePrefix}SMTP_OAUTH`]: smtpAuth.smtpOauth ? 'true' : 'false',
                        [`${tenantUniquePrefix}SMTP_CLIENT_ID`]: smtpAuth.smtpClientId,
                        [`${tenantUniquePrefix}SMTP_CLIENT_SECRET`]: smtpAuth.smtpClientSecret,
                        [`${tenantUniquePrefix}SMTP_ACCESS_TOKEN`]: smtpAuth.smtpAccessToken,
                        [`${tenantUniquePrefix}SMTP_REFRESH_TOKEN`]: smtpAuth.smtpRefreshToken,
                        [`${tenantUniquePrefix}SMTP_ACCESS_URL`]: smtpAuth.smtpAccessUrl,
                        [`${tenantUniquePrefix}SMTP_POOL`]: smtpAuth.smtpPool ? 'true' : 'false',
                        [`${tenantUniquePrefix}SMTP_MAXIMUM_CONNECTIONS`]: smtpAuth.smtpMaximumConnections,
                        [`${tenantUniquePrefix}SMTP_MAXIMUM_MESSAGES`]: smtpAuth.smtpMaximumMessages,

                        [`${tenantUniquePrefix}ResetPasswordMailOptionSettings_TextTemplate`]: otherUserOptions.resetPasswordMailOptionSettings_TextTemplate,
                        [`${tenantUniquePrefix}ConfirmEmailMailOptionSettings_TextTemplate`]: otherUserOptions.confirmEmailMailOptionSettings_TextTemplate,
                        [`${tenantUniquePrefix}PASSWORD_RESET_EXPIRATION`]: otherUserOptions.passwordResetExpiration,
                        [`${tenantUniquePrefix}EMAIL_VERIFICATION_EXPIRATION`]: otherUserOptions.emailVerificationExpiration,

                        [`${tenantUniquePrefix}JwtConstants_SECRET`]: jwtConstants.jwtSecretKey,
                        [`${tenantUniquePrefix}JwtConstants_SECRET_KEY_EXPIRATION`]: jwtConstants.jwtSecretKeyExpiration,
                        [`${tenantUniquePrefix}JwtConstants_REFRESH_SECRET`]: jwtConstants.jwtRefreshSecret,
                        [`${tenantUniquePrefix}JwtConstants_REFRESH_SECRET_KEY_EXPIRATION`]: jwtConstants.jwtRefreshSecretKeyExpiration,
                        [`${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY`]: jwtConstants.jwtSecretPrivateKey,
                        [`${tenantUniquePrefix}JwtConstants_SECRET_PRIVATE_KEY_PASSPHRASE`]: jwtConstants.jwtSecretPrivateKeyPassphrase,
                        [`${tenantUniquePrefix}JwtConstants_SECRET_PUBLIC_KEY`]: jwtConstants.jwtSecretPublicKey,
                        [`${tenantUniquePrefix}JwtConstants_SIGN_ALGORITHM`]: jwtConstants.jwtSignAlgorithm,

                        [`${tenantUniquePrefix}AuthEnabled_Google`]: authEnabled.google ? 'true' : 'false',
                        [`${tenantUniquePrefix}AuthEnabled_Facebook`]: authEnabled.facebook ? 'true' : 'false',
                        [`${tenantUniquePrefix}AuthEnabled_TwoFactor`]: authEnabled.twoFactor ? 'true' : 'false',

                        [`${tenantUniquePrefix}FBConstants_APP_ID`]: fbOauth2Constants ? fbOauth2Constants.fBAppId : null,
                        [`${tenantUniquePrefix}FBConstants_APP_SECRET`]: fbOauth2Constants ? fbOauth2Constants.fBAppSecret : null,
                        [`${tenantUniquePrefix}FBConstants_CREATE_USER_IF_NOT_EXISTS`]: fbOauth2Constants ? (fbOauth2Constants.createUserIfNotExists ? 'true' : 'false') : null,

                        [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientOidcIssuer : null,
                        [`${tenantUniquePrefix}GoogleConstants_GOOGLE_API_KEY`]: googleOidcConstants ? googleOidcConstants.googleApiKey : null,
                        [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_SECRET`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientSecret : null,
                        [`${tenantUniquePrefix}GoogleConstants_GOOGLE_OAUTH2_CLIENT_ID`]: googleOidcConstants ? googleOidcConstants.googleOauth2ClientId : null,
                        [`${tenantUniquePrefix}GoogleConstants_CREATE_USER_IF_NOT_EXISTS`]: googleOidcConstants ? (googleOidcConstants.createUserIfNotExists ? 'true' : 'false') : null,

                        [`${tenantUniquePrefix}LOGO_FILE_SIZE_LIMIT`]: sizeLimits.logoFileSizeLimit,
                        [`${tenantUniquePrefix}PHOTO_FILE_SIZE_LIMIT`]: sizeLimits.photoFileSizeLimit,
                        [`${tenantUniquePrefix}GENERAL_FILE_SIZE_LIMIT`]: sizeLimits.generalFileSizeLimit,

                        [`${tenantUniquePrefix}ELASTICSEARCH_NODE`]: elasticSearchProperties.node,
                        [`${tenantUniquePrefix}ELASTICSEARCH_USERNAME`]: elasticSearchProperties.username,
                        [`${tenantUniquePrefix}ELASTICSEARCH_PASSWORD`]: elasticSearchProperties.password.content,
                        [`${tenantUniquePrefix}ELASTICSEARCH_PASSWORD_CRYPTO_IV`]: elasticSearchProperties.password.iv,

                        [`${tenantUniquePrefix}Theme_Custom`]: theme.custom ? 'true' : 'false',
                        [`${tenantUniquePrefix}Theme_Type`]: theme.type,
                        [`${tenantUniquePrefix}Theme_RootUrl`]: theme.rootUrl,

                        //[`${tenantUniquePrefix}Upload_Root_FileSystem`]: rootFileSystem.path, //to be removed when I have adjusted client to use the second below
                        [`${tenantUniquePrefix}Root_FileSystem_Path`]: rootFileSystem.path,
                        [`${tenantUniquePrefix}Root_FileSystem_Username`]: rootFileSystem.username,
                        [`${tenantUniquePrefix}Root_FileSystem_Password`]: rootFileSystem.password ? rootFileSystem.password.content : null,
                        [`${tenantUniquePrefix}Root_FileSystem_Password_CRYPTO_IV`]: rootFileSystem.password ? rootFileSystem.password.iv : null,

                        //[`${tenantUniquePrefix}Logo_FileName`]: logo ? logo.fileName : null,
                        //[`${tenantUniquePrefix}Logo_Mimetype`]: logo ? logo.mimeType : null
                        [`${tenantUniquePrefix}NAME`]: name,
                        [`${tenantUniquePrefix}MORE_INFO`]: moreInfo,
                        [`${tenantUniquePrefix}ADDRESS`]: address,
                        [`${tenantUniquePrefix}STATUS`]: status

                    });


                    //now await both before closing db and moving to webserver setup and mail sending
                    //await runQuery;
                    //Only close or disconnect if it is unique to the tenant. If for whole region, keep alive
                    //if (tenantConfigDetail.dbProperties != null) newTenantDBConnectionReturned.close();
                    await setPropertiesInRedis;
                    //if (tenantConfigDetail.redisProperties != null) redisClientReturned.disconnect();

                    //get the webServer setup for the client
                    /*One way is to upload a uniqueName.conf file to be uploaded to a directory that is read by nginx.conf
                    followed by invoking an nginx reload via shell command in nodejs.*/

                    //Send mail to tenant after successful creation
                    //construct and send email using nodemailer
                    const saasGlobalPrefixUrl = SAAS_USE_API_VERSION_IN_URL ? `/${SAAS_API_VERSION}` : '';
                    const url = `${SAAS_PROTOCOL}://${uniqueName}${saasGlobalPrefixUrl}`;
                    //Get primary contact information
                    //const [primaryContactfirstName, primaryContactLastName, primaryContactPrimaryEmailAddress] = await this.getPrimaryContactNameAndEmail(tenantId);
                    const mailText = tenantSuccessfullyCreatedMessage.textTemplate
                        .replace('{url}', url)
                        .replace('{name}', `${primaryContactFirstName} ${primaryContactLastName}`)
                        .replace('{password}', superAdminPassword)
                        .replace('{username}', primaryContactPrimaryEmailAddress);

                    //mailOptions
                    const mailOptions: SendMailOptions = {
                        to: primaryContactPrimaryEmailAddress,
                        from: tenantSuccessfullyCreatedMessage.from,
                        subject: tenantSuccessfullyCreatedMessage.subject,
                        text: mailText,
                    };

                    //send mail
                    /*
                    smtpTransportGmail.sendMail(mailOptions, async (error: Error) => {
                        //if (error)
                        //    throw error; //throw error that will be caught at the end?
                        console.log(error);
                    });
                    */

                    mailSender(mailOptions);

                } catch (error) {
                    console.log(`Investigation required in createAndSetTenantConfigDetail: ${error}`);
                    //Ensure that tenant is not active and investigate the strange problem

                    await this.unsetTenantPropertiesInRedisByTenantId(tenantId);

                    throw new HttpException({
                        status: HttpStatus.INTERNAL_SERVER_ERROR,
                        error,
                    }, HttpStatus.INTERNAL_SERVER_ERROR);
                }

            });
        } catch (error) {
            //attempt to drop entity schema if already created
            if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                throw new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem with creating and setting tenant config detail: ${error.message}`,
                }, HttpStatus.BAD_REQUEST)
            } else {
                throw new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem with creating and setting tenant config detail: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

    }

    async setTenantConfigDetailById(tenantId: number, tenantConfigDetailId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "tenantConfigDetail")
                .of(tenantId)
                .set(tenantConfigDetailId)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem setting config detail for tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async unsetTenantConfigDetailById(tenantId: number): Promise<void> {
        try {
            return await this.tenantRepository.createQueryBuilder()
                .relation(Tenant, "tenantConfigDetail")
                .of(tenantId)
                .set(null)
        } catch (error) {
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem unsetting config detail for tenant: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    //We can also create some finders using querybuilder. It is more efficient.
    //I am using the Select QueryBuilder here (see https://github.com/typeorm/typeorm/blob/master/docs/select-query-builder.md).
    //Info on insert, update and delete querybuilder and even joining relations, are also in that page
    //Note that QueryBuilder does not work yet with Mongo. For info on Mongo see src https://github.com/typeorm/typeorm/blob/555cd69f46ae68d4686ba4a8e07a8d77a1ee3aad/src/repository/MongoRepository.ts#L56-L55
    //and doc https://github.com/typeorm/typeorm/blob/master/docs/mongodb.md
    //See example below:
    /*   
    async findByActive(active: boolean): Promise<TenantsWithCount>{
        return await this.tenantRepository.createQueryBuilder("tenant")
            .where("tenant.active = :active", { active })
            .getManyAndCount().then((result) => {
                return {tenants:result[0], count:result[1]}
            });
    }
    */
    async findByActive(active: boolean): Promise<[Tenant[], number]> {
        return await this.tenantRepository.createQueryBuilder("tenant")
            .where("tenant.active = :active", { active })
            .getManyAndCount()
    }

    async findByUniqueName(subDomainName: string, regionRootDomainName: string): Promise<Tenant> {
        return await this.tenantRepository.createQueryBuilder("tenant")
            .where("tenant.subDomainName = :subDomainName", { subDomainName })
            .andWhere("tenant.regionRootDomainName = :regionRootDomainName", { regionRootDomainName })
            .getOne();
    }

    async checkIfChosenDomainNameExists(subDomainName: string, regionRootDomainName: string): Promise<boolean> {
        let exists = false;
        const count = await this.tenantRepository.createQueryBuilder("tenant")
            .where("tenant.subDomainName = :subDomainName", { subDomainName })
            .andWhere("tenant.regionRootDomainName = :regionRootDomainName", { regionRootDomainName })
            .getCount()
        if (count > 0)
            exists = true;

        return exists
    }


    //some perculiar getters. Sea without shores
    async getActiveTenantsByAccountOfficer(userId: number, active: boolean = true): Promise<TenantAccountOfficer[]> {
        return await this.tenantAccountOfficerRepository.createQueryBuilder("tenantAccountOfficer")
            .innerJoinAndSelect("tenantAccountOfficer.tenant", "tenant", "tenant.active = :active", { active })
            .where("tenantAccountOfficer.user = :userId", { userId })
            .getMany()

    }

    async getAccountOfficersByTenant(tenantId: number): Promise<TenantAccountOfficer[]> {
        return await this.tenantAccountOfficerRepository.createQueryBuilder("tenantAccountOfficer")
            .innerJoinAndSelect("tenantAccountOfficer.user", "user")
            .where("tenantAccountOfficer.tenant = :tenantId", { tenantId })
            .getMany()

        //To restrict the returned fields of user, below for example will only return user.id, user.firstName, user.lastName, etc
        /*
        return await this.tenantAccountOfficerRepository.createQueryBuilder("tenantAccountOfficer")
        .select(["tenantAccountOfficer.id", "tenantAccountOfficer.roles"])
        .addSelect(["user.id, user.firstName, user.lastName, user.primaryEmailAddress, user.phone, user.roles"])
        .innerJoin("tenantAccountOfficer.user", "user")
        .where("tenantAccountOfficer.tenant = :tenantId", {tenantId})
        .getMany()
        */

    }

    async setTenantLogo(tenantId: number, req: Request, reply: Reply): Promise<any> {
        /*This is a special case. 
        References: 
        https://medium.com/@427anuragsharma/upload-files-using-multipart-with-fastify-and-nestjs-3f74aafef331,
        https://github.com/fastify/fastify-multipart

        For ideas on send files, see https://expressjs.com/en/api.html#res.sendFile, https://stackoverflow.com/questions/51045980/how-to-serve-assets-from-nest-js-and-add-middleware-to-detect-image-request, https://github.com/fastify/fastify/issues/163#issuecomment-323070670, 
        Steps:
        1. npm i fastify-multipart
        2. Assuming that uploads will be to /uploads folder under project directory, create the folder.
        For multitenant implementations, we will read this from tenantConfigDetail.rootFileSystem
        3. For user photos, we will assume the path photos/filename. We will use uuid to generate unique filename and store in photo fieldThe filename will be stored in photo field
        4. We will store the mime type for file in user field photoFileEncoding, for setting content type when sending file
        5. Register the installed fastify-multipart in main.ts
        */
        //Check request is multipart
        if (!req.isMultipart()) {
            reply.send(
                new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem uploading logo. No logo was sent`,
                }, HttpStatus.BAD_REQUEST)
            )
        }
        //It is multipart, so proceed to get the file

        try {
            //console.log('about to set options')
            const options = { limits: { fileSize: LOGO_FILE_SIZE_LIMIT } }; //limit options may be passed. Unit is bytes. See main.ts for comments on other options
            const data = await req.file(options);

            //save to file
            //We will use uuid (see https://github.com/uuidjs/uuid) to generate filename instead of using data.filename
            //note: npm install uuid @types/uuid
            let { tenantUniquePrefix, fileName, rootFileSystemPath, redisClientName, redisProperties } = await this.getLogoInfo(tenantId);
            if (fileName == null) fileName = uuidv4(); //no previous photo, generate new fileName

            //time to write
            const filePath = `${rootFileSystemPath}/${tenantUniquePrefix}/logos/${fileName}`;
            const pump = util.promisify(pipeline)
            //await pump(data.file, fs.createWriteStream(`${UPLOAD_DIRECTORY}/logos/${fileName}`))//beware of filesystem permissions
            await pump(data.file, fs.createWriteStream(filePath))//beware of filesystem permissions

            //save the fileName to logo and mimetype to tenant logoMimeType field
            const updateResult = await this.tenantRepository.createQueryBuilder()
                .update(Tenant)
                .set({ logo: fileName, logoMimeType: data.mimetype })
                .where("id = :tenantId", { tenantId })
                .execute();

            //time to write to region tenant's redis
            //As sentinels in db was set as string, first convert to proper object format
            let sentinels: { host: string, port: number }[] | null = null;
            if (redisProperties.sentinels != undefined) {
                sentinels = JSON.parse(redisProperties.sentinels)
                //redisPropertiesMod = { ...redisProperties, sentinels }
            }

            //decrypt password to pass to Redis
            const redisPassword = await CryptoTools.decrypt({ iv: redisProperties.password.iv, content: redisProperties.password.content });
            const redisClient = await this.getRedisClient(redisClientName, { ...redisProperties, password: redisPassword, sentinels }); //replace sentinels with properly formatted one.


            await redisClient.mset({
                [`${tenantUniquePrefix}Logo_FileName`]: fileName,
                [`${tenantUniquePrefix}Logo_Mimetype`]: data.mimetype
            })

            reply.send(updateResult);
        } catch (error) {
            /*const fastify = require('fastify');//Below only works with this. Hence this weird entry here
            if (error instanceof fastify.multipartErrors.FilesLimitError) {
                reply.send(new HttpException({
                    status: HttpStatus.BAD_REQUEST,
                    error: `There was a problem uploading logo. Keep upload to size limit of ${LOGO_FILE_SIZE_LIMIT} bytes`,
                }, HttpStatus.BAD_REQUEST))
            } else {*/
            reply.send(
                new HttpException({
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    error: `There was a problem uploading logo: ${error.message}`,
                }, HttpStatus.INTERNAL_SERVER_ERROR)
            )
            //}
        }
    }

    /**
     * Get information about tenant logo
     * @param tenantId 
     */
    async getLogoInfo(tenantId: number): Promise<{
        tenantUniquePrefix: string, fileName: string, mimeType: string, rootFileSystemPath: string, redisClientName: string, redisProperties: {
            host: string;
            port: number;
            password: {
                iv: string;
                content: string;
            };
            db: number;
            sentinels?: string;
            family?: number;
            ca?: string;
        }
    }> {
        try {
            //const tenant: Tenant = await this.tenantRepository.findOne(tenantId)

            const tenant: Tenant = await this.tenantRepository.createQueryBuilder("tenant")
                .leftJoin("tenant.tenantConfigDetail", "tenantConfigDetail")
                .select(["tenant.uuid", "tenant.logo", "tenant.logoMimeType", "tenant.regionName", "tenantConfigDetail.rootFileSystem", "tenantConfigDetail.redisProperties"])
                .where("tenant.id = :tenantId", { tenantId })
                .getOne();

            //Optimisation review required below. To avoid a second visit to db, I may need to relate regionId so as to query at once
            const region: Region = await this.regionsService.findRegionByName(tenant.regionName);

            const rootFileSystem = tenant.tenantConfigDetail && tenant.tenantConfigDetail.rootFileSystem != null ? tenant.tenantConfigDetail.rootFileSystem : region.rootFileSystem;
            const redisProperties = tenant.tenantConfigDetail && tenant.tenantConfigDetail.redisProperties != null ? tenant.tenantConfigDetail.redisProperties : region.redisProperties;

            //Also get redisClientName, just in case it is already open
            const tenantUniquePrefix: string = `_${tenant.uuid.replace(/-/g, '')}_`;
            const redisClientName = tenant.tenantConfigDetail && tenant.tenantConfigDetail.redisProperties != null ? region.name + "_" + tenantUniquePrefix : region.name;

            return { tenantUniquePrefix, fileName: tenant.logo, mimeType: tenant.logoMimeType, rootFileSystemPath: rootFileSystem.path, redisClientName, redisProperties }

        } catch (error) {
            console.log(error)
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem with getting tenant logo info: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getTenantLogo(tenantId: number, reply: Reply) {
        const logoInfo = await this.getLogoInfo(tenantId);
        let { tenantUniquePrefix, fileName, mimeType, rootFileSystemPath } = logoInfo;
        if (fileName == null || undefined) {

            fileName = "blankLogoAvatar.png";//make sure that it exists
            mimeType = "image/png";
        }

        const filePath = `${rootFileSystemPath}/${tenantUniquePrefix}/logos/${fileName}`;
        //read the file as stream and send out
        try {
            const stream = fs.createReadStream(filePath)
            reply.type(mimeType).send(stream);
        } catch (error) {
            reply.send(new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: `There was a problem with getting tenant logo info: ${error.message}`,
            }, HttpStatus.INTERNAL_SERVER_ERROR));
        }
    }


    async sendVerificationEmail(user: User, req: Request): Promise<void> {
        if (user != null) {
            //generate the token (for primary or backup). See resetPasswordRequest above for ideas
            randomBytes(256, async (error, buf) => {
                if (error)
                    throw error; //strange. the catch part below will handle it
                const token = buf.toString('hex');

                //success. Continue with email containing reset message with token
                user.primaryEmailVerificationToken = token;
                user.emailVerificationTokenExpiration = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRATION);
                //save the updated user
                await this.userRepository.save(user);

                //construct and send email using nodemailer
                const globalPrefixUrl = USE_API_VERSION_IN_URL ? `/${API_VERSION}` : '';
                const url = `${req.protocol || PROTOCOL}://${req.hostname}${globalPrefixUrl}/users/confirm-primary-email/${token}`;
                const mailText = confirmEmailMailOptionSettings.textTemplate.replace('{url}', url);


                //mailOptions
                const mailOptions: SendMailOptions = {
                    to: user.primaryEmailAddress,
                    from: confirmEmailMailOptionSettings.from,
                    subject: confirmEmailMailOptionSettings.subject,
                    text: mailText,
                };

                //send mail
                /*
                smtpTransportGmail.sendMail(mailOptions, async (error: Error) => {
                    //if (error)
                    //    throw error; //throw error that will be caught at the end?
                    console.log(error);
                });
                */
                mailSender(mailOptions);
            });
        }
    }

    /* Below are unique util functions */
    /**
     * Get redis client for the region. This is called when tenant config details are to be added to a region's redis.
     * @param name
     * @param redisProperties
     * @returns 
     */
    async getRedisClient(name: string, redisProperties: Redis.RedisOptions) {
        let client: Redis.Redis = this.redisClients.get(name); //attempt to get client for existing connection

        if (client == undefined) {
            try {
                //create the connection
                client = new Redis({
                    host: redisProperties.host,
                    port: redisProperties.port,
                    password: redisProperties.password,
                    db: redisProperties.db,
                    family: redisProperties.family,
                    sentinels: redisProperties.sentinels,
                    name: name
                });
                this.redisClients.set(name, client); //update the Map of connections here
            } catch (error) {
                console.log(error)
                throw new BadRequestException(
                    `${error.message}`,
                    `Could not connect to redis service to set tenant properties: ${error.message}`
                );
            }

        }
        return client;
    }

    /**
     * This method is for getting db connection for the tenant by name. This name could be region name or region + _tenant name if unique to tenant. If not yet opened, a new one is created.
     * @param name 
     * @param connectionProperties 
     * @returns 
     */
    async getDbConnection(name: string, connectionProperties: PostgresConnectionOptions): Promise<Connection> {

        //try to get existing connection for the region
        try {
            return getConnection(name) //using regionName as connection name
        } catch (error) {
            //No connection created yet for the region? create one
            console.log('trying to create connection for the region or tenant')
            try {
                return await createConnection({
                    name: name,
                    type: 'postgres',
                    host: connectionProperties.host,
                    port: connectionProperties.port,
                    username: connectionProperties.username,
                    password: connectionProperties.password,
                    database: connectionProperties.database as string,
                    ssl: connectionProperties.ssl
                });
            }
            catch (error) {
                console.log(error)
                throw new BadRequestException(
                    `${error.message}`,
                    `Could not get database connection: ${error.message}`
                );
            }

        }
    }

    async getTenantUniqueIdentities(tenantId: number): Promise<string[]> {
        const tenant: Tenant = await this.tenantRepository.createQueryBuilder("tenant")
            .leftJoin("tenant.primaryContact", "primaryContact")
            .select(["tenant.id", "tenant.uuid", "tenant.subDomainName", "tenant.customURLSlug", "tenant.regionName", "tenant.name", "tenant.moreInfo", "tenant.address", "tenant.status", "primaryContact.firstName", "primaryContact.lastName", "primaryContact.primaryEmailAddress", "primaryContact.gender", "primaryContact.dateOfBirth"])
            .where("tenant.id = :tenantId", { tenantId })
            .getOne();

        //return [tenant.uuid, tenant.subDomainName, tenant.customURLSlug, tenant.regionName];
        return [tenant.uuid, tenant.subDomainName, tenant.customURLSlug, tenant.regionName, tenant.name, tenant.moreInfo, tenant.address, tenant.status, tenant.primaryContact.firstName, tenant.primaryContact.lastName, tenant.primaryContact.primaryEmailAddress, tenant.primaryContact.gender, tenant.primaryContact.dateOfBirth.toLocaleDateString()];
    }

    /* Not needed anymore, combined with getTenantUniqueIdentities
    async getPrimaryContactNameAndEmail(tenantId: number): Promise<string[]> {
        //const tenant = await this.tenantRepository.findOne(tenantId);
        //user querybuilder to avoid overfetching
        const tenant = await this.tenantRepository.createQueryBuilder("tenant")
            .select("tenant.id")
            .leftJoinAndSelect("tenant.primaryContact", "primaryContact")
            .where("tenant.id = :tenantId", { tenantId })
            .getOne()

        return [tenant.primaryContact.firstName, tenant.primaryContact.lastName, tenant.primaryContact.primaryEmailAddress];
    }
    */


}

import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { renderToNodeStream } from 'react-dom/server';
import App from '../clients_dev/tenants-react-web-client/src/App';
import * as React from 'react';
import { Request, Reply, TenantStatus } from 'src/global/custom.interfaces';
import renderEngine from 'src/global/render.engine';
import { UpdateResult } from 'typeorm/query-builder/result/UpdateResult';
import { CreateTenantDto, CreateTenantDtos } from './dto/create/create-tenant.dto';
import { UpdateTenantDto } from './dto/update/update-tenant.dto';
import { Tenant } from './models/tenant.entity';
import { TenantsService } from './tenants.service';
import { CreateUserDto } from 'src/users/dto/create/create-user.dto';
import { DeleteResult, InsertResult } from 'typeorm';
import { CreateThemeDto } from './modules/themes/dto/create/create-theme.dto';
import { CreateBillingDto } from './modules/billings/dto/create/create-billing.dto';
import { CreateCustomThemeDto } from './dto/create/create-custom-theme.dto';
import { IState } from '../clients_dev/tenants-react-web-client/src/global/app.interfaces';
import { CreateTenantTeamDto, CreateTenantTeamRolesDto } from './dto/create/create-tenant-team.dto';
import { CreateTenantAccountOfficerDto } from './dto/create/create-account-officer.dto';
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileUploadDto } from '../global/file-upload.dto';
import { API_VERSION } from '../global/app.settings';
import { CreateTenantConfigDetailDto } from '../tenant-config-details/dto/create-tenant-config-detail.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {

    /**
     * 
     * @param tenantsService 
     * Inject tenantsService
     */
    constructor(private readonly tenantsService: TenantsService) { }

    /**
     * Create a new tenant
     * @param createTenantDto 
     * Handle Post request for create
     * Indicate via query named createPrimaryContact whether primary contact should be created 
     */
    @Post()
    create(@Body() createTenantDto: CreateTenantDto, @Query() query: string, @Req() req: Request): Promise<Tenant> {
        //read the query to check if createPrimaryContact is enabled
        const createPrimaryContact: number = query["createPrimaryContact"];
        //const createPrimaryContactInt: number = createPrimaryContact==true? 1 : 0
        //console.log(createPrimaryContact)
        return this.tenantsService.create(createTenantDto, createPrimaryContact, req);
    }

    /**
     * Insert new tenant(s)
     * @param createTenantDtos 
     * @returns 
     */
    @Post('insert')
    insert(@Body() createTenantDtos: CreateTenantDtos): Promise<InsertResult> {
        return this.tenantsService.insertTenants(createTenantDtos.dtos);
    }

    /**
     * Update a tenant by id
     * @param id id of tenant to be updated
     * @param updateTenantDto new content
     * Handle Put request for 
     */
    /* FindOneParams not working well. Using ParseIntPipe
    @Put(':id')
    partialUpdate(@Param('id', ParseIntPipe) id: FindOneParams, @Body() updateTenantDto: UpdateTenantDto): Promise<UpdateResult> {
        return this.tenantsService.update1(id, updateTenantDto);
    }
    */
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto): Promise<UpdateResult> {
        //console.log(JSON.stringify(updateTenantDto))
        return this.tenantsService.update(+id, updateTenantDto);
    }

    /**
     * Fully update a tenant
     * @param tenant 
     * Non-partial update. Takes a full tenant without param. Use this if data sent includes relations.
     */
    @Put()
    save(@Body() tenant: Tenant): Promise<Tenant> {
        return this.tenantsService.save(tenant);
    }


    /**
     * Delete a tenant
     * @param id 
     * @returns 
     */
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.tenantsService.delete(+id);
    }

    /**READ section */
    /**
     * Find all or with custom query
     * @param query 
     * @returns 
     */
    @ApiQuery({ name: 'findOptions', required: false, description: 'encodeURI(JSON.stringify({select?: string[]; relations?: string[]; skip?: number; take?: number;cache?: boolean; where?: {}[] | {}; order?: {};}))' })
    @Get()
    findAll(@Query() query: string): Promise<[Tenant[], number]> {

        for (const queryKey of Object.keys(query)) {
            if (queryKey == "findOptions") {
                return this.tenantsService.findAllWithOptions(decodeURI(query[queryKey]));
            }
        }
        //console.log('inside findAll');
        return this.tenantsService.findAll();
    }

    /**
     * Find a tenant by id
     * @param id 
     * @returns 
     */
    @Get(':id')
    findOne(@Param('id') id: string): Promise<Tenant> {
        return this.tenantsService.findOne(+id);
    }

    /**
     * Get active tenants in region by region name
     * @param regionName 
     * @returns 
     */
    @Get('get-active-tenants-in-region/:regionName')
    findActiveTenantsByRegionName(@Param('regionName') regionName: string): Promise<[Tenant[], number]> {
        return this.tenantsService.findActiveTenantsByRegionName(regionName);
    }

    /**
     * Get tenants in region by region name
     * @param regionName 
     */
    @Get('get-tenants-in-region/:regionName')
    findTenantsByRegionName(@Param('regionName') regionName: string): Promise<[Tenant[], number]> {
        return this.tenantsService.findTenantsByRegionName(regionName);
    }

    /**
     * Set the properties of all tenants in SaaS redis for a given region
     * @param regionName 
     * @returns 
     */
    @Patch('set-tenant-properties-in-redis-by-region-name/:regionName')
    setTenantPropertiesInRedisByRegionName(@Param('regionName') regionName: string) {
        return this.tenantsService.setTenantPropertiesInRedisByRegionName(regionName);
    }

    /**
     * Set the properties of a given tenant in SaaS redis
     * @param tenantId 
     * @returns 
     */
    @Patch('set-tenant-properties-in-redis-by-tenant-id/:tenantId')
    setTenantPropertiesInRedisByTenantId(@Param('tenantId') tenantId: string) {
        return this.tenantsService.setTenantPropertiesInRedisByTenantId(+tenantId);
    }

    /**
     * Unset the properties of a given tenant in SaaS redis
     * @param tenantId 
     * @returns 
     */
    @Patch('unset-tenant-properties-in-redis-by-tenant-id/:tenantId')
    unsetTenantPropertiesInRedisByTenantId(@Param('tenantId') tenantId: string) {
        return this.tenantsService.unsetTenantPropertiesInRedisByTenantId(+tenantId);
    }

    /**
     * Check if chosen domain name exists already
     * @param subDomainName 
     * @param regionRootDomainName 
     * @returns true or false
     */
    @Get('check-if-chosen-domain-name-exists/:subDomainName/:regionRootDomainName')
    checkIfChosenDomainNameExists(@Param('subDomainName') subDomainName: string, @Param('regionRootDomainName')regionRootDomainName: string): Promise<boolean> {
        return this.tenantsService.checkIfChosenDomainNameExists(subDomainName, regionRootDomainName);
    }

    /**
     * Find all or with custom query. Returns html and not json object
     * @param reply 
     */
    @Get('web')
    async web(@Res() reply: Reply) {

        //We want to render the raw way so that we can call renderToStream
        const res = reply.raw;

        /*We want to be able to send some initialization data to the react component
        Just using below string as an illustration placeholder for now. The real value will be 
        when we implement Authentication and Authorization.
        The token will contain whatever data you want to pass but in base64 digest format.
        For example, UserInfo, Roles, ThemeContext values, etc.
        */
        //const initialProps = { jwtToken: "put-the-token-string-here-if-any" };

        //Instead of the above, we will pass initial values for our state variable.
        //We may for example want to send tenants e.g.
        const [tenants, count] = await this.tenantsService.findAllWithOptions('{"take": 10, "relations":["primaryContact","teamMembers", "tenantAccountOfficers", "customTheme", "tenantConfigDetail"]}');
        //because of the await, we had to make this function async
        const initialProps: IState = {
            tenants: tenants,
            tenantsCount: count,
            tenant: null,
            onAddTenant: false,
            onViewTenant: false,
            onEditTenant: false,
            alert: { show: false, message: '', type: '' }
        };

        const beforeStream = renderEngine().render('tenants/before-react-stream.fragment.html',
            { title: 'Tenants Admin', TenantsActive: true, apiVersion: API_VERSION !== null ? `${API_VERSION}` : '', currentUrlSlug: API_VERSION !== null ? `/${API_VERSION}/tenants/web` : '/tenants/web' })

        const afterStream = renderEngine().render('tenants/after-react-stream.fragment.html',
            { initialProps: encodeURI(JSON.stringify(initialProps)) })

        //Write the first rendered fragment (upper html part)
        res.write(beforeStream);

        //write the React app using renderToNodeStream
        const stream = renderToNodeStream(<App {...initialProps} />)

        stream.addListener('end', () => {
            res.write(afterStream); //Write the last rendered fragment (lower html part)
            res.end();
        });

        //enable stream piping
        stream.pipe(res, { end: false });

    }

    /*Work on relationships*/

    //1. Primary Contact
    /**
     * Set primary contact for tenant
     * @param tenantId 
     * @param userId 
     * @returns 
     */
    @Patch(':tenantId/primary-contact/:userId')
    setPrimaryContactById(@Param('tenantId') tenantId: string, @Param('userId') userId: string): Promise<void> {
        return this.tenantsService.setPrimaryContactById(+tenantId, +userId);
    }

    /**
     * Create a new user and set as primary contact for tenant
     * @param createUserDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/primary-contact')
    createAndSetPrimaryContact(@Body() createUserDto: CreateUserDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndSetPrimaryContact(+tenantId, createUserDto);
    }

    /**
     * Unset primary contact for tenant
     * @param tenantId 
     * @returns 
     */
    @Delete(':tenantId/primary-contact')
    unsetPrimaryContactById(@Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.unsetPrimaryContactById(+tenantId);
    }

    //2. Custom Theme
    /**
     * Set custom theme for tenant by id. This is not in use for now. Tenant-config-details has theme properties
     * @param tenantId 
     * @param customThemeId 
     * @returns 
     */
    @Patch(':tenantId/custom-theme/:customThemeId')
    setCustomThemeById(@Param('tenantId') tenantId: string, @Param('customThemeId') customThemeId: string): Promise<void> {
        return this.tenantsService.setCustomThemeById(+tenantId, +customThemeId);
    }

    /**
     * Create a new custom theme and set for tenant. This is not in use for now. Tenant-config-details has theme properties
     * @param createCustomThemeDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/custom-theme')
    async createAndSetCustomTheme(@Body() createCustomThemeDto: CreateCustomThemeDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndSetCustomTheme(+tenantId, createCustomThemeDto);
    }

    /**
     * Unset custom theme for tenant. This is not in use for now. Tenant-config-details has theme properties
     * @param tenantId 
     * @returns 
     */
    @Delete(':tenantId/custom-theme')
    unsetCustomThemeById(@Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.unsetCustomThemeById(+tenantId);
    }

    //3. Team members

    /**
     * Associate a user with a tenant and with tenant-team roles specified
     * @param createTenantTeamRolesDto 
     * @param tenantId 
     * @param userId 
     * @returns 
     */
    @Patch(':tenantId/team-member/:userId')
    setTeamMemberById(@Body() createTenantTeamRolesDto: CreateTenantTeamRolesDto, @Param('tenantId') tenantId: string, @Param('userId') userId: string): Promise<void> {
        return this.tenantsService.setTeamMemberById(+tenantId, +userId, createTenantTeamRolesDto);
    }

    /**
     * Create a new tenant team and associate with a tenant
     * @param createTenantTeamDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/team-member')
    createAndSetTeamMember(@Body() createTenantTeamDto: CreateTenantTeamDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndSetTeamMember(+tenantId, createTenantTeamDto);
    }

    /**
     * Dissociate a user from tenant as team member
     * @param tenantId 
     * @param userId 
     * @returns 
     */
    @Delete(':tenantId/team-member/:userId')
    deleteTeamMemberById(@Param('tenantId') tenantId: string, @Param('userId') userId: string): Promise<DeleteResult> {
        return this.tenantsService.deleteTeamMemberById(+tenantId, +userId);
    }

    //4. TenantAccountOfficers
    /**
     * Associate a user with tenant as account officer with a given role
     * @param createTenantAccountOfficerDto 
     * @param tenantId 
     * @param userId 
     * @returns 
     */
    @Patch(':tenantId/account-officer/:userId')
    setTenantAccountOfficerById(@Body() createTenantAccountOfficerDto: CreateTenantAccountOfficerDto, @Param('tenantId') tenantId: string, @Param('userId') userId: string): Promise<void> {
        return this.tenantsService.setTenantAccountOfficerById(+tenantId, +userId, createTenantAccountOfficerDto);
    }

    /**
     * Create a new tenant-account officer and associate with a tenant
     * @param createTenantAccountOfficerDto 
     * @param tenantId 
     * @returns 
     */
    @Patch(':tenantId/account-officer')
    createAndSetAccountOfficer(@Body() createTenantAccountOfficerDto: CreateTenantAccountOfficerDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndSetTenantAccountOfficer(+tenantId, createTenantAccountOfficerDto);
    }

    /**
     * Dissociate a user from tenant as account officer
     * @param tenantId 
     * @param userId 
     * @returns 
     */
    @Delete(':tenantId/account-officer/:userId')
    deleteTenantAccountOfficerById(@Param('tenantId') tenantId: string, @Param('userId') userId: string): Promise<DeleteResult> {
        return this.tenantsService.deleteTenantAccountOfficerById(+tenantId, +userId);
    }

    //5. Theme
    /**
     * Associate a theme with tenant by id. Not in use yet. Use tenant config details instead.
     * @param tenantId 
     * @param themeId 
     * @returns 
     */
    @Patch(':tenantId/theme/:themeId')
    addThemeById(@Param('tenantId') tenantId: string, @Param('themeId') themeId: string): Promise<void> {
        return this.tenantsService.addThemeById(+tenantId, +themeId);
    }

    /**
     * Create a new theme and associate with tenant. Not in use yet. Use tenant config details instead.
     * @param createThemeDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/theme')
    async createAndAddTheme(@Body() createThemeDto: CreateThemeDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndAddTheme(+tenantId, createThemeDto);
    }

    /**
     * Dissociate a theme from tenant by Id. Not in use yet. Use tenant config details instead.
     * @param tenantId 
     * @param themeId 
     * @returns 
     */
    @Delete(':tenantId/theme/:themeId')
    removeThemeById(@Param('tenantId') tenantId: string, @Param('themeId') themeId: string): Promise<void> {
        return this.tenantsService.removeThemeById(+tenantId, +themeId);
    }

    //6. Billings
    /**
     * Associate billing with tenant by id.
     * @param tenantId 
     * @param billingId 
     * @returns 
     */
    @Patch(':tenantId/billing/:billingId')
    addBillingById(@Param('tenantId') tenantId: string, @Param('billingId') billingId: string): Promise<void> {
        return this.tenantsService.addBillingById(+tenantId, +billingId);
    }

    /**
     * Create a new billing and associate with tenant
     * @param createBillingDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/billing')
    async createAndAddBilling(@Body() createBillingDto: CreateBillingDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndAddBilling(+tenantId, createBillingDto);
    }

    /**
     * Dissociate a billing from tenant by id
     * @param tenantId 
     * @param billingId 
     * @returns 
     */
    @Delete(':tenantId/billing/:billingId')
    removeBillingById(@Param('tenantId') tenantId: string, @Param('billingId') billingId: string): Promise<void> {
        return this.tenantsService.removeBillingById(+tenantId, +billingId);
    }

    //7. Configuration Detail
    /**
     * Set tenant configuration detail by id
     * @param tenantId 
     * @param configurationDetailId 
     * @returns 
     */
    @Patch(':tenantId/configuration-detail/:configurationDetailId')
    setTenantConfigurationDetailById(@Param('tenantId') tenantId: string, @Param('configurationDetailId') configurationDetailId: string): Promise<void> {
        return this.tenantsService.setTenantConfigDetailById(+tenantId, +configurationDetailId);
    }

    /**
     * Unset tenant configuration detail by id
     * @param tenantId 
     * @returns 
     */
    @Delete(':tenantId/configuration-detail')
    unsetTenantConfigurationDetailById(@Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.unsetTenantConfigDetailById(+tenantId);
    }

    /**
     * Create and set tenant configuration detail, specifying regionId, regionUniqueName and tenantId
     * @param createTenantConfigDetailDto 
     * @param tenantId 
     * @returns 
     */
    @Post(':tenantId/configuration-detail')
    createAndSetTenantConfigDetail(@Body() createTenantConfigDetailDto: CreateTenantConfigDetailDto, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantsService.createAndSetTenantConfigDetail(+tenantId, createTenantConfigDetailDto);
    }

    //finders
    /**
     * Get active tenants of an account officer
     * @param userId
     */
    @Get('account-officer/:userId/tenants')
    getActiveTenantsByAccountOfficer(@Param('userId') userId: string, @Query() query: string) {
        const active: boolean = query['active'] as boolean || false;
        return this.tenantsService.getActiveTenantsByAccountOfficer(+userId, active);
    }

    /**
     * Upload logo for tenant
     * @param tenantId 
     * @param req 
     * @param reply 
     * @returns 
     */
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Tenant logo',
        type: FileUploadDto,
    })
    @Post(':tenantId/logo')
    uploadTenantLogo(@Param('tenantId') tenantId: string, @Req() req: Request, @Res() reply: Reply): Promise<void> {
        return this.tenantsService.setTenantLogo(+tenantId, req, reply);
    }

    /**
     * Get tenant logo
     * @param tenantId 
     * @param reply 
     * @returns 
     */
    @Get(':tenantId/logo')
    async getTenantLogo(@Param('tenantId') tenantId: string, @Res() reply: Reply) {
        return this.tenantsService.getTenantLogo(+tenantId, reply);
    }

    /**
     * Set Tenant Status in Redis. Status must be 'active' | 'owing' | 'suspended'
     * @param tenantId 
     * @param status 
     * @returns 
     */
    @Patch(':tenantId/status/:status')
    async setTenantStatusInRedisByTenantId(@Param('tenantId') tenantId: string, @Param('status') status: TenantStatus){
        return this.tenantsService.setTenantStatusInRedisByTenantId(+tenantId, status)
    }
}

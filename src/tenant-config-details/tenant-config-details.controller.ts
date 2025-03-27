import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, Put } from '@nestjs/common';
import { TenantConfigDetailsService } from './tenant-config-details.service';
import { CreateTenantConfigDetailDto } from './dto/create-tenant-config-detail.dto';
import { UpdateTenantConfigDetailDto } from './dto/update-tenant-config-detail.dto';
import { TenantConfigDetail } from './entities/tenant-config-detail.entity';
import { InsertResult, UpdateResult } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('tenant-config-details')
@Controller('tenant-config-details')
export class TenantConfigDetailsController {
  constructor(private readonly tenantConfigDetailsService: TenantConfigDetailsService) {}

    /**
     * 
     * @param createTenantConfigDetailDto 
     * Handle Post request for create
     */
     @Post()
     create(@Body() createTenantConfigDetailDto: CreateTenantConfigDetailDto): Promise<TenantConfigDetail> {
         return this.tenantConfigDetailsService.create(createTenantConfigDetailDto);
     }
 
     @Post('insert')
     insert(@Body() createTenantConfigDetailDtos: CreateTenantConfigDetailDto[]): Promise<InsertResult> {
         return this.tenantConfigDetailsService.insertTenantConfigDetails(createTenantConfigDetailDtos);
     }
 
     /**
      * 
      * @param id id of tenantConfigDetail to be updated
      * @param updateTenantConfigDetailDto new content
      * Handle Put request for 
      */
     @Patch(':id')
     update(@Param('id') id: string, @Body() updateTenantConfigDetailDto: UpdateTenantConfigDetailDto): Promise<UpdateResult> {
         //console.log(JSON.stringify(updateTenantConfigDetailDto))
         return this.tenantConfigDetailsService.update(+id, updateTenantConfigDetailDto);
     }
 
     /**
      * 
      * @param tenantConfigDetail 
      * Non-partial update. Takes a full tenantConfigDetail without param. Use this if data sent includes relations.
      */
     @Put()
     save(@Body() tenantConfigDetail: TenantConfigDetail): Promise<TenantConfigDetail> {
         return this.tenantConfigDetailsService.save(tenantConfigDetail);
     }
 
 
     @Delete(':id')
     delete(@Param('id') id: string) {
         return this.tenantConfigDetailsService.delete(+id);
     }
 
     /**READ section */
     /**
      * Handle Get request for find
      */
     @Get()
     findAll(@Query() query: string): Promise<[TenantConfigDetail[], number]> {
 
         for (const queryKey of Object.keys(query)) {
             if (queryKey == "findOptions") {
                 return this.tenantConfigDetailsService.findAllWithOptions(decodeURI(query[queryKey]));
             }
         }
         //console.log('inside findAll');
         return this.tenantConfigDetailsService.findAll();
     }
 
     /**
      * 
      * @param id 
      * Handle Get request for find by id
      */
     @Get(':id')
     findOne(@Param('id') id: string): Promise<TenantConfigDetail> {
         return this.tenantConfigDetailsService.findOne(+id);
     }

     // relationships. These should be used sparingly and carefully from here.
     //Better to operate instead from tenant
     /**
      * Set tenant for a given tenant config detail
      * @param tenantConfigDetailId 
      * @param tenantId 
      * @returns 
      */
     /*
     @Patch(':tenantConfigDetailId/tenant/:tenantId')
     setTenantById(@Param('tenantConfigDetailId') tenantConfigDetailId: string, @Param('tenantId') tenantId: string): Promise<void> {
        return this.tenantConfigDetailsService.setTenantById(+tenantConfigDetailId, +tenantId);
     }
     */

     /**
      * Unset tenant for a given tenant config detail
      * @param tenantConfigDetailId 
      * @returns 
      */
     /*
     @Delete(':tenantConfigDetailId/tenant')
     unsetTenantById(@Param('tenantConfigDetailId') tenantConfigDetailId: string): Promise<void> {
        return this.tenantConfigDetailsService.unsetTenantById(+tenantConfigDetailId);
     }
     */

     /**
      * set region for a given tenant config detail
      * @param tenantConfigDetailId 
      * @param regionId 
      * @returns 
      */
     /*
     @Patch(':tenantConfigDetailId/region/:regionId')
     setRegionById(@Param('tenantConfigDetailId') tenantConfigDetailId: string, @Param('regionId') regionId: string): Promise<void> {
        return this.tenantConfigDetailsService.setRegionById(+tenantConfigDetailId, +regionId);
     }
     */

     /**
      * Unset region for a give tenant config detail
      * @param tenantConfigDetailId 
      * @returns 
      */
     /*
     @Delete(':tenantConfigDetailId/region')
     unsetRegionById(@Param('tenantConfigDetailId') tenantConfigDetailId: string): Promise<void> {
        return this.tenantConfigDetailsService.unsetRegionById(+tenantConfigDetailId);
     }
     */

 }

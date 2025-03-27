import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query, ParseArrayPipe } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Region } from './entities/region.entity';
import { InsertResult, UpdateResult } from 'typeorm';
import { TenantConfigDetail } from 'src/tenant-config-details/entities/tenant-config-detail.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) { }

  /**
    * 
    * @param createRegionDto 
    * Handle Post request for region create.
    * A region should only be created (i.e. registered) when the environment has been setup, namely database, redis, elasticsearch, rootfilesystem
    */
  @Post()
  create(@Body() createRegionDto: CreateRegionDto): Promise<Region> {
    return this.regionsService.create(createRegionDto);
  }

  /**
   * For multiple inserts. Not in use yet because, I am yet to implement password encryptions
   * @param createRegionDtos 
   * @returns 
   */
  /*
  @Post('insert')
  insert(@Body() createRegionDtos: CreateRegionDto[]): Promise<InsertResult> {
    return this.regionsService.insertRegions(createRegionDtos);
  }
  */

  /**
   * 
   * @param id id of region to be updated
   * @param updateRegionDto new content
   * Handle Put request for 
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto): Promise<UpdateResult> {
    //console.log(JSON.stringify(updateRegionDto))
    return this.regionsService.update(+id, updateRegionDto);
  }

  /**
   * 
   * @param region 
   * Non-partial update. Takes a full region without param. Use this if data sent includes relations.
   */
  @Put()
  save(@Body() region: Region): Promise<Region> {
    return this.regionsService.save(region);
  }


  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.regionsService.delete(+id);
  }

  /**READ section */
  /**
   * Handle Get request for find. Returns regions found without the count
   */
  @Get()
  findAll(@Query() query: string): Promise<Region[]> {

    for (const queryKey of Object.keys(query)) {
      if (queryKey == "findOptions") {
        return this.regionsService.findAllWithOptions(decodeURI(query[queryKey]));
      }
    }
    return this.regionsService.findAll();
  }

  /**
   * 
   * @param id 
   * Handle Get request for find by id
   */
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Region> {
    return this.regionsService.findOne(+id);
  }

  // relationships
  /**
   * Add tenant config detail to a region by id.
   * @param regionId 
   * @param tenantConfigDetailId 
   * @returns 
   */
  @Patch(':regionId/tenant-config-detail/:tenantConfigDetailId')
  addTenantConfigDetailById(@Param('regionId') regionId: string, @Param('tenantConfigDetailId') tenantConfigDetailId: string): Promise<void> {
    return this.regionsService.addTenantConfigDetailById(+regionId, +tenantConfigDetailId)
  }

  /**
   * Add tenant config details to a region by Id.
   * The URL should include Query String named tenantConfigDetailIds with id numbers separated by commas.
   * E.g. ?tenantConfigDetailIds=1,2,3
   * @param regionId 
   * @param tenantConfigDetailIds 
   * @returns 
   */
  @Patch(':regionId/tenant-config-details')
  addTenantConfigDetailsById(@Param('regionId') regionId: string, @Query('tenantConfigDetailIds', new ParseArrayPipe({ items: Number, separator: ',' })) tenantConfigDetailIds: number[]): Promise<TenantConfigDetail[]> {
    return this.regionsService.addTenantConfigDetailsById(+regionId, tenantConfigDetailIds)
  }

  /**
   * Remove tenant config detail from region by Id
   * @param regionId 
   * @param tenantConfigDetailId 
   * @returns 
   */
  @Delete(':regionId/tenant-config-detail/:tenantConfigDetailId')
  removeTenantConfigDetailById(@Param('regionId') regionId: string, @Param('tenantConfigDetailId') tenantConfigDetailId: string): Promise<UpdateResult> {
    return this.regionsService.removeTenantConfigDetailById(+regionId, +tenantConfigDetailId);
  }

  /**
   * Remove multiple tenant config details from region by id. 
   * The URL should include Query String named tenantConfigDetailIds with id numbers separated by commas.
   * @param regionId 
   * @param tenantConfigDetailIds 
   * @returns 
   */
  @Delete(':regionId/tenant-config-details')
  removeTenantConfigDetailsById(@Param('regionId') regionId: string, @Query('tenantConfigDetailIds', new ParseArrayPipe({ items: Number, separator: ',' })) tenantConfigDetailIds: number[]) {
    return this.regionsService.removeTenantConfigDetailsById(+regionId, tenantConfigDetailIds);
  }

  @Get('get-tenant-assignable-regions-info')
  getTenantAssignableRegionsInfo(): Promise<Region[]>{
    return this.regionsService.getTenantAssignableRegionsInfo();
  }

}

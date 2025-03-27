import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Connection, DeleteResult, InsertResult, Repository, UpdateResult } from 'typeorm';
import { Region } from './entities/region.entity';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { PG_UNIQUE_CONSTRAINT_VIOLATION } from 'src/global/error.codes';
import { TenantConfigDetail } from 'src/tenant-config-details/entities/tenant-config-detail.entity';
import { CryptoTools } from 'src/global/app.tools';


@Injectable()
export class RegionsService {

  constructor(
    @InjectRepository(Region) private regionRepository: Repository<Region>,
    @InjectConnection('default')//You can inject connection by name. See https://docs.nestjs.com/techniques/database#multiple-databases
    private connection: Connection
  ) { }

  /**
   * A region should only be registered when the environment has been setup, namely database, redis, elasticsearch, rootfilesystem
   * @param createRegionDto 
   * @returns 
   */
  async create(createRegionDto: CreateRegionDto): Promise<Region> {
    try {
      const newRegion = this.regionRepository.create(createRegionDto);
      //TODO:encrypt passwords before save
      if (newRegion.webServerProperties && newRegion.webServerProperties.password && newRegion.webServerProperties.password.content)
        newRegion.webServerProperties.password = await CryptoTools.encrypt(newRegion.webServerProperties.password.content);

      if (newRegion.dbProperties && newRegion.dbProperties.password.content)
        newRegion.dbProperties.password = await CryptoTools.encrypt(newRegion.dbProperties.password.content);

      if (newRegion.elasticSearchProperties && newRegion.elasticSearchProperties.password.content)
        newRegion.elasticSearchProperties.password = await CryptoTools.encrypt(newRegion.elasticSearchProperties.password.content);

      if (newRegion.redisProperties && newRegion.redisProperties.password.content)
        newRegion.redisProperties.password = await CryptoTools.encrypt(newRegion.redisProperties.password.content);

      if (newRegion.rootFileSystem && newRegion.rootFileSystem.password && newRegion.rootFileSystem.password.content)
        newRegion.rootFileSystem.password = await CryptoTools.encrypt(newRegion.rootFileSystem.password.content)

      if (newRegion.smtpAuth && newRegion.smtpAuth.smtpPword && newRegion.smtpAuth.smtpPword.content)
        newRegion.smtpAuth.smtpPword = await CryptoTools.encrypt(newRegion.smtpAuth.smtpPword.content);

      const region = await this.regionRepository.save(newRegion);
      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])
      return region;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem with Region creation: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with Region creation: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  /**
   * insert using query builder - more efficient than save. Can be used for single or bulk save. See https://github.com/typeorm/typeorm/blob/master/docs/insert-query-builder.md
   * Do not use as no encryption has been implemented
   * @param regions 
   * @returns 
   */

  async insertRegions(regions: CreateRegionDto[]): Promise<InsertResult> {//Regions is an array of objects
    try {
      const insertResult = await this.regionRepository.createQueryBuilder()
        .insert()
        .into(Region)
        .values(regions)
        .execute();

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"]);
      return insertResult;

    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem with Region(s) insertion: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with Region(s) insertion: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async update(id: number, region: UpdateRegionDto): Promise<UpdateResult> {
    try {

      const region_: Region = region as Region;

      if (region_.webServerProperties && region_.webServerProperties.password && region_.webServerProperties.password.content)
        region_.webServerProperties.password = await CryptoTools.encrypt(region_.webServerProperties.password.content);

      if (region_.dbProperties && region_.dbProperties.password.content)
        region_.dbProperties.password = await CryptoTools.encrypt(region_.dbProperties.password.content);

      if (region_.elasticSearchProperties && region_.elasticSearchProperties.password.content)
        region_.elasticSearchProperties.password = await CryptoTools.encrypt(region_.elasticSearchProperties.password.content);

      if (region_.redisProperties && region_.redisProperties.password.content)
        region_.redisProperties.password = await CryptoTools.encrypt(region_.redisProperties.password.content);

      if (region_.rootFileSystem && region_.rootFileSystem.password && region_.rootFileSystem.password.content)
        region_.rootFileSystem.password = await CryptoTools.encrypt(region_.rootFileSystem.password.content)

      if (region_.smtpAuth && region_.smtpAuth.smtpPword && region_.smtpAuth.smtpPword.content)
        region_.smtpAuth.smtpPword = await CryptoTools.encrypt(region_.smtpAuth.smtpPword.content);

      const updateResult = await this.regionRepository.update(id, { ...region_ })

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])

      return updateResult;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating region data: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating region data: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async save(region: Region): Promise<Region> {
    try {

      if (region.webServerProperties && region.webServerProperties.password && region.webServerProperties.password.content)
        region.webServerProperties.password = await CryptoTools.encrypt(region.webServerProperties.password.content);

      if (region.dbProperties && region.dbProperties.password.content)
        region.dbProperties.password = await CryptoTools.encrypt(region.dbProperties.password.content);

      if (region.elasticSearchProperties && region.elasticSearchProperties.password.content)
        region.elasticSearchProperties.password = await CryptoTools.encrypt(region.elasticSearchProperties.password.content);

      if (region.redisProperties && region.redisProperties.password.content)
        region.redisProperties.password = await CryptoTools.encrypt(region.redisProperties.password.content);

      if (region.rootFileSystem && region.rootFileSystem.password && region.rootFileSystem.password.content)
        region.rootFileSystem.password = await CryptoTools.encrypt(region.rootFileSystem.password.content)

      if (region.smtpAuth && region.smtpAuth.smtpPword && region.smtpAuth.smtpPword.content)
        region.smtpAuth.smtpPword = await CryptoTools.encrypt(region.smtpAuth.smtpPword.content);

      const updatedRegion = await this.regionRepository.save({ ...region });

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])
      return updatedRegion;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating region: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating region: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async updateRegion(regionId: number, updateRegionDto: UpdateRegionDto): Promise<UpdateResult> {
    try {
      const region_: Region = updateRegionDto as Region;

      if (region_.webServerProperties && region_.webServerProperties.password && region_.webServerProperties.password.content)
        region_.webServerProperties.password = await CryptoTools.encrypt(region_.webServerProperties.password.content);

      if (region_.dbProperties && region_.dbProperties.password.content)
        region_.dbProperties.password = await CryptoTools.encrypt(region_.dbProperties.password.content);

      if (region_.elasticSearchProperties && region_.elasticSearchProperties.password.content)
        region_.elasticSearchProperties.password = await CryptoTools.encrypt(region_.elasticSearchProperties.password.content);

      if (region_.redisProperties && region_.redisProperties.password.content)
        region_.redisProperties.password = await CryptoTools.encrypt(region_.redisProperties.password.content);

      if (region_.rootFileSystem && region_.rootFileSystem.password && region_.rootFileSystem.password.content)
        region_.rootFileSystem.password = await CryptoTools.encrypt(region_.rootFileSystem.password.content)

      if (region_.smtpAuth && region_.smtpAuth.smtpPword && region_.smtpAuth.smtpPword.content)
        region_.smtpAuth.smtpPword = await CryptoTools.encrypt(region_.smtpAuth.smtpPword.content);

      const updateResults = await this.regionRepository.createQueryBuilder()
        .update(Region)
        .set({ ...updateRegionDto })
        .where("id = :id", { id: regionId })
        .execute();

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])

      return updateResults;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating region: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating region: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }


  /* DELETE section */

  async delete(id: number): Promise<void> {
    try {
      await this.regionRepository.delete(id);

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting region data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //query builder equivalent of delete shown above
  async deleteRegion(regionId: number): Promise<DeleteResult> {
    try {
      const deleteResult = await this.regionRepository.createQueryBuilder()
        .delete()
        .from(Region)
        .where("id = :id", { id: regionId })
        .execute();

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])
      return deleteResult;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting region data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 
   * @param region 
   * Remove the Region specifed. Returns Region removed.
   */
  async remove(region: Region): Promise<Region> {
    try {
      const deletedRegion = await this.regionRepository.remove(region);

      //remove any cache named regions
      await this.connection.queryResultCache.remove(["regions", "tenant-assignable-regions-info"])
      return deletedRegion;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting region data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  /** READ section
   */
  /**
   * You can set options e.g. fields, relations to be returned etc. See https://typeorm.io/#/find-options
   */
  async findAllWithOptions(findOptions: string): Promise<Region[]> {
    try {
      return await this.regionRepository.find(JSON.parse(findOptions));
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing regions data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  /**
   * By default, findAll here returns no count, so that it can be cached
   * @returns 
   */
  async findAll(): Promise<Region[]> {
    try {
      return await this.regionRepository.find({
        cache: {
          id: "regions",
          milliseconds: 25000
        }
      });
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing regions data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAllWithCount(): Promise<[Region[], number]> {
    try {
      return await this.regionRepository.findAndCount();
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing regions data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findRegionByName(regionName: string): Promise<Region> {
    return await this.regionRepository.createQueryBuilder("region")
      .where("region.name = :regionName", { regionName })
      .getOne()
  }

  //Info getters for selection dropdown in clients. Helps to avoid overfetching, by selecting only the fields that are needed for the info
  //cache and clear cache with relevant criteria e.g. when a new tenant is assigned a region, the cache below should be cleared

  async getTenantAssignableRegionsInfo(): Promise<Region[]> {
    return await this.regionRepository.createQueryBuilder("region")
      .select("region.id")
      .addSelect("region.rootDomainName")
      .addSelect("region.name")
      .addSelect("region.description")
      .addSelect("region.country")
      .addSelect("region.city")
      .addSelect("region.tenantCountCapacity")
      .loadRelationCountAndMap("region.tenantCount", "region.tenantConfigDetails")
      .cache({
        id: "tenant-assignable-regions-info",
        milliseconds: 25000
      })
      .getMany()
  }
  /**
   * 
   * @param id 
   * find one by id
   */
  async findOne(id: number): Promise<Region> {
    try {
      return await this.regionRepository.findOne(id);
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing region data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }

  /*Let's work on functions to set/add and unset/remove relations. set/unset applies to x-to-one and add/remove applies to x-to-many */
  async addTenantConfigDetailById(regionId: number, tenantConfigDetailId: number): Promise<void> {
    try {
      return await this.regionRepository.createQueryBuilder()
        .relation(Region, "tenantConfigDetails")
        .of(regionId)
        .add(tenantConfigDetailId)
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem adding tenantConfigDetail to region: ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with adding tenantConfigDetail to region: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async addTenantConfigDetailsById(regionId: number, tenantConfigDetailIds: number[]): Promise<TenantConfigDetail[]> {
    try {
      await this.regionRepository.createQueryBuilder()
        .relation(Region, "tenantConfigDetails")
        .of(regionId)
        .add(tenantConfigDetailIds)
      //return the region tenantConfigDetails modified for redisplay
      const region = await this.regionRepository.findOne(regionId, { relations: ['tenantConfigDetails'] });
      return region.tenantConfigDetails;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem adding tenantConfigDetails to region: ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with adding tenantConfigDetails to region: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async removeTenantConfigDetailById(regionId: number, tenantConfigDetailId: number): Promise<UpdateResult> {
    try {
      await this.regionRepository.createQueryBuilder()
        .relation(Region, "tenantConfigDetails")
        .of(regionId)
        .remove(tenantConfigDetailId)
      //return the region tenantConfigDetails modified for redisplay
      //const region = await this.regionRepository.findOne(regionId, { relations: ['tenantConfigDetails'] });
      //return region.tenantConfigDetails;
      return; //too heavy to return above. I did that for user roles which will not be too heavy
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem removing tenantConfigDetail from region: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async removeTenantConfigDetailsById(regionId: number, tenantConfigDetailIds: number[]): Promise<UpdateResult> {
    try {
      await this.regionRepository.createQueryBuilder()
        .relation(Region, "tenantConfigDetails")
        .of(regionId)
        .remove(tenantConfigDetailIds)
      //return the region tenantConfigDetails modified for redisplay
      //const region = await this.regionRepository.findOne(regionId, { relations: ['tenantConfigDetails'] });
      //return region.tenantConfigDetails;
      return;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem removing tenantConfigDetails from region: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}

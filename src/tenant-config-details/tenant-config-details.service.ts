import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { CryptoTools } from '../global/app.tools';
import { PG_UNIQUE_CONSTRAINT_VIOLATION } from 'src/global/error.codes';
import { Connection, DeleteResult, InsertResult, Repository, UpdateResult } from 'typeorm';
import { CreateTenantConfigDetailDto } from './dto/create-tenant-config-detail.dto';
import { UpdateTenantConfigDetailDto } from './dto/update-tenant-config-detail.dto';
import { TenantConfigDetail } from './entities/tenant-config-detail.entity';

@Injectable()
export class TenantConfigDetailsService {

  constructor(
    @InjectRepository(TenantConfigDetail) private tenantConfigDetailRepository: Repository<TenantConfigDetail>,
    @InjectConnection('default')//You can inject connection by name. See https://docs.nestjs.com/techniques/database#multiple-databases
    private connection: Connection
  ) { }

  async create(createTenantConfigDetailDto: CreateTenantConfigDetailDto): Promise<TenantConfigDetail> {
    try {
      const newTenantConfigDetail = this.tenantConfigDetailRepository.create(createTenantConfigDetailDto);
      
      //TODO:encrypt passwords before save
      if (newTenantConfigDetail.webServerProperties && newTenantConfigDetail.webServerProperties.password && newTenantConfigDetail.webServerProperties.password.content)
        newTenantConfigDetail.webServerProperties.password = await CryptoTools.encrypt(newTenantConfigDetail.webServerProperties.password.content);

      if (newTenantConfigDetail.dbProperties && newTenantConfigDetail.dbProperties.password.content)
        newTenantConfigDetail.dbProperties.password = await CryptoTools.encrypt(newTenantConfigDetail.dbProperties.password.content);

      if (newTenantConfigDetail.elasticSearchProperties && newTenantConfigDetail.elasticSearchProperties.password.content)
        newTenantConfigDetail.elasticSearchProperties.password = await CryptoTools.encrypt(newTenantConfigDetail.elasticSearchProperties.password.content);

      if (newTenantConfigDetail.redisProperties && newTenantConfigDetail.redisProperties.password.content)
        newTenantConfigDetail.redisProperties.password = await CryptoTools.encrypt(newTenantConfigDetail.redisProperties.password.content);

      if (newTenantConfigDetail.rootFileSystem && newTenantConfigDetail.rootFileSystem.password.content)
        newTenantConfigDetail.rootFileSystem.password = await CryptoTools.encrypt(newTenantConfigDetail.rootFileSystem.password.content)

      if (newTenantConfigDetail.smtpAuth && newTenantConfigDetail.smtpAuth.smtpPword.content)
        newTenantConfigDetail.smtpAuth.smtpPword = await CryptoTools.encrypt(newTenantConfigDetail.smtpAuth.smtpPword.content);

      const tenantConfigDetail = await this.tenantConfigDetailRepository.save(newTenantConfigDetail);
      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])
      return tenantConfigDetail;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem with TenantConfigDetail creation: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with TenantConfigDetail creation: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  /**
   * insert using query builder - more efficient than save. Can be used for single or bulk save. See https://github.com/typeorm/typeorm/blob/master/docs/insert-query-builder.md
   * Do not use yet because of no encryption
   * @param tenantConfigDetails 
   * @returns 
   */
  async insertTenantConfigDetails(tenantConfigDetails: CreateTenantConfigDetailDto[]): Promise<InsertResult> {//TenantConfigDetails is an array of objects
    try {
      const insertResult = await this.tenantConfigDetailRepository.createQueryBuilder()
        .insert()
        .into(TenantConfigDetail)
        .values(tenantConfigDetails)
        .execute();

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"]);
      return insertResult;

    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem with TenantConfigDetail(s) insertion: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem with TenantConfigDetail(s) insertion: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async update(id: number, tenantConfigDetail: UpdateTenantConfigDetailDto): Promise<UpdateResult> {
    try {

      const tenantConfigDetail_: TenantConfigDetail = tenantConfigDetail as TenantConfigDetail;

      if (tenantConfigDetail_.webServerProperties && tenantConfigDetail_.webServerProperties.password && tenantConfigDetail_.webServerProperties.password.content)
        tenantConfigDetail_.webServerProperties.password = await CryptoTools.encrypt(tenantConfigDetail_.webServerProperties.password.content);

      if (tenantConfigDetail_.dbProperties && tenantConfigDetail_.dbProperties && tenantConfigDetail_.dbProperties.password.content)
        tenantConfigDetail_.dbProperties.password = await CryptoTools.encrypt(tenantConfigDetail_.dbProperties.password.content);

      if (tenantConfigDetail_.elasticSearchProperties && tenantConfigDetail_.elasticSearchProperties && tenantConfigDetail_.elasticSearchProperties.password.content)
        tenantConfigDetail_.elasticSearchProperties.password = await CryptoTools.encrypt(tenantConfigDetail_.elasticSearchProperties.password.content);

      if (tenantConfigDetail_.redisProperties && tenantConfigDetail_.redisProperties && tenantConfigDetail_.redisProperties.password.content)
        tenantConfigDetail_.redisProperties.password = await CryptoTools.encrypt(tenantConfigDetail_.redisProperties.password.content);

      if (tenantConfigDetail_.rootFileSystem && tenantConfigDetail_.rootFileSystem && tenantConfigDetail_.rootFileSystem.password.content)
        tenantConfigDetail_.rootFileSystem.password = await CryptoTools.encrypt(tenantConfigDetail_.rootFileSystem.password.content)

      if (tenantConfigDetail_.smtpAuth && tenantConfigDetail_.smtpAuth && tenantConfigDetail_.smtpAuth.smtpPword.content)
        tenantConfigDetail_.smtpAuth.smtpPword = await CryptoTools.encrypt(tenantConfigDetail_.smtpAuth.smtpPword.content);

      const updateResult = await this.tenantConfigDetailRepository.update(id, { ...tenantConfigDetail })

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])

      return updateResult;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating tenantConfigDetail data: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating tenantConfigDetail data: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async save(tenantConfigDetail: TenantConfigDetail): Promise<TenantConfigDetail> {
    try {
      if (tenantConfigDetail.webServerProperties && tenantConfigDetail.webServerProperties.password && tenantConfigDetail.webServerProperties.password.content)
        tenantConfigDetail.webServerProperties.password = await CryptoTools.encrypt(tenantConfigDetail.webServerProperties.password.content);

      if (tenantConfigDetail.dbProperties && tenantConfigDetail.dbProperties && tenantConfigDetail.dbProperties.password.content)
        tenantConfigDetail.dbProperties.password = await CryptoTools.encrypt(tenantConfigDetail.dbProperties.password.content);

      if (tenantConfigDetail.elasticSearchProperties && tenantConfigDetail.elasticSearchProperties && tenantConfigDetail.elasticSearchProperties.password.content)
        tenantConfigDetail.elasticSearchProperties.password = await CryptoTools.encrypt(tenantConfigDetail.elasticSearchProperties.password.content);

      if (tenantConfigDetail.redisProperties && tenantConfigDetail.redisProperties && tenantConfigDetail.redisProperties.password.content)
        tenantConfigDetail.redisProperties.password = await CryptoTools.encrypt(tenantConfigDetail.redisProperties.password.content);

      if (tenantConfigDetail.rootFileSystem && tenantConfigDetail.rootFileSystem && tenantConfigDetail.rootFileSystem.password.content)
        tenantConfigDetail.rootFileSystem.password = await CryptoTools.encrypt(tenantConfigDetail.rootFileSystem.password.content)

      if (tenantConfigDetail.smtpAuth && tenantConfigDetail.smtpAuth && tenantConfigDetail.smtpAuth.smtpPword.content)
        tenantConfigDetail.smtpAuth.smtpPword = await CryptoTools.encrypt(tenantConfigDetail.smtpAuth.smtpPword.content);

      const updatedTenantConfigDetail = await this.tenantConfigDetailRepository.save({ ...tenantConfigDetail });

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])
      return updatedTenantConfigDetail;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating tenantConfigDetail: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating tenantConfigDetail: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  async updateTenantConfigDetail(tenantConfigDetailId: number, updateTenantConfigDetailDto: UpdateTenantConfigDetailDto): Promise<UpdateResult> {
    try {
      const updateResults = await this.tenantConfigDetailRepository.createQueryBuilder()
        .update(TenantConfigDetail)
        .set({ ...updateTenantConfigDetailDto })
        .where("id = :id", { id: tenantConfigDetailId })
        .execute();

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])

      return updateResults;
    } catch (error) {
      if (error && error.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new HttpException({
          status: HttpStatus.BAD_REQUEST,
          error: `There was a problem updating tenantConfigDetail: : ${error.message}`,
        }, HttpStatus.BAD_REQUEST)
      } else {
        throw new HttpException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `There was a problem updating tenantConfigDetail: ${error.message}`,
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }


  /* DELETE section */

  async delete(id: number): Promise<void> {
    try {
      await this.tenantConfigDetailRepository.delete(id);

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting tenantConfigDetail data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //query builder equivalent of delete shown above
  async deleteTenantConfigDetail(tenantConfigDetailId: number): Promise<DeleteResult> {
    try {
      const deleteResult = await this.tenantConfigDetailRepository.createQueryBuilder()
        .delete()
        .from(TenantConfigDetail)
        .where("id = :id", { id: tenantConfigDetailId })
        .execute();

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])
      return deleteResult;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting tenantConfigDetail data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 
   * @param tenantConfigDetail 
   * Remove the TenantConfigDetail specifed. Returns TenantConfigDetail removed.
   */
  async remove(tenantConfigDetail: TenantConfigDetail): Promise<TenantConfigDetail> {
    try {
      const deletedTenantConfigDetail = await this.tenantConfigDetailRepository.remove(tenantConfigDetail);

      //remove any cache named tenantConfigDetails
      await this.connection.queryResultCache.remove(["tenantConfigDetails"])
      return deletedTenantConfigDetail;
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem deleting tenantConfigDetail data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  /** READ section
   */
  /**
   * You can set options e.g. fields, relations to be returned etc. See https://typeorm.io/#/find-options
   */
  async findAllWithOptions(findOptions: string): Promise<[TenantConfigDetail[], number]> {
    try {
      return await this.tenantConfigDetailRepository.findAndCount(JSON.parse(findOptions));
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing tenantConfigDetails data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAll(): Promise<[TenantConfigDetail[], number]> {
    try {
      return await this.tenantConfigDetailRepository.findAndCount({
        cache: {
          id: "tenantConfigDetails",
          milliseconds: 25000
        }
      });
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing tenantConfigDetails data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 
   * @param id 
   * find one by id
   */
  async findOne(id: number): Promise<TenantConfigDetail> {
    try {
      return await this.tenantConfigDetailRepository.findOne(id);
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem accessing tenantConfigDetail data: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

  }
  
  /*Let's work on functions to set/add and unset/remove relations. set/unset applies to x-to-one and add/remove applies to x-to-many */
  async setTenantById(tenantConfigDetailId: number, tenantId: number): Promise<void> {
    try {
      return await this.tenantConfigDetailRepository.createQueryBuilder()
        .relation(TenantConfigDetail, "tenant")
        .of(tenantConfigDetailId)
        .set(tenantId)
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem with setting config detail for tenant: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unsetTenantById(tenantConfigDetailId: number): Promise<void> {
    try {
      return await this.tenantConfigDetailRepository.createQueryBuilder()
        .relation(TenantConfigDetail, "tenant")
        .of(tenantConfigDetailId)
        .set(null)
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem with unsetting config detail for tenant: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async setRegionById(tenantConfigDetailId: number, regionId: number): Promise<void> {
    try {
      return await this.tenantConfigDetailRepository.createQueryBuilder()
        .relation(TenantConfigDetail, "region")
        .of(tenantConfigDetailId)
        .set(regionId)
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem with setting region for tenant: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async unsetRegionById(tenantConfigDetailId: number): Promise<void> {
    try {
      return await this.tenantConfigDetailRepository.createQueryBuilder()
        .relation(TenantConfigDetail, "region")
        .of(tenantConfigDetailId)
        .set(null)
    } catch (error) {
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: `There was a problem with unsetting region for tenant: ${error.message}`,
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}

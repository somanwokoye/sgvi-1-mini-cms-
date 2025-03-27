import { Module } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';
import { Region } from './entities/region.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Region]), //include all the entities that will be involved in tenantConfigDetailsService. Usually, they have relationship
  ],
  controllers: [RegionsController],
  providers: [RegionsService]
})
export class RegionsModule {}

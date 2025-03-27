import { Test, TestingModule } from '@nestjs/testing';
import { TenantConfigDetailsController } from './tenant-config-details.controller';
import { TenantConfigDetailsService } from './tenant-config-details.service';

describe('TenantConfigDetailsController', () => {
  let controller: TenantConfigDetailsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantConfigDetailsController],
      providers: [TenantConfigDetailsService],
    }).compile();

    controller = module.get<TenantConfigDetailsController>(TenantConfigDetailsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

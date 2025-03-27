import { Test, TestingModule } from '@nestjs/testing';
import { TenantConfigDetailsService } from './tenant-config-details.service';

describe('TenantConfigDetailsService', () => {
  let service: TenantConfigDetailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantConfigDetailsService],
    }).compile();

    service = module.get<TenantConfigDetailsService>(TenantConfigDetailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';


/**
 * Database configuration module for reading properties from environment variables
 * Exported as DatabaseModule
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        name: 'default',
        host: configService.get('POSTGRES_HOST', 'localhost'),
        port: configService.get('POSTGRES_PORT', 5432),
        username: configService.get('POSTGRES_USER', 'postgres'),
        password: configService.get('POSTGRES_PASSWORD', 'postgres'),
        database: configService.get('POSTGRES_DB', 'sgvi-1-minicms'),
        entities: ["dist/**/*.entity{.ts,.js}"],
        synchronize: true,
        autoLoadEntities: true,
        cache: {
          type: "ioredis",
          options: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
            //sentinels: JSON.parse(process.env.REDIS_SENTINELS || `[{ "host": "localhost", "port": 26379 }, { "host": "localhost", "port": 26380 }, { "host": "localhost", "port": 26381 }]`),
            name: 'mymaster',
            timeout: 10000,
            database: 3
            //retryStrategy: (times: number) => Math.min(times * 50, 2000)
        }
      }
      })
    }),
  ],
})
export class DatabaseModule {}
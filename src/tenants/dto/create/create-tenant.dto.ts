import { IsNotEmpty } from "class-validator";
import { TenantStatus } from "src/global/custom.interfaces";
import { CreateCustomThemeDto } from "./create-custom-theme.dto"
import { CreateUserDto } from "../../../users/dto/create/create-user.dto";
import { ApiProperty } from "@nestjs/swagger";
import { CreateTenantConfigDetailDto } from "../../../tenant-config-details/dto/create-tenant-config-detail.dto";

export class CreateTenantDto{

    @ApiProperty()
    @IsNotEmpty()
    readonly name: string;

    @ApiProperty()
    @IsNotEmpty()
    readonly address: string;

    @ApiProperty({ required: false})
    readonly moreInfo?: string;

    @ApiProperty({ required: false})
    readonly logo?: string;

    @ApiProperty({ required: false})
    readonly logoMimeType?: string;

    @ApiProperty()
    @IsNotEmpty()
    readonly dateOfRegistration: Date;

    @ApiProperty({ enum: TenantStatus, required: false })
    readonly status?: TenantStatus;

    @ApiProperty({ required: false})
    readonly primaryContact?: CreateUserDto;

    @ApiProperty({ required: false})
    readonly customTheme?: CreateCustomThemeDto;

    readonly tenantConfigDetail?: CreateTenantConfigDetailDto;

    readonly regionName: string; //must be sent

    regionRootDomainName?: string; //should get it via the regionName sent, to avoid inconsistencies. 

}

export class CreateTenantDtos{
    dtos: CreateTenantDto[];
}
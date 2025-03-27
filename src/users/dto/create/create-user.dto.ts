import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { Gender } from "src/global/custom.interfaces";

//Below is for the phone field which is simple json
class PhoneDto {
    
    @ApiProperty({ required: false})
    mobile:string[];

    @ApiProperty({ required: false})
    office:string[];

    @ApiProperty({ required: false})
    home:string[];
}

export class CreateUserDto{

    @ApiProperty({required: false})
    readonly landlord: boolean;

    @ApiProperty()
    @IsNotEmpty()
    readonly firstName: string;

    @ApiProperty({ required: false})
    readonly middleName?: string;

    @ApiProperty()
    @IsNotEmpty()
    readonly lastName: string;

    @ApiProperty({ required: false})
    readonly commonName?: string;

    @ApiProperty({ required: false})
    readonly homeAddress?: string;

    @ApiProperty({ enum: Gender})
    @IsNotEmpty()
    readonly gender: Gender;

    @ApiProperty()
    @IsNotEmpty()
    readonly dateOfBirth: Date;

    @ApiProperty({ required: false})
    readonly nationality?: string;

    @ApiProperty({ required: false})
    readonly stateOfOrigin?: string;

    @ApiProperty({ required: false})
    readonly zip?: string;

    @ApiProperty({ required: false})
    readonly photo?: string; 

    @ApiProperty({ required: false})
    readonly photoMimeType?: string;

    @ApiProperty({ required: false})
    readonly isActive?: boolean;

    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    readonly primaryEmailAddress: string;

    @ApiProperty({ required: false})
    @IsEmail()
    readonly backupEmailAddress?: string;

    @ApiProperty({ required: false})
    readonly phone?: PhoneDto;

    @ApiProperty({ required: false})
    readonly isPrimaryEmailAddressVerified?: boolean;

    @ApiProperty({ required: false})
    readonly passwordSalt?: string;

    @ApiProperty()
    @IsNotEmpty()
    passwordHash: string; //not readonly because it will be replaced by hash in the insertusers function

    @ApiProperty({ required: false})
    readonly isPasswordChangeRequired?: boolean;

}

export class CreateUserDtos {
    dtos: CreateUserDto[];
}
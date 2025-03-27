import { BaseAbstractEntity } from "../../global/base-abstract.entity";
import { Column, Entity, Generated, Index, ManyToMany, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { Billing } from "../modules/billings/models/billing.entity";
import { CustomTheme } from "./custom-theme.entity";
import { Theme } from "../modules/themes/models/theme.entity";
import { User } from "../../users/models/user.entity";
import { TenantStatus } from "../../global/custom.interfaces";
import { TenantTeam } from "./tenant-team";
import { TenantAccountOfficer } from "./tenant-account-officer";
import { TenantConfigDetail } from "../../tenant-config-details/entities/tenant-config-detail.entity";
import { parsedEnv } from "../../global/app.settings";


@Entity()
@Index(["subDomainName", "regionRootDomainName"], { unique: true })
export class Tenant extends BaseAbstractEntity{
    
    @Generated("uuid")
    @Column()
    uuid: string;

    @Column({nullable: true})//A general name for the tenant.
    name: string;

    @Column({nullable: true})//used for default URL Slug e.g. tenant1.r1.peakharmony.com where r1.peakharmony.com is from the region chosen by the tenant.
    subDomainName: string; 

    //Could not set this as both nullable and unique. With two nulls, there will be constraint violation. Solution is to handle check separately
    //e.g. piosystems.com
    @Column({unique: true, nullable: true})
    customURLSlug: string

    @Column()
    address: string;

    @Column({nullable: true})
    moreInfo: string;

    @Column()
    dateOfRegistration: Date;

    @Column({nullable: true})
    logo: string; //logo file location. Use stream to send

    @Column({ nullable: true })
    logoMimeType: string; //save the encoding of uploaded file for content-type use for reply.type as shown above

    @Column({type: 'enum', enum: TenantStatus, default: TenantStatus[TenantStatus.A]})
    status: TenantStatus;

    @Column({default: false})
    active: boolean; //For quick info about whether active or not. More status details in status above

    @ManyToOne(type => User, user => user.primaryContactForWhichTenants, {cascade: true, onUpdate: "CASCADE"})
    primaryContact: User

    @OneToOne(type => CustomTheme, customTheme => customTheme.tenant, {cascade: true})
    customTheme: CustomTheme

    //a user can be a team member of multiple tenants
    @OneToMany(type => TenantTeam, tenantTeam => tenantTeam.tenant, {cascade: true})
    teamMembers: TenantTeam[] //notice the array here

    @OneToMany(type => TenantAccountOfficer, tenantAccountOfficer => tenantAccountOfficer.tenant, {cascade: true})
    tenantAccountOfficers: TenantAccountOfficer[] //notice the array here
    /**
     * Below is used to determine if the tenant has a unique schema as per multitenancy pattern.
     */
    @Column({default: true})
    uniqueSchema: boolean

    @ManyToMany(type => Theme, theme => theme.tenants)
    themes: Theme[]

    @OneToMany(type => Billing, billing => billing.tenant)
    billings: Billing[] //notice the array here

    //Connection for this tenant
    /*
    @OneToOne(type => ConnectionResource, connectionResource => connectionResource.tenant)
    connectionResource: ConnectionResource;
    */

    //Config details for tenant
    //Connection for this tenant
    @OneToOne(type => TenantConfigDetail, tenantConfigDetail => tenantConfigDetail.tenant)
    tenantConfigDetail: TenantConfigDetail;

    @Column({default: parsedEnv.DEFAULT_REGION_NAME})
    regionName: string; //denomalized region unique name called getTenantsByRegionName in tenants service

    @Column({default: parsedEnv.DEFAULT_REGION_ROOT_DOMAIN_NAME})
    regionRootDomainName: string; //denomalized so as to set up unique index with tenant name. So tenantName.rootDomainName cannot be the repeated

}
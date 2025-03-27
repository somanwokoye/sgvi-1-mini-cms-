import { BaseAbstractEntity } from "src/global/base-abstract.entity";
import { ThemeType } from "src/global/custom.interfaces";
import { Column, Entity, JoinTable, ManyToMany } from "typeorm";
import { Tenant } from "../../../models/tenant.entity";

@Entity()
export class Theme extends BaseAbstractEntity{

    @Column({unique: true})
    name: string

    @Column({type: 'enum', enum: ThemeType, default: ThemeType.standard})
    type: ThemeType

    @Column()
    description: string
    
    @Column()
    properties: string //properties to apply to type
    
    @JoinTable()
    @ManyToMany(type => Tenant, tenant => tenant.themes)
    tenants: Tenant[]
}
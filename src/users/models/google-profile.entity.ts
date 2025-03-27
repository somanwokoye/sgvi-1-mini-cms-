import { BaseAbstractEntity } from "src/global/base-abstract.entity";
import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { User } from "./user.entity";

@Entity()
export class GoogleProfile extends BaseAbstractEntity {
    @JoinColumn()
    @OneToOne(type => User, user => user.googleProfile, {onDelete: 'CASCADE'})
    user: User

    @Index()
    @Column({unique: true})
    googleId: string //this is equivalent of sub

    @Column({nullable: true})
    given_name: string

    @Column({nullable: true})
    family_name: string

    @Column({nullable: true})
    name: string

    @Column({nullable: true})
    gender: string

    @Column('simple-json',{nullable: true})
    birthdate: {month: number, day: number, year: number | null}

    @Index()
    @Column()
    email: string

    @Index()
    @Column({nullable: true})
    email_verified: boolean

    @Column({nullable: true})
    picture: string

    @Column({nullable: true})
    profile: string

    @Column({nullable: true})
    access_token: string

    @Column({nullable: true})
    refresh_token: string

    @Column()
    exp: number

    @Column({nullable: true})
    hd: string

}
export class GoogleProfileDto {

    googleId?: string //this is equivalent of sub
    given_name?: string
    family_name?: string
    name?: string
    email?: string
    email_verified?: boolean
    gender?: string
    birthdate?: {month: number, day: number, year: number | null}
    picture?: string
    profile?: string
    access_token?: string
    refresh_token?: string
    exp?: number | unknown
    hd: string | unknown
}
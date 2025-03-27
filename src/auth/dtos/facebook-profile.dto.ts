import { User } from "../../users/models/user.entity";

//This is deconstructed from entity which is deconstructed from profile
export class FacebookProfileDto {

    user?: User
    facebookId?: string
    displayName?: string
    photos?: {value: string}[]
    email?: string
    gender?: string
    name?: {familyName: string, givenName: string}
    photoUrl?: string


}
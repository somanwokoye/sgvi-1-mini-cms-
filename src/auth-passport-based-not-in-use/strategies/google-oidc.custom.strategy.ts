import { Injectable } from "@nestjs/common";
import { Client, generators, Issuer, TokenSet, UserinfoResponse } from "openid-client";
import { googleConstants } from "src/global/app.settings";
import { Request } from '../../global/custom.interfaces';
import { GoogleProfileDto } from "../dtos/google-profile.dto";
import { google } from "googleapis"; //this requires npm install googleapis
import * as bcrypt from 'bcrypt';


export const getOpenIdClient = async () => {
    const TrustIssuer = await Issuer.discover(`${googleConstants.GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER}/.well-known/openid-configuration`);
    const client: Client = new TrustIssuer.Client({
        client_id: googleConstants.GOOGLE_OAUTH2_CLIENT_ID,
        client_secret: googleConstants.GOOGLE_OAUTH2_CLIENT_SECRET
    });
    return client;
}

@Injectable()
export class GoogleOidcCustomStrategy {

    client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    /*manually create service of openid-client
    See https://developer.aliyun.com/mirror/npm/package/openid-client-request#example,
    https://openbase.io/js/openid-client/documentation#authorization-code-flow and
    google-oidc.strategy.ts
    */

    //Get authorization Url. To be called by auth/google controller endpoint
    async getAuthorizationUrl(req: Request) {

        //const client = await this.buildOpenIdClient();
        const code_verifier = generators.codeVerifier();
        req.session.set('code_verifier', code_verifier);
        //console.log(req.session['code_verifier']);
        const code_challenge = generators.codeChallenge(code_verifier);

        return this.client.authorizationUrl({
            redirect_uri: googleConstants.GOOGLE_OAUTH2_REDIRECT_URI,
            scope: googleConstants.GOOGLE_OAUTH2_SCOPE,
            code_challenge,
            code_challenge_method: 'S256',
            /*
            prompt: 'consent', //this may be required if access_type is set to be offline as below.
            access_type: 'offline', //only put this if you require refresh token.
            */

        }); // => String (URL)

    }

    //to be called by the controller endpoint auth/google/redirect
    async processCallBack(req: any) {
        const params = this.client.callbackParams(req);
        //console.log(req.session['code_verifier']);
        const tokenSet = await this.client.callback(googleConstants.GOOGLE_OAUTH2_REDIRECT_URI, params, { code_verifier: req.session.get('code_verifier') }) // => Promise

        return await this.validate(tokenSet);

    }

    //called by processCallback above
    async validate(tokenSet: TokenSet): Promise<any> {

        const userinfo: UserinfoResponse = await this.client.userinfo(tokenSet);


        //prepare to get more info from People API
        const auth = new google.auth.OAuth2(
            googleConstants.GOOGLE_OAUTH2_CLIENT_ID,
            googleConstants.GOOGLE_OAUTH2_CLIENT_SECRET
        );
        auth.setCredentials(tokenSet)//set the already received token via openid

        //call people api to get additional user info
        const { data } = await google.people({ version: "v1", auth }).people.get({
            resourceName: "people/me", //use people api to get data for the authenticated user
            personFields: "genders,birthdays,ageRanges" //see https://developers.google.com/people/api/rest/v1/people/get under personFields for more possibilities
        });

        //const id_token = tokenSet.id_token
        let access_token = tokenSet.access_token
        let refresh_token = tokenSet.refresh_token
        const { sub, hd, email, email_verified, exp, given_name, family_name, picture, profile, name } = userinfo;

        await bcrypt.hash(access_token, 10).then((hash: string) => {
            access_token = hash
        })

        if (refresh_token) {//not always available
            await bcrypt.hash(refresh_token, 10).then((hash: string) => {
                refresh_token = hash
            })
        }

        const googleProfile: GoogleProfileDto = {
            googleId: sub,
            given_name,
            family_name,
            name,
            gender: data && data.genders ? data.genders[0].value : undefined,
            birthdate: data && data.birthdays ? data.birthdays[0].date as { month: number, day: number, year: number | null } : null,
            email,
            email_verified,
            picture,
            profile,
            hd,
            exp,
            access_token,
            refresh_token
        };

        return googleProfile;

    }

}


//In this module, I am following the 'Manually build a Login Flow' approach (see https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow)
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reply, Request } from '../../global/custom.interfaces';
import * as randomString from 'randomstring'; //requires npm install randomstring
import fetch from 'node-fetch';
import { FacebookProfileDto } from "../dtos/facebook-profile.dto";
import { fbConstants } from "../../global/app.settings";

@Injectable()
export class FacebookOauth2Strategy {

    async getAuthorizationUrl(req: Request) {
        //console.log(req.hostname);
        //Create a verifier to be put in session
        const state = `{host:${req.hostname},rand:${randomString.generate(9)}}`; //for CSRF avoidance crosscheck
        req.session.set('fb_state_verifier', state); //put verifier in session. Now using fastify secure session

        //use code rather than token as return type. Thereafter, we can ensure that CRSF is in order before we request for the token
        return encodeURI(`https://www.facebook.com/v9.0/dialog/oauth?auth_type=rerequest&client_id=${fbConstants.APP_ID}&redirect_uri=${fbConstants.CALLBACK_URL}&state=${state}&scope=${fbConstants.SCOPE}&response_type=code,granted_scopes`);

    }

    async processCallBack(req: Request) {
        const code = req.query['code'];
        const state = req.query['state'];
        //console.log(state);
        const grantedScopes = req.query['granted_scopes'];
        //console.log(grantedScopes);
        const deniedScopes = req.query['denied_scopes']; //to see if to request again
        //console.log(deniedScopes);
        const stateInSession = req.session.get('fb_state_verifier');

        //verify the state
        if (state != stateInSession) {
            //trouble. Attempt to hijack session
            throw new HttpException({
                status: HttpStatus.UNAUTHORIZED,
                error: `Looks like you are attempting to hijack session.`,
            }, HttpStatus.UNAUTHORIZED);
        }
        //state verified. Proceed to get token
        try {
            //Let us ensure that email and gender were not denied
            if (deniedScopes.search('email') != -1 || deniedScopes.search('gender') != -1) {
                /* //Requesting again as shown below is giving continuous redirects. For now, I will just throw an unauthorized exception
                //email and gender must be allowed. Request again. Notice the auth_type=rerequest in URL below
                return reply.status(302).redirect(encodeURI(`https://www.facebook.com/v9.0/dialog/oauth?client_id=${fbConstants.APP_ID}&auth_type=rerequest&redirect_uri=${fbConstants.CALLBACK_URL}&state=${state}&scope=${fbConstants.SCOPE}&response_type=code,granted_scopes`));
                */
                throw new HttpException({
                    status: HttpStatus.UNAUTHORIZED,
                    error: `email and gender is required for Facebook login`,
                }, HttpStatus.UNAUTHORIZED);
            }

            //email and gender were not denied. Proceed.
            const facebookProfileDto: FacebookProfileDto = {};

            //get the token
            let response = await fetch(`https://graph.facebook.com/v9.0/oauth/access_token?client_id=${fbConstants.APP_ID}&client_secret=${fbConstants.APP_SECRET}&redirect_uri=${fbConstants.CALLBACK_URL}&code=${code}`)
            let data = await response.json();

            const accessToken = data.access_token;
            //below not in use, hence commented out
            //const tokenType = data.token_type;
            //const expiresIn = data.expires_in;

            //get profile fields
            let profileFieldsUrl = `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,gender,birthday&access_token=${accessToken}`;
            if (deniedScopes.search('birthday') != -1) //birthday is not mandatory but desirable.
                profileFieldsUrl = `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,gender&access_token=${accessToken}`;
            response = await fetch(profileFieldsUrl);
            data = await response.json();
            //populate profile
            facebookProfileDto.facebookId = data.id;
            facebookProfileDto.displayName = data.name;
            facebookProfileDto.email = data.email;
            facebookProfileDto.gender = data.gender;
            facebookProfileDto.name = { familyName: data.last_name, givenName: data.first_name };

            //get user picture URL
            //this is not really necessary here. It is to illustrate how to get the photoURL from id
            const userId = data.id
            //console.log(`https://graph.facebook.com/v9.0/${userId}/picture?redirect=false&access_token=${accessToken}`)
            response = await fetch(`https://graph.facebook.com/v9.0/${userId}/picture?redirect=false&access_token=${accessToken}`);

            data = await response.json();

            //populate profile
            facebookProfileDto.photoUrl = data.url;

            //Could consider a payload but I don't really need the token anymore. time for local login to take over and sign the facebookProfileDto
            /*
            const payload = {
                facebookProfileDto,
                accessToken,
                tokenType,
                expiresIn
            }
            */

            return facebookProfileDto;

        } catch (error) {
            throw new HttpException({
                status: HttpStatus.UNAUTHORIZED,
                error: `Problem with Facebook authentication: ${error.message}`,
            }, HttpStatus.UNAUTHORIZED);
        }

    }

}
import { Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { API_VERSION, APP_NAME } from '../global/app.settings';
import { Request, Reply } from '../global/custom.interfaces';
import { AuthService } from './auth.service';
import { FacebookProfileDto } from './dtos/facebook-profile.dto';
import { GoogleProfileDto } from './dtos/google-profile.dto';
import LocalAuthGuard from './guards/local-auth.guard';
import { FacebookOauth2Strategy } from './strategies/facebook-oauth2.strategy';
import { GoogleOidcStrategy } from './strategies/google-oidc.strategy';

@Controller('auth')
export class AuthController {

    constructor(
        private authService: AuthService,
        private googleOidcStrategy: GoogleOidcStrategy,
        private facebookOauth2Strategy: FacebookOauth2Strategy
    ) { }

    /**
    * Below is a login form invoked when username and password need to be supplied in a Web from, for login from browser
    * @param reply 
    */
    @Get('login')
    loginForm(@Res() reply: Reply, @Query() query: string) {
        //get the next param and pass to login.html for rendering below
        const next = query['next'];
        reply.view('auth/login.html',
            {
                apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                title: APP_NAME,
                loginActive: 'true',
                next: next ? next : `/${API_VERSION}`
            })
    }
    /**
     *This route can be used for for ajax basic authentication login Post call. 
     e.g. curl -X POST http://localhost:3001/v1/auth/login -d '{"username": "piusono@gmail.com", "password": "password"}' -H "Content-Type: application/json"
     or from fetch() or axios(), etc.
     On success here, redirect is handled by the client
     * @param req 
     * @param reply
     */
    @UseGuards(LocalAuthGuard)//LocalAuthGuard was defined in auth/guards/local-auth.guard.ts. Check it out
    @Post('login') //this does not conflict with the login url for displaying login form. That is a Get and this is a Post.
    async login(@Req() req: Request, @Res() reply: Reply) {
        return req.user; //returns user directly only if not working with tokens. If working with tokens, use line below
        //reply.send(await this.authService.login(req.user, req, reply));//returns jwt access_token and refresh_token
    }

    @Get("/google")
    async googleLogin(@Req() req: Request, @Res() reply: Reply) {
        //send the authorization Url
        try {
            const authorizationUrl = await this.googleOidcStrategy.getAuthorizationUrl(req)
            reply.status(302).redirect(authorizationUrl);
        } catch (error) {
            reply.view('auth/login.html',
            {
                apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                title: APP_NAME,
                loginActive: 'true',
                notificationMessage: `Problem logging in with Google. Please try another login method: ${error.message}`,
                notificationColorClass: 'is-warning',
                notificationShow: true
            })
            console.log(error)

        }

    }

    @Get("/google/redirect")
    async googleLoginRedirect(@Req() req: Request, @Res() reply: Reply): Promise<any> {
        try {
            const user: GoogleProfileDto = await this.googleOidcStrategy.processCallBack(req);
            //Send user for login
            //const d1 = Date.now(); //just for testing login duration
            const tokens = await this.authService.loginGoogleUser(user, req, reply);

            reply.view('auth/login.html',
                {
                    apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                    loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                    forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                    title: `${APP_NAME} - logging you in.`,
                    loginActive: 'true',
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    saveTokensInClient: 'true'
                })

            //const d2 = Date.now(); //just for testing login duration
            //console.log(d2 - d1); //just for testing login duration

            //reply.send(JSON.stringify(tokens));
        } catch (error) {
            console.log(error.message)
            //reply.send(error)
            reply.view('auth/login.html',
            {
                apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                title: APP_NAME,
                loginActive: 'true',
                notificationMessage: `Problem logging in with Google. Please try another login method: ${error.message}`,
                notificationColorClass: 'is-warning',
                notificationShow: true
            })
        }
    }

    @Get("/facebook")
    async facebookLogin(@Req() req: Request, @Res() reply: Reply) {
        try {
            //send the authorization Url
            const authorizationUrl = await this.facebookOauth2Strategy.getAuthorizationUrl(req)
            reply.status(302).redirect(authorizationUrl);
        } catch (error) {
            reply.view('auth/login.html',
                {
                    apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                    loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                    forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                    title: APP_NAME,
                    loginActive: 'true',
                    notificationMessage: `Problem logging in with Facebook. Please try another login method: ${error.message}`,
                    notificationColorClass: 'is-warning',
                    notificationShow: true
                })
            console.log(error);
        }

    }

    @Get("/facebook/redirect")
    async facebookLoginRedirect(@Req() req: Request, @Res() reply: Reply): Promise<any> {
        try {
            const user: FacebookProfileDto = await this.facebookOauth2Strategy.processCallBack(req);
            const tokens = await this.authService.loginFacebookUser(user, req, reply);

            reply.view('auth/login.html',
                {
                    apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                    loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                    forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                    title: `${APP_NAME} - logging you in.`,
                    loginActive: 'true',
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    saveTokensInClient: 'true'
                })
        } catch (error) {
            //reply.send(error);
            reply.view('auth/login.html',
                {
                    apiVersion: API_VERSION !== null ? `${API_VERSION}` : '',
                    loginUrl: API_VERSION !== null ? `/${API_VERSION}/auth/login` : '/auth/login',
                    forgotPasswordUrl: API_VERSION !== null ? `/${API_VERSION}/users/reset-password-request` : '/users/reset-password-request',
                    title: APP_NAME,
                    loginActive: 'true',
                    notificationMessage: `Problem logging in with Facebook. Please try another login method: ${error.message}`,
                    notificationColorClass: 'is-warning',
                    notificationShow: true
                })
            console.log(error);
        }
    }

    /**
     * Ajax called. Return URL to redirect to
     * @param req 
     * @param query
     */
     @Get('logout')
     logout(@Req() req: Request, @Query() query: string) {
 
         const redirectUrl = this.authService.logout(req);
         //get the next param and pass to login.html for rendering below
         const next = query['next'];
         return next ? { redirectUrl: next } : { redirectUrl }; //override the default redirect declared above
 
     }

}

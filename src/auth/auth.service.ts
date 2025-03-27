import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '../users/models/user.entity';
import { AuthTokenPayload, Request, Reply } from '../global/custom.interfaces';
import { API_VERSION, fbConstants, googleConstants, jwtConstants } from '../global/app.settings';
import { FastifyInstance } from 'fastify';
import { HttpAdapterHost } from '@nestjs/core';
import { SignOptions } from 'jsonwebtoken';
import jwt_decode from 'jwt-decode';
import { GoogleProfileDto } from './dtos/google-profile.dto';
import { FacebookProfileDto } from './dtos/facebook-profile.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private adapterHost: HttpAdapterHost //note that HttpAdapterHost has to be imported from @nestjs/core.
        ) {}

    /**
     * this function will be called each time a user is to be validated on the basis of primaryEmailAddress and password
     * It takes for granted that the password stored in database is hashed with bcrypt and the password being passed here
     * is a plain password, received from the client request, hopefully through a secure tls channel
     * @param email 
     * @param password 
     */
     async validateUser(email: string, passwordPlainText: string) {
        try {

            const user = await this.usersService.findByPrimaryEmailAddress(email);

            if (user) {
                //use bcrypt to compare plaintext password and the hashed one in database
                const isPasswordMatched = await bcrypt.compare(
                    passwordPlainText,
                    user.passwordHash
                );

                if (!isPasswordMatched) {
                    return null; //password does not match
                }

                //read off passwordHash, tokens, etc. so that they are not carried around with user object.
                const { passwordHash, passwordSalt, resetPasswordToken,
                    primaryEmailVerificationToken, backupEmailVerificationToken,
                    emailVerificationTokenExpiration, otpSecret, refreshTokenHash,
                    ...restOfUserFields } = user;

                return restOfUserFields;//alternatively, consider returning just a few necessary fields to avoid overfetching.
            } else {
                return null; //user does not exist
            }
        } catch (error) {
            console.log(error);
            return null;
        }
    }

    /**
     * @param user 
     */
     async login(user: User, req: Request, reply: Reply) {//the req and reply here is because of multitenancy
        //
        const access_token = await this.createAccessToken(user, req, reply);

        //we need to generate refresh token, save to database and send it with the primary access_token
        const refresh_token = await this.createRefreshToken(user, req, reply);

        //below we return both tokens in an object
        return {
            access_token, refresh_token
        };
    }
    /**
     * Called when access_token has expired and client needs to renew
     * @param user 
     * @param req 
     * @param reply 
     * @returns 
     */
    async refresh(user: User, req: Request, reply: Reply) {//no need to send back refreshToken. Client already has it
        //We just need to refresh the accessToken. No creation of new refreshToken and saving to database is required.
        const access_token = await this.createAccessToken(user, req, reply);

        return {
            access_token
        };
    }
    /**
     * This is also a login module like above. But it is for returning tokens in cookie. 
     * Suitable for Web browser access. Invoked from loginweb in AuthController!
     * @param user 
     */
    async loginAndReturnCookies(user: User, req: Request, reply: Reply) {

        const access_token = await this.createAccessToken(user, req, reply);
        const accessTokenCookie = `Authentication=${access_token}; HttpOnly; Path=/; Max-Age=${jwtConstants.SECRET_KEY_EXPIRATION}`;
        const refresh_token = await this.createRefreshToken(user, req, reply);
        const refreshTokenCookie = `Refresh=${refresh_token}; HttpOnly; Path=/; Max-Age=${jwtConstants.REFRESH_SECRET_KEY_EXPIRATION}`;
        //return the two cookies in an array.
        return [accessTokenCookie, refreshTokenCookie]
    }
    /**
     * Invoked by login to create token for user
     * @param user 
     * @param req 
     * @param reply 
     * @returns 
     */
    async createAccessToken(user: User, req: Request, reply: Reply) {
        /**
         * Here you decide what should be returned along with the standard exp and iat. See https://scotch.io/tutorials/the-anatomy-of-a-json-web-token
         * The sub is the conventional name for packaging the subject of the token. You can put there
         * whatever user data will be useful for setting up your control guards, etc. See mine below.
         * I created AccessTokenPayload as interface for it.
         */
        const payload: AuthTokenPayload = {
            username: user.primaryEmailAddress,
            sub: {
                id: user.id,
                landlord: user.landlord,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: user.roles.map((role) => { return role.name })
            }
        }

        //get the instance of fastifyAdapter from nestjs. See https://docs.nestjs.com/faq/http-adapter
        const fastifyInstance: FastifyInstance = this.adapterHost.httpAdapter.getInstance();

        let altOptions: SignOptions = Object.assign({}, { ...fastifyInstance.jwt.options.sign });

        altOptions.issuer = req.hostname; //adjust the issuer to the hostname. This is relevant to multitenant. Optional here but could be an added security
        altOptions.expiresIn = jwtConstants.SECRET_KEY_EXPIRATION;

        const access_token = await reply.jwtSign(payload, altOptions);

        return access_token;
    }

    /**
     * refresh is used to generate a refresh token, saved to database and returned. It is called from login above
     * @param user 
     */
    async createRefreshToken(user: User, req: Request, reply: Reply) {
        /**
         * Here you decide what should be returned along with the standard exp and iat. See https://scotch.io/tutorials/the-anatomy-of-a-json-web-token
         * The sub is the conventional name for packaging the subject of the token. You can put there
         * whatever user data will be useful for setting up your control guards, etc. See mine below.
         * I created AccessTokenPayload as interface for it.
         */
        const payload: AuthTokenPayload = {
            username: user.primaryEmailAddress,
            sub: {
                id: user.id,
                landlord: user.landlord,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: user.roles.map((role) => { return role.name })
            }
        }
        //get the instance of fastifyAdapter from nestjs. See https://docs.nestjs.com/faq/http-adapter
        const fastifyInstance: FastifyInstance = this.adapterHost.httpAdapter.getInstance();

        let altOptions: SignOptions = Object.assign({}, { ...fastifyInstance.jwt.options.sign });
        altOptions.issuer = req.hostname; //set the issuer to the hostname. Only necessary for multitenant. Could be extra security here. 
        altOptions.expiresIn = jwtConstants.REFRESH_SECRET_KEY_EXPIRATION;
        const refresh_token = await reply.jwtSign(payload, altOptions);
        //save it to database before return. //Note: it will be more efficient to have used redis cache
        await this.usersService.setRefreshTokenHash(refresh_token, user.id);

        return refresh_token
    }

    /**
     * Equivalent of validateUser above as this does not require username and password but only refreshToken, to validate the user
     * But called by the strategy to do validation before return
     * @param refreshToken 
     * @param userId 
     */
    async validateRefreshToken(refreshToken: string, userId: number, req: Request) {
        //I created the findById in UsersService for this purpose and included addSelect for the refreshTokenHash
        const user = await this.usersService.findById(userId);//Note: it will be more efficient to have used redis cache

        const isRefreshTokenMatched = await bcrypt.compare(
            refreshToken,
            user.refreshTokenHash
        );

        if (isRefreshTokenMatched) {
            const { passwordHash, passwordSalt, resetPasswordToken,
                primaryEmailVerificationToken, backupEmailVerificationToken,
                emailVerificationTokenExpiration, otpSecret, refreshTokenHash,
                ...restOfUserFields } = user;

            return restOfUserFields;
        } else {
            return null; //invalid refresh token
        }
    }


    /**
     * Logout user
     * @param req 
     * @returns 
     */
    async logout(req: Request) {
        const redirectUrl = `/${API_VERSION}`;
        try {
            const accessToken = req.headers.authorization;
            //get the user from the accessToken
            const decodedAccessToken: AuthTokenPayload = jwt_decode(accessToken) as AuthTokenPayload;
            const userId = decodedAccessToken.sub.id;
            await this.usersService.updateUser(userId, { refreshTokenHash: null });
            return redirectUrl //return where the client should redirect to. This can be a setting.
        } catch (error) {
            //throw new InternalServerErrorException(error.message);
            console.log(error.message);
            //simply go to homepage rather than throw error
            return redirectUrl
        }
    }

    /* Time to setup login that will return jwt for authenticated Google user */
    async loginGoogleUser(googleProfile: GoogleProfileDto, req: Request, reply: Reply) {

        //get user if already in database, and send
        let user = await this.usersService.findByGoogleId(googleProfile.googleId);

        if (!user) {
            //check to see if the user with the google email address as primaryEmailAddress exists
            user = await this.usersService.findByPrimaryEmailAddress(googleProfile.email);

            if (user) {
                if (user.isPrimaryEmailAddressVerified) {
                    //this user has a verified primary email address which is the same as that of Google. Associate them
                    this.usersService.setGoogleProfile(user.id, googleProfile);
                } else {
                    //problem: throw constraint exception. May be better to advice confirmation but consider security
                    this.usersService.confirmEmailRequest(user.primaryEmailAddress, null, true, req)
                    throw new UnauthorizedException("Confirmation of email already associated with your account is required");
                }
            }
        } else {
            //user is already in the database. Update the Google tokens. I did not do this for facebook because I am not saving the facebook tokens. I will however also need to do so for facebook if writing code to query more Facebook APIs
            await this.usersService.setGoogleProfile(user.id, googleProfile);
        }

        //If user does not exist at all after all the above checks, check googleConstants to see if create user if not exists
        if (!user && googleConstants.CREATE_USER_IF_NOT_EXISTS) {
            //create the user
            user = await this.usersService.createFromGoogleProfile(googleProfile);
        }

        if (user) {
            const access_token = await this.createAccessToken(user, req, reply);
            //we need to generate refresh token, save to database and send it with the primary
            const refresh_token = await this.createRefreshToken(user, req, reply);

            //below we return both tokens in an object

            return {
                access_token, refresh_token
            };
        } else {
            throw new UnauthorizedException;
        }
    }

    /* Time to setup login that will return jwt for authenticated facebook user */
    async loginFacebookUser(facebookProfile: FacebookProfileDto, req: Request, reply: Reply) {

        //get user if already in database, and send
        let user = await this.usersService.findByFacebookId(facebookProfile.facebookId);

        if (!user) {
            //check to see if the user with the facebook email address as primaryEmailAddress exists
            user = await this.usersService.findByPrimaryEmailAddress(facebookProfile.email);

            if (user) {
                if (user.isPrimaryEmailAddressVerified) {
                    //this user has a verified primary email address which is the same as that of Facebook. Associate them
                    this.usersService.setFacebookProfile(user.id, facebookProfile);
                } else {
                    //problem: throw constraint exception. May be better to advice confirmation but consider security
                    this.usersService.confirmEmailRequest(user.primaryEmailAddress, null, true, req)
                    throw new UnauthorizedException("Confirmation of email already associated with your account is required")

                }
            }
        }

        //user does not exist at all. Check fbConstants to see if create user if not exists

        if (!user && fbConstants.CREATE_USER_IF_NOT_EXISTS) {
            //create the user
            user = await this.usersService.createFromFacebookProfile(facebookProfile);
        }

        if (user) {
            const access_token = await this.createAccessToken(user, req, reply);
            //we need to generate refresh token, save to database and send it with the primary
            const refresh_token = await this.createRefreshToken(user, req, reply);

            //below we return both tokens in an object

            return {
                access_token, refresh_token
            };
        } else {
            throw new UnauthorizedException;
        }
    }

}

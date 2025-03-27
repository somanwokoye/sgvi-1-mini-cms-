import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from '../../global/custom.interfaces';
import { FastifyInstance } from 'fastify';
import { SignOptions } from 'jsonwebtoken';
import { HttpAdapterHost } from '@nestjs/core';
/**
 * Non passport-based guard. This is the passport strategy equivalent and nest guard, combined.
 */
@Injectable()
class JwtAuthGuard implements CanActivate {

    constructor(
        //private authService: AuthService,
        private adapterHost: HttpAdapterHost
    ) { }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        //call validate
        return this.validate(request);
    }

    /**
     * Here we verify if the token sent is correct
     * @param req 
     */
    async validate(req: Request): Promise<boolean> {

        //get the instance of fastifyAdapter from nestjs. See https://docs.nestjs.com/faq/http-adapter
        const fastifyInstance: FastifyInstance = this.adapterHost.httpAdapter.getInstance();

        //change the issuer option to the request hostname
        let altOptions: SignOptions = Object.assign({}, { ...fastifyInstance.jwt.options.sign });
        altOptions.issuer = req.hostname; //adjust the issuer to the hostname as this was done when the jwt was signed

        //verify
        let valid: boolean = false;
        req.jwtVerify(altOptions,
            (err: any, decoded: any) => {
                if (!err) {
                    valid = true;
                    //here, I should add decoded user to req
                    req.user = decoded;
                } else {
                    console.log(JSON.stringify(err))
                }
            })
        return valid;
    }
}

export default JwtAuthGuard
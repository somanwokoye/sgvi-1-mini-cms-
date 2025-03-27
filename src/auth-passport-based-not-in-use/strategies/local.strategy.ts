import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from '../../global/custom.interfaces';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  
  constructor(private authService: AuthService) {
    super({
      passReqToCallback: true, //I need to get request object in callback. Hence, this. See https://docs.nestjs.com/security/authentication#request-scoped-strategies
    });
  }

  /**
   * Override validate function of PassportStrategy.
   * Here we call authService.validateUser() which will return null if invalid, or the valid user
   * For every strategy, Passport calls the validate function using a set of parameters specific for a particular 
   * strategy.
   * @param username 
   * @param password 
   */
  async validate(request: Request, username: string, password: string): Promise<any> {

    console.log(request.hostname);

    const user = await this.authService.validateUser(username, password);//TODO in ugum: pass request to hostname to authService.validateUser
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
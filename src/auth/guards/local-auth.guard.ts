import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from '../auth.service';
import { Request } from '../../global/custom.interfaces';
/**
 * Non passport-based guard. This is the passport strategy equivalent and nest guard, combined.
 */
@Injectable()
class LocalAuthGuard implements CanActivate {

    constructor(private authService: AuthService) {}
    
    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        //get the username and password from the post body
        const username = request.body.username;
        const password = request.body.password;
        //call validate
        return this.validate(request, username, password);
    }

/**
   * Here we call authService.validateUser() which will return null if invalid, or the valid user
   * For every strategy, Passport calls the validate function using a set of parameters specific for a particular 
   * strategy.
   * @param username 
   * @param password 
   */
  async validate(req: Request, username: string, password: string): Promise<boolean> {

    const user = await this.authService.validateUser(username, password);//For multitenancy, pass request to authService.validateUser
    if (!user) {
      throw new UnauthorizedException();
    }
    //update the request object with the validated user, before returning.
    req.user = user as any;
    return true;
  }
}

export default LocalAuthGuard
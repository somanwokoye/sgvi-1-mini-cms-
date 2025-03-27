//inspired by https://sdoxsee.github.io/blog/2020/02/05/cats-nest-nestjs-mongo-oidc.html

import { UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Client, UserinfoResponse, TokenSet, Issuer } from 'openid-client';
import { googleConstants } from 'src/global/app.settings';
import { AuthService } from '../auth.service';

/**
 * Build for the openId connect compliant client
 */

export const buildOpenIdClient = async () => {
    const TrustIssuer = await Issuer.discover(`${googleConstants.GOOGLE_OAUTH2_CLIENT_OIDC_ISSUER}/.well-known/openid-configuration`);
    const client = new TrustIssuer.Client({
        client_id: googleConstants.GOOGLE_OAUTH2_CLIENT_ID,
        client_secret: googleConstants.GOOGLE_OAUTH2_CLIENT_SECRET,
    });
    return client;
};

export class GoogleOidcStrategy extends PassportStrategy (Strategy, 'google-oidc') {

    client: Client;

    constructor(private readonly authService: AuthService, client: Client) {

        super({
          client: client,
          params: {
            redirect_uri: googleConstants.GOOGLE_OAUTH2_REDIRECT_URI,
            scope: googleConstants.GOOGLE_OAUTH2_SCOPE
          },
          passReqToCallback: false,
          usePKCE: false,
        });
    
        this.client = client;
        
      }

      async validate(tokenset: TokenSet): Promise<any> {
        const userinfo: UserinfoResponse = await this.client.userinfo(tokenset);
    
        try {
          const id_token = tokenset.id_token
          const access_token = tokenset.access_token
          const refresh_token = tokenset.refresh_token
          const user = {
            id_token,
            access_token,
            refresh_token,
            userinfo,
          }
          return user;
        } catch (err) {
          throw new UnauthorizedException();
        }
      }

}
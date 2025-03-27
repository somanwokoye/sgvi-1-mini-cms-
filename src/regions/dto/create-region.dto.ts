import { CreateTenantConfigDetailDto } from "../../tenant-config-details/dto/create-tenant-config-detail.dto";

export class CreateRegionDto {

    readonly name: string; 
    readonly rootDomainName: string;
    readonly description?: string;
    readonly country?: string;
    readonly city?: string;
    readonly tenantCountCapacity?: number;
    readonly webServerProperties?: {
        //domain: string, //E.g. r1.peakharmony.com. Set it up in nameserver. A tenant1 unique name for e.g. can then have a URL slug, tenant1.r1.peakharmony.com. Use default domain to handle all on the server. Only need to add an nginx server block conf file for custom domain
        host: string, //
        port?: number,
        login?: string,
        password?: {iv?: string, content?: string} //should be encrypted. See https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
    };
    readonly dbProperties: {
        type: string,
        host: string,
        port: number,
        username: string,
        password: {iv?: string, content?: string},//should be encrypted. See https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
        database: string,
        /* Below is example for self-signed certificate. See https://node-postgres.com/features/ssl
         * ssl: {
            rejectUnauthorized: boolean,
            ca: fs.readFileSync('/path/to/server-certificates/root.crt').toString(),
            key: fs.readFileSync('/path/to/client-key/postgresql.key').toString(),
            cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt').toString(),
        }
         */
        ssl?: {
            rejectUnauthorized?: boolean,
            ca: string,
            key?: string,
            cert?: string
        }
    }; //for database connection
    readonly elasticSearchProperties: {
        node: string,
        username: string,
        password: {iv?: string, content: string},
        ca?: string //public key for elasticsearch if using 9300 secure port. See https://www.elastic.co/guide/en/elasticsearch/reference/current/security-basic-setup-https.html for secure setup
    };
    readonly redisProperties: {
        host: string,
        port: number,
        password: {iv?: string, content: string}, //should be encrypted. See https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
        db: number | null,
        //sentinels?: { host: string, port: number }[],
        sentinels?: string, //supposed to be { host: string, port: number }[]
        family: number, //4 or 6 for ipv4 or ipv6
        ca?: string //in case of certificate. May not be needed if you follow the advise in https://redis.io/topics/security
    }; //for redis connection.
    readonly rootFileSystem: {
        path: string,
        username?: string, //just in case, there is some form of basic authentication. //should be encrypted. See https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
        password?: {iv?: string, content: string},
        ca?: string //if certificate or key is needed
    }; //the root file system for uploads for the region. Each tenant in the region should have a suffix based on tenant's uuid
    /*
    readonly mailerOptions?: {
        smtpUser: string,
        smtpPword: string, //should be encrypted. See https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
        smtpServer: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean
    }
    readonly smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        type: string,
        user: string,
        clientId: string,
        clientSecret: string,
        refreshToken: string,
        accessToken: string,
        expires: number
    }*/
    readonly smtpAuth?: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
        smtpUser: string,
        smtpPword: {iv?: string, content?: string},
        smtpHost: string,//smtpService below overrides smtpServer
        smtpPort: number,
        smtpService: string,
        smtpSecure: boolean,
        smtpOauth: boolean,
        smtpClientId: string,
        smtpClientSecret: string,
        smtpAccessToken: string,
        smtpRefreshToken: string,
        smtpAccessUrl: string,
        smtpPool: boolean,
        smtpMaximumConnections: number,
        smtpMaximumMessages: number
    };
    readonly jwtConstants?: {
        jwtSecretKeyExpiration: number, //e.g. 300
        jwtRefreshSecretKeyExpiration: string, //e.g. '7d'
        //assuming the use of own keys/certificate. Can be accommodated if using jsonwebtoken directly (see https://www.npmjs.com/package/jsonwebtoken)
        jwtSecretKey: string,
        jwtRefreshSecret: string,
        jwtSecretPrivateKey: string,
        jwtSecretPrivateKeyPassphrase: string,
        jwtSecretPublicKey: string,
        jwtSignAlgorithm: string,
    }
    readonly authEnabled?: {
        google: boolean,
        facebook: boolean,
        twoFactor: boolean
    }
    readonly fbOauth2Constants?: {
        fBAppId: string, //this should be different for each client, read from their storage. Using common for now
        fBAppSecret: string,
        createUserIfNotExists: boolean
    }
    readonly googleOidcConstants?: {
        googleOauth2ClientOidcIssuer: string,
        googleApiKey: string,
        googleOauth2ClientId: string,
        googleOauth2ClientSecret: string,
        createUserIfNotExists: boolean
    }
    readonly otherUserOptions?: {
        resetPasswordMailOptionSettings_TextTemplate: string,
        confirmEmailMailOptionSettings_TextTemplate: string,
        passwordResetExpiration: number,
        emailVerificationExpiration: number
    }
    readonly sizeLimits?: {
        logoFileSizeLimit: number,
        photoFileSizeLimit: number,
        generalFileSizeLimit: number
    }
    readonly theme?: {
        custom: boolean, //if custom, the URL slug will be /tenantUniquePrefix
        type: string, //URL slug /standard
        rootUrl: string, //this could be a remote Url 
        //I don't think I need to have properties here because that should be for theme builder app which is yet to be written.
    }
    readonly tenantConfigDetails?: CreateTenantConfigDetailDto[];

}

import { BaseAbstractEntity } from "../../global/base-abstract.entity";
import { Tenant } from "../../tenants/models/tenant.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { Region } from "../../regions/entities/region.entity";

@Entity()
export class TenantConfigDetail extends BaseAbstractEntity {

  @Column("simple-json", { nullable: true }) //use default region's values if null
  webServerProperties: {
    //domain: string,
    host: string,
    port: number | null,
    login: string | null,
    password: {iv: string | null, content: string | null} | null
  };

  @Column("simple-json", { nullable: true }) //use default region's values if null
  dbProperties: {
    type: string,
    host: string,
    port: number,
    username: string,
    password: {iv: string | null, content: string | null},
    database: string,
    /* Below is example for self-signed certificate. See https://node-postgres.com/features/ssl
         * ssl: {
            rejectUnauthorized: false,
            ca: fs.readFileSync('/path/to/server-certificates/root.crt').toString(),
            key: fs.readFileSync('/path/to/client-key/postgresql.key').toString(),
            cert: fs.readFileSync('/path/to/client-certificates/postgresql.crt').toString(),
        }
         */
    ssl: {
      rejectUnauthorized: boolean,
      ca: string,
      key: string | null, //nullable if not using self-signed
      cert: string | null //nullable if not using self-signed
    } | null
    //schema: string //This should be derived from the generated UUID column for each tenant
  }; //for database connection

  @Column({ nullable: true })//May be set after tenant config detail has been created, hence nullable
  dbSchema: string; //coined from tenant's uuid. Superfluos but could be useful for integrity check.

  @Column("simple-json", { nullable: true }) //use default region's values if null
  elasticSearchProperties: {
    node: string,
    username: string,
    password: {iv: string | null, content: string | null},
    ca: string | null //public key for elasticsearch if using 9300 secure port. See https://www.elastic.co/guide/en/elasticsearch/reference/current/security-basic-setup-https.html for secure setup
  }; //for elastic search connection. This may not be different for each client. If not set, use the general one

  @Column("simple-json", { nullable: true }) //use default region's values if null
  redisProperties: {
    host: string,
    port: number,
    password: {iv: string | null, content: string | null},
    db: number | null,
    //sentinels: { host: string, port: number }[] | null,
    sentinels: string | null, //supposed to be { host: string, port: number }[]
    family: number,
    ca: string | null //in case of certificate. May not be needed if you follow the advise in https://redis.io/topics/security
  }; //for redis connection.

  @Column("simple-json", { nullable: true }) //use default region's values if null
  rootFileSystem: {
    path: string,
    username: string | null, //just in case, there is some form of basic authentication 
    password: {iv: string | null, content: string | null},
    ca: string | null //if certificate or key is needed
  }; //root of filesystem for uploads for the tenant. Each tenant in the region should have a suffix based on tenant's uuid
  /*
    @Column("simple-json", { nullable: true }) //use default region's values if null
    mailerOptions: {
      smtpUser: string,
      smtpPword: string, //this really should be encrypted
      smtpServer: string,//smtpService below overrides smtpServer
      smtpPort: number,
      smtpService: string,
      smtpSecure: boolean
    }
  
    @Column("simple-json", { nullable: true }) //default is yet to be setup. Hence, no default
    smtpAuth: { //optional for the likes of Google OAuth2. See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
      type: string,
      user: string,
      clientId: string,
      clientSecret: string,
      refreshToken: string,
      accessToken: string,
      expires: number
    }*/

  @Column("simple-json", { nullable: true }) //use region's as default if not setup
  smtpAuth: { //See https://www.woolha.com/tutorials/node-js-send-email-using-gmail-with-nodemailer-oauth-2; https://nodemailer.com/smtp/oauth2/
    smtpUser: string,
    smtpPword: {iv: string | null, content: string | null},
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
  }

  @Column("simple-json", { nullable: true }) //defaults to regional value
  jwtConstants: {
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

  @Column("simple-json", { nullable: true }) //use region's if null
  authEnabled: {
    google: boolean,
    facebook: boolean,
    twoFactor: boolean
  }

  @Column("simple-json", { nullable: true })
  fbOauth2Constants: {
    fBAppId: string, //this should be different for each client, read from their storage. Using common for now
    fBAppSecret: string,
    createUserIfNotExists: boolean
  }

  @Column("simple-json", { nullable: true })
  googleOidcConstants: {
    googleOauth2ClientOidcIssuer: string,
    googleApiKey: string,
    googleOauth2ClientId: string,
    googleOauth2ClientSecret: string,
    createUserIfNotExists: boolean
  }

  @Column("simple-json", { nullable: true }) //use region's if null
  otherUserOptions: {
    resetPasswordMailOptionSettings_TextTemplate: string,
    confirmEmailMailOptionSettings_TextTemplate: string,
    passwordResetExpiration: number,
    emailVerificationExpiration: number
  }

  @Column("simple-json", { nullable: true }) //use region's if true
  sizeLimits: {
    logoFileSizeLimit: number,
    photoFileSizeLimit: number,
    generalFileSizeLimit: number
  }

  @Column("simple-json", { nullable: true }) //use region's if null
  theme: {
    custom: boolean, //if custom, the URL slug will be public/css/custom/tenantUniquePrefix.css, public/js/custom/tenantUniquePrefix.js, ...
    type: string, //URL slug public/css/standard.css, ...
    rootUrl: string, //this could be a remote Url 
    //I don't think I need to have properties here because that should be for theme builder app which is yet to be written.
  }

  //Below is already in the tenant entity, remove the other later
  @Column("simple-json", { nullable: true })
  logo: {
    fileName: string,
    mimeType: string
  }

  /**
   * Allocation of connection to tenant: one-to-one
   */
  @JoinColumn()
  @OneToOne(type => Tenant, tenant => tenant.tenantConfigDetail)
  tenant: Tenant

  @ManyToOne(type => Region, region => region.tenantConfigDetails)
  region: Region;
}
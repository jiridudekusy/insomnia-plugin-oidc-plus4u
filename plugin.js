/**
 * Example template tag that generates a random number
 * between a user-provided MIN and MAX
 */
const r2 = require('r2');
const NodeCache = require("node-cache");
const secureStore = require("oidc-plus4u-vault/lib/securestore");

module.exports.templateTags = [{
  name: 'plus4uToken',
  displayName: 'Token from oidc.plus4u.net',
  description: 'Get identity token from oidc.plus4u.net',
  args: [
    {
      displayName: 'Access Code 1',
      description: 'Access Code 1',
      type: 'string'
    },
    {
      displayName: 'Access Code 2',
      description: 'Access Code 2',
      type: 'string'
    },
    {
      displayName: 'Prompt ad-hoc',
      type: 'boolean',
      defaultValue: true
    },
    {
      displayName: 'Prompt user identification',
      type: 'string',
      help: `Identification to distinguish prompts for multiple different users. Please note that this information is shared accross the application in all
      prompts. So in case that you hve multiple prompts with the same identification, they will share the token and access codes.`
    },
    {
      displayName: 'OIDC Server',
      type: 'string',
      defaultValue: "https://oidc.plus4u.net/uu-oidcg01-main/0-0",
      help: `URL of the OIDC server.
      `
    }
  ],
  oidcTokenCache: new NodeCache({stdTTL: 10 * 60, checkperiod: 60}),
  accessCodesStore: new Map(),
  vaultPassword: null,

  async login(accessCode1, accessCode2, oidcServer) {
    if (accessCode1.length === 0 || accessCode2.length === 0) {
      throw `Access code cannot be empty. Ignore this error for "Prompt ad-hoc".`;
    }
    let credentials = {
      accessCode1,
      accessCode2,
      grant_type: "password"
    };
    let tokenEndpoint = await this.getTokenEndpoint(oidcServer);
    let resp = await r2.post(tokenEndpoint, {json: credentials}).json;
    if (Object.keys(resp.uuAppErrorMap).length > 0) {
      throw `Cannot login to OIDC server on ${oidcServer}. Probably invalid combination of Access Code 1 and Access Code 2.`;
    }
    return resp.id_token;
  },

  async getTokenEndpoint(oidcServer) {
    let oidcServerConfigUrl = oidcServer + "/.well-known/openid-configuration";
    let oidcConfig = await r2.get(oidcServerConfigUrl).json;
    if (Object.keys(oidcConfig.uuAppErrorMap).length > 0) {
      throw `Cannot get configuration of OIDC server on ${oidcServer}. Probably invalid URL.`;
    }
    return oidcConfig.token_endpoint;
  },

  async run(context, accessCode1, accessCode2, prompt, identification, oidcServer) {
    if(!oidcServer) {
      oidcServer = "https://oidc.plus4u.net/uu-oidcg01-main/0-0";
    }
    if (prompt) {
      if (this.oidcTokenCache.get(identification)) {
        return this.oidcTokenCache.get(identification);
      }
      let ac1;
      let ac2;
      if (this.accessCodesStore.get(identification)) {
        ac1 = this.accessCodesStore.get(identification).accessCode1;
        ac2 = this.accessCodesStore.get(identification).accessCode2;
      } else {
        if (secureStore.exists()) {
          if (!this.vaultPassword) {
            let password;
            password = await context.app.prompt('OIDC vault password', {label: "OIDC vault password", inputType: "password"});
            if (password) {
              try {
                secureStore.read(password);
                this.vaultPassword = password;
              } catch (e) {
                console.error("Invalid vault password.");
                console.error(e);
              }
            }
          }
          if (this.vaultPassword) {
            let vault = secureStore.read(this.vaultPassword);
            if (vault[identification]) {
              ac1 = vault[identification].ac1;
              ac2 = vault[identification].ac2;
            }
          }
        }
        if (!ac1) {
          ac1 = await context.app.prompt('Access code 1', {label: "Access Code 1 for user " + identification, inputType: "password"});
          ac2 = await context.app.prompt('Access code 2', {label: "Access Code 2 for user " + identification, inputType: "password"});
        }
        console.log(`Using ${ac1} and ${ac2} for user ${identification}.`);
      }
      let token = await this.login(ac1, ac2, oidcServer);
      console.log(`Obtained new token for for user ${identification} : ${token}`);
      this.accessCodesStore.set(identification, {accessCode1: ac1, accessCode2: ac2});
      this.oidcTokenCache.set(identification, token);
      return token;
    } else {
      let key = `${accessCode1}:${accessCode2}`;
      let token = this.oidcTokenCache.get(key);
      if (!token) {
        let token = await this.login(accessCode1, accessCode2, oidcServer);
        this.oidcTokenCache.set(key, token)
      }
      return token;
    }
  }
}];

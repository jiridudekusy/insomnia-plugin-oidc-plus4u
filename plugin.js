/**
 * Example template tag that generates a random number
 * between a user-provided MIN and MAX
 */
const r2 = require('r2');
const NodeCache = require("node-cache");
const secureStore = require("oidc-plus4u-vault/lib/securestore");
const HEADER_RE = /^(?:Bearer\s+)?plus4uToken<({.*})>$/;

//HACK to keep access to context which displays prompt window. Context during requestHooks execution does not support it.
let contextWithPrompt;

let oidcTokenCache = new NodeCache({stdTTL: 10 * 60, checkperiod: 60});
let accessCodesStore = new Map();
let vaultPassword = null;

async function getToken(context, accessCode1, accessCode2, prompt, identification, oidcServer) {
  if (!oidcServer) {
    oidcServer = "https://oidc.plus4u.net/uu-oidcg01-main/0-0";
  }
  if (prompt) {
    let tokenCacheKey = oidcServer + identification;
    if (oidcTokenCache.get(tokenCacheKey)) {
      return oidcTokenCache.get(tokenCacheKey);
    }
    let ac1;
    let ac2;
    if (accessCodesStore.get(identification)) {
      ac1 = accessCodesStore.get(identification).accessCode1;
      ac2 = accessCodesStore.get(identification).accessCode2;
    } else {
      if (secureStore.exists()) {
        if (!vaultPassword) {
          let password;
          password = await context.app.prompt('OIDC vault password', {label: "OIDC vault password", inputType: "password"});
          if (password) {
            try {
              secureStore.read(password);
              vaultPassword = password;
            } catch (e) {
              console.error("Invalid vault password.");
              console.error(e);
            }
          }
        }
        if (vaultPassword) {
          let vault = secureStore.read(vaultPassword);
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
    }
    let token = await login(ac1, ac2, oidcServer);
    console.log(`Obtained new token for for user ${identification} : ${token}`);
    accessCodesStore.set(identification, {accessCode1: ac1, accessCode2: ac2});
    oidcTokenCache.set(tokenCacheKey, token);
    return token;
  } else {
    let key = `${oidcServer}${accessCode1}:${accessCode2}`;
    let token = oidcTokenCache.get(key);
    if (!token) {
      let token = await login(accessCode1, accessCode2, oidcServer);
      oidcTokenCache.set(key, token)
    }
    return token;
  }
}

async function getTokenEndpoint(oidcServer) {
  let oidcServerConfigUrl = oidcServer + "/.well-known/openid-configuration";
  let oidcConfig = await r2.get(oidcServerConfigUrl).json;
  if (Object.keys(oidcConfig.uuAppErrorMap).length > 0) {
    throw `Cannot get configuration of OIDC server on ${oidcServer}. Probably invalid URL.`;
  }
  return oidcConfig.token_endpoint;
}

async function login(accessCode1, accessCode2, oidcServer) {
  if (accessCode1.length === 0 || accessCode2.length === 0) {
    throw `Access code cannot be empty. Ignore this error for "Prompt ad-hoc".`;
  }
  let credentials = {
    accessCode1,
    accessCode2,
    grant_type: "password"
  };
  let tokenEndpoint = await getTokenEndpoint(oidcServer);
  let resp = await r2.post(tokenEndpoint, {json: credentials}).json;
  if (Object.keys(resp.uuAppErrorMap).length > 0) {
    throw `Cannot login to OIDC server on ${oidcServer}. Probably invalid combination of Access Code 1 and Access Code 2.`;
  }
  return resp.id_token;
}

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
      help: `URL of the OIDC server.`
    },
    {
      displayName: 'Lazy',
      type: 'boolean',
      defaultValue: false,
      help: `Token will be otained at the time when it is really needed (wghen request is sent). Lazy tokens can be used only in Authorization header (on "Header" sheet), they cannot be used in "Auth" sheet.`
    },
  ],

  async run(context, accessCode1, accessCode2, prompt, identification, oidcServer, lazy) {
    //HACK to keep access to context which displays prompt window. Context during requestHooks execution does not support it.
    contextWithPrompt = context;
    if (lazy) {
      let pluginParams = JSON.stringify({accessCode1,accessCode2,prompt,identification,oidcServer});
      return `plus4uToken<${pluginParams}>`;
    } else {
      return await getToken(context, accessCode1, accessCode2, prompt, identification, oidcServer);
    }
  }
}];

module.exports.requestHooks = [
  async function (context) {
    let authorizationHeader = context.request.getHeader("Authorization");
    if (authorizationHeader) {
      let matcher = authorizationHeader.match(HEADER_RE);
      if(matcher){
        let pluginParams = JSON.parse(matcher[1]);
        let token = await getToken(contextWithPrompt, pluginParams.accessCode1, pluginParams.accessCode2, pluginParams.prompt, pluginParams.identification, pluginParams.oidcServer);
        if(token){
          context.request.setHeader("Authorization", `Bearer ${token}`);
        }else{
          throw `Cannot obtain token for "${authorizationHeader}"`;
        }
      }
    }
  }
];

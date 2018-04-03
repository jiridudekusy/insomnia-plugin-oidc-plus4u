/**
 * Example template tag that generates a random number
 * between a user-provided MIN and MAX
 */
const r2 = require('r2');
const NodeCache = require( "node-cache" );

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
    }
  ],
  cache: new NodeCache({stdTTL: 10*60, checkperiod: 60}),
  async run(context, accessCode1, accessCode2) {
    let key = `${accessCode1}:${accessCode2}`;
    let resp = this.cache.get(key);
    if(!resp) {
      let credentials = {
        accessCode1,
        accessCode2,
        grant_type: "password"
      };
      resp = await r2.post("https://oidc.plus4u.net/uu-oidcg01-main/0-0/grantToken", {json: credentials}).json;
      console.log(`New token obtained : ${JSON.stringify(resp)}`);
      this.cache.set(key, resp)
    }
    return resp.id_token;
  }
}];